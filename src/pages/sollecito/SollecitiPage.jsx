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
import { FileTextIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "../../components/ui/icons";
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

// Mancato de la app que reclama el solicito: si ya figura pagado alli, se ve aca.
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
      <Link
        to={`/finanzas/mancato/${m.id}`}
        state={{ backgroundLocation: location }}
        className="underline-offset-2 hover:underline"
      >
        {label} · {estado} en la app
      </Link>
      <CopyButton value={m.numero} label="Copiar numero" />
    </span>
  );
};

const SollecitoCard = ({ s, location, onEdit, onEstado, onDelete, busy }) => {
  const estado = sollecitoEstado(s.estado);
  return (
    <article className={clsx("glass-surface-sm flex flex-col gap-3 rounded-2xl border-l-4 p-4", estado.edge)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-[12px] font-medium text-ink-400">{s.emisor}</span>
          <span className="flex items-center gap-1">
            <span className="truncate text-[16px] font-semibold text-ink-50">Atto {s.numeroAtto}</span>
            <CopyButton value={s.numeroAtto} label="Copiar atto" />
          </span>
          <span className="block text-[13px] text-ink-300">
            Carta del {formatDateOnly(s.fechaCarta)}
            {s.fechaTransito && ` · transito del ${formatDateOnly(s.fechaTransito)}`}
            {s.targa && ` · ${s.targa}`}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[18px] font-semibold text-ink-50">{s.importe != null ? formatCurrency(s.importe) : "-"}</span>
          <span className={clsx("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", estado.pill)}>
            {estado.label}
            {s.estado === "PAGADO" && s.pagadoAt ? ` · ${formatDateOnly(s.pagadoAt)}` : ""}
          </span>
        </div>
      </div>

      {s.mancatos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {s.mancatos.map((m) => (
            <MancatoChip key={m.numero} m={m} location={location} />
          ))}
        </div>
      )}

      {s.sitioPago && <p className="break-words text-[12px] text-ink-400">Se paga: {s.sitioPago}</p>}
      {s.comentarios && <p className="whitespace-pre-line text-[13px] text-ink-200">{s.comentarios}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {s.archivo && (
          <a
            href={s.archivo.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg glass-input px-3 py-1.5 text-[12px] font-medium text-ink-50 hover:bg-line/10"
          >
            <FileTextIcon className="h-3.5 w-3.5" />
            Ver solicito
          </a>
        )}
        {s.comprobante && (
          <a
            href={s.comprobante.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg glass-input px-3 py-1.5 text-[12px] font-medium text-success-500 hover:bg-line/10"
          >
            <FileTextIcon className="h-3.5 w-3.5" />
            Ver comprobante
          </a>
        )}
        {s.estado !== "PAGADO" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onEstado(s, "PAGADO")}
            className="rounded-lg glass-input px-3 py-1.5 text-[12px] font-medium text-ink-50 hover:bg-line/10 disabled:opacity-60"
          >
            Marcar pagado
          </button>
        )}
        {s.estado !== "POR_PAGAR" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onEstado(s, "POR_PAGAR")}
            className="rounded-lg glass-input px-3 py-1.5 text-[12px] font-medium text-ink-50 hover:bg-line/10 disabled:opacity-60"
          >
            Volver a por pagar
          </button>
        )}
        <span className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => onEdit(s)}
            title="Editar"
            aria-label="Editar"
            className="rounded-lg p-2 text-ink-300 hover:bg-line/10 hover:text-ink-50"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(s)}
            title="Eliminar"
            aria-label="Eliminar"
            className="rounded-lg p-2 text-ink-300 hover:bg-line/10 hover:text-danger-500"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </span>
      </div>
    </article>
  );
};

// "Solicitos": cartas de la autopista que reclaman mancati pagamenti. Se guardan con su PDF como
// respaldo y se marca si hay que pagarlos, si ya se pagaron o si no corresponde.
export const SollecitiPage = () => {
  const location = useLocation();
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
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
      load();
    } catch (err) {
      setDeleteError(parseApiError(err).message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const resumen = data?.resumen;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-xl text-[14px] text-ink-300">
          Solicitos de la autopista por mancati pagamenti. Quedan guardados con su PDF como respaldo por si despues llega una multa.
        </p>
        <Button className="sm:w-auto sm:px-6" onClick={() => setEditing(null)}>
          <PlusIcon className="h-4 w-4" />
          Nuevo solicito
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
      {data?.items.length === 0 && <p className="px-1 py-4 text-[14px] text-ink-400">No hay solicitos con estos filtros.</p>}

      <div className="flex flex-col gap-3">
        {data?.items.map((s) => (
          <SollecitoCard
            key={s.id}
            s={s}
            location={location}
            busy={busyId === s.id}
            onEdit={setEditing}
            onEstado={onEstado}
            onDelete={(item) => {
              setDeleteError("");
              setDeleting(item);
            }}
          />
        ))}
      </div>

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
        title="Eliminar solicito"
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
