import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SollecitoFormModal } from "../../components/sollecito/SollecitoFormModal";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { CopyButton } from "../../components/ui/CopyButton";
import { PageLoader } from "../../components/ui/PageLoader";
import { Select } from "../../components/ui/Select";
import { TextField } from "../../components/ui/TextField";
import { CloseIcon, FileTextIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "../../components/ui/icons";
import { parseApiError } from "../../lib/api";
import { formatCurrency, formatDateOnly } from "../../lib/format";
import {
  SOLLECITO_ESTADOS,
  deleteSollecitoRequest,
  listSollecitiRequest,
  sollecitoEstado,
  updateSollecitoRequest,
} from "../../lib/sollecito.api";

// Espera a que se deje de tipear antes de pedir al servidor.
const useDebounced = (value, ms) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
};

const smallBtn =
  "inline-flex items-center gap-1.5 rounded-lg glass-input px-3 py-1.5 text-[12px] font-medium text-ink-50 hover:bg-line/10 disabled:opacity-60";

// Mancato de la app que reclama el sollecito: si ya figura pagado alli, se ve aca.
const MancatoChip = ({ m, location }) => {
  const label = `N. ${m.numero}`;
  if (!m.enApp) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-line/10 px-2.5 py-0.5 text-[12px] text-ink-300">
        {label} · no esta en la app
        <CopyButton value={m.numero} label="Copiar numero" />
      </span>
    );
  }
  const tone = m.pagado
    ? "bg-success-500/15 text-success-500"
    : m.observado
      ? "bg-[#a78bfa]/15 text-[#a78bfa]"
      : "bg-warning-500/15 text-warning-500";
  const estado = m.pagado
    ? `pagado${m.pagadoAt ? ` el ${formatDateOnly(m.pagadoAt)}` : ""}`
    : m.observado
      ? "observado"
      : "sin pagar";
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium", tone)}>
      <Link to={`/finanzas/mancato/${m.id}`} state={{ backgroundLocation: location }} className="underline-offset-2 hover:underline">
        {label} · {estado} en la app
      </Link>
      <CopyButton value={m.numero} label="Copiar numero" />
    </span>
  );
};

const EstadoPill = ({ s }) => {
  const estado = sollecitoEstado(s.estado);
  return (
    <span className={clsx("whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold", estado.pill)}>
      {estado.label}
      {s.estado === "PAGADO" && s.pagadoAt ? ` · ${formatDateOnly(s.pagadoAt)}` : ""}
    </span>
  );
};

// Tarjeta de la lista: solo lo necesario. Al hacer clic se abre el detalle completo.
const SollecitoCard = ({ s, busy, onOpen, onEstado }) => {
  const estado = sollecitoEstado(s.estado);
  const stop = (e) => e.stopPropagation();
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(s)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(s))}
      className={clsx(
        "glass-surface-sm flex cursor-pointer flex-col gap-2.5 rounded-2xl border-l-4 px-4 py-3 transition-colors hover:bg-line/[0.06] sm:flex-row sm:items-center sm:gap-4",
        estado.edge
      )}
    >
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[12px] text-ink-400">{s.emisor}</span>
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate text-[15px] font-semibold text-ink-50">Atto {s.numeroAtto}</span>
          <span onClick={stop}>
            <CopyButton value={s.numeroAtto} label="Copiar atto" />
          </span>
        </span>
        <span className="block truncate text-[12px] text-ink-300">
          Carta del {formatDateOnly(s.fechaCarta)}
          {s.targa ? ` · ${s.targa}` : ""}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1">
        <span className="text-[16px] font-semibold text-ink-50">{s.importe != null ? formatCurrency(s.importe) : "-"}</span>
        <EstadoPill s={s} />
      </div>

      <div className="flex flex-wrap gap-2 sm:w-[260px] sm:justify-end" onClick={stop}>
        {s.archivo && (
          <a href={s.archivo.url} target="_blank" rel="noreferrer" className={smallBtn}>
            <FileTextIcon className="h-3.5 w-3.5" />
            Ver sollecito
          </a>
        )}
        {s.estado !== "PAGADO" && (
          <button type="button" disabled={busy} onClick={() => onEstado(s, "PAGADO")} className={smallBtn}>
            Marcar pagado
          </button>
        )}
      </div>
    </article>
  );
};

const DetailRow = ({ label, children }) => (
  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
    <span className="shrink-0 text-[12px] font-medium text-ink-400 sm:w-36">{label}</span>
    <span className="min-w-0 break-words text-[14px] text-ink-50">{children}</span>
  </div>
);

// Detalle completo de un sollecito: datos de la carta, mancatos que reclama, donde se paga,
// comentarios, archivos y acciones.
const SollecitoDetail = ({ s, location, busy, onClose, onEstado, onEdit, onDelete }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-backdrop backdrop-blur-sm" />
      <div className="glass-surface relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-t-3xl bg-background p-5 sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-[12px] text-ink-400">{s.emisor}</span>
            <span className="flex items-center gap-1">
              <h2 className="break-words text-[20px] font-semibold text-ink-50">Atto {s.numeroAtto}</h2>
              <CopyButton value={s.numeroAtto} label="Copiar atto" iconClassName="h-4 w-4" />
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-ink-300 hover:bg-line/10 hover:text-ink-50"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[22px] font-semibold text-ink-50">{s.importe != null ? formatCurrency(s.importe) : "-"}</span>
          <EstadoPill s={s} />
        </div>

        <div className="flex flex-col gap-2.5 rounded-2xl bg-line/[0.05] p-4">
          <DetailRow label="Fecha de la carta">{formatDateOnly(s.fechaCarta)}</DetailRow>
          <DetailRow label="Fecha del transito">{s.fechaTransito ? formatDateOnly(s.fechaTransito) : "-"}</DetailRow>
          <DetailRow label="Targa">{s.targa || "-"}</DetailRow>
          <DetailRow label="Donde se paga">{s.sitioPago || "-"}</DetailRow>
        </div>

        {s.mancatos.length > 0 && (
          <div>
            <span className="mb-2 block text-[12px] font-medium text-ink-400">
              Mancatos que reclama ({s.mancatos.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {s.mancatos.map((m) => (
                <MancatoChip key={m.numero} m={m} location={location} />
              ))}
            </div>
          </div>
        )}

        {s.comentarios && (
          <div>
            <span className="mb-1 block text-[12px] font-medium text-ink-400">Comentarios</span>
            <p className="whitespace-pre-line text-[14px] text-ink-200">{s.comentarios}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {s.archivo && (
            <a href={s.archivo.url} target="_blank" rel="noreferrer" className={smallBtn}>
              <FileTextIcon className="h-3.5 w-3.5" />
              Ver sollecito
            </a>
          )}
          {s.comprobante && (
            <a href={s.comprobante.url} target="_blank" rel="noreferrer" className={clsx(smallBtn, "text-success-500")}>
              <FileTextIcon className="h-3.5 w-3.5" />
              Ver comprobante
            </a>
          )}
          {s.estado !== "PAGADO" && (
            <button type="button" disabled={busy} onClick={() => onEstado(s, "PAGADO")} className={smallBtn}>
              Marcar pagado
            </button>
          )}
          {s.estado !== "NO_CORRESPONDE" && (
            <button type="button" disabled={busy} onClick={() => onEstado(s, "NO_CORRESPONDE")} className={smallBtn}>
              No corresponde
            </button>
          )}
          {s.estado !== "POR_PAGAR" && (
            <button type="button" disabled={busy} onClick={() => onEstado(s, "POR_PAGAR")} className={smallBtn}>
              Volver a por pagar
            </button>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line/10 pt-4">
          <button type="button" onClick={() => onEdit(s)} className={smallBtn}>
            <PencilIcon className="h-3.5 w-3.5" />
            Editar
          </button>
          <button type="button" onClick={() => onDelete(s)} className={clsx(smallBtn, "text-danger-500")}>
            <TrashIcon className="h-3.5 w-3.5" />
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
};

// "Sollecitos": cartas de la autopista que reclaman mancati pagamenti. Se guardan con su PDF como
// respaldo y se marca si hay que pagarlos, si ya se pagaron o si no corresponde.
export const SollecitiPage = () => {
  const location = useLocation();
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [editing, setEditing] = useState(undefined); // undefined: cerrado, null: nuevo, objeto: editar
  const [busyId, setBusyId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const debouncedQ = useDebounced(q, 350);

  const load = useCallback(() => {
    listSollecitiRequest({
      q: debouncedQ.trim() || undefined,
      estado: estado || undefined,
      from: from || undefined,
      to: to || undefined,
    })
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((err) => setError(parseApiError(err).message));
  }, [debouncedQ, estado, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const replaceItem = (saved) =>
    setData((prev) => (prev ? { ...prev, items: prev.items.map((s) => (s.id === saved.id ? saved : s)) } : prev));

  const onEstado = async (s, nuevo) => {
    setBusyId(s.id);
    try {
      replaceItem(await updateSollecitoRequest(s.id, { estado: nuevo }));
      load();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async () => {
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteSollecitoRequest(deleting.id);
      setDeleting(null);
      setDetailId(null);
      load();
    } catch (err) {
      setDeleteError(parseApiError(err).message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const resumen = data?.resumen;
  const detail = detailId ? data?.items.find((s) => s.id === detailId) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-xl text-[14px] text-ink-300">
          Sollecitos de la autopista por mancati pagamenti. Quedan guardados con su PDF como respaldo por si despues llega una multa.
        </p>
        <Button className="sm:w-auto sm:px-6" onClick={() => setEditing(null)}>
          <PlusIcon className="h-4 w-4" />
          Nuevo sollecito
        </Button>
      </div>

      {resumen && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SOLLECITO_ESTADOS.map((e) => (
            <button
              key={e.value}
              type="button"
              onClick={() => setEstado(estado === e.value ? "" : e.value)}
              className={clsx(
                "glass-surface-sm flex items-center justify-between gap-3 rounded-2xl border-l-4 px-4 py-3 text-left transition-colors hover:bg-line/[0.05]",
                e.edge,
                estado === e.value && "ring-1 ring-accent-400/60"
              )}
            >
              <span>
                <span className="block text-[13px] font-medium text-ink-300">{e.label}</span>
                <span className="block text-[20px] font-semibold text-ink-50">{resumen[e.value].count}</span>
              </span>
              <span className="text-[15px] font-semibold text-ink-50">{formatCurrency(resumen[e.value].total)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="glass-surface-sm flex flex-wrap items-end gap-3 rounded-2xl p-4">
        <TextField
          id="sol-q"
          label="Buscar"
          icon={SearchIcon}
          placeholder="Atto, N. de mancato, targa o emisor"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[220px] flex-[2_1_260px]"
        />
        <div className="min-w-[150px] flex-[1_1_150px]">
          <Select
            id="sol-filtro-estado"
            label="Estado"
            options={[{ value: "", label: "Todos" }, ...SOLLECITO_ESTADOS.map((e) => ({ value: e.value, label: e.label }))]}
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          />
        </div>
        <TextField
          id="sol-desde"
          label="Carta desde"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => setFrom(e.target.value)}
          className="min-w-[150px] flex-[1_1_150px]"
        />
        <TextField
          id="sol-hasta"
          label="Carta hasta"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value)}
          className="min-w-[150px] flex-[1_1_150px]"
        />
      </div>

      <Alert>{error}</Alert>
      {!data && !error && <PageLoader />}
      {data?.items.length === 0 && <p className="px-1 py-4 text-[14px] text-ink-400">No hay sollecitos con estos filtros.</p>}

      <div className="flex flex-col gap-2">
        {data?.items.map((s) => (
          <SollecitoCard key={s.id} s={s} busy={busyId === s.id} onOpen={(item) => setDetailId(item.id)} onEstado={onEstado} />
        ))}
      </div>

      {detail && (
        <SollecitoDetail
          s={detail}
          location={location}
          busy={busyId === detail.id}
          onClose={() => setDetailId(null)}
          onEstado={onEstado}
          onEdit={(item) => setEditing(item)}
          onDelete={(item) => {
            setDeleteError("");
            setDeleting(item);
          }}
        />
      )}

      <SollecitoFormModal
        open={editing !== undefined}
        sollecito={editing ?? null}
        onClose={() => setEditing(undefined)}
        onSaved={() => {
          setEditing(undefined);
          load();
        }}
      />

      <ConfirmModal
        open={Boolean(deleting)}
        title="Eliminar sollecito"
        description={deleting ? `Se borra el atto ${deleting.numeroAtto} con su PDF y comprobante. No se puede deshacer.` : ""}
        confirmLabel="Eliminar"
        error={deleteError}
        loading={deleteBusy}
        onConfirm={onDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
};
