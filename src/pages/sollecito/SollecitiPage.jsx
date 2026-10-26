import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SollecitoFormModal } from "../../components/sollecito/SollecitoFormModal";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { CopyButton } from "../../components/ui/CopyButton";
import { PageLoader } from "../../components/ui/PageLoader";
import { TextField } from "../../components/ui/TextField";
import { ChevronDownIcon, CloseIcon, FileTextIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "../../components/ui/icons";
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

// Dias entre hoy (en Italia) y una fecha YYYY-MM-DD.
const romeToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
const diasHasta = (day) => Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${romeToday()}T00:00:00Z`)) / 86400000);

// Debajo de la fecha de subida: hasta cuando pagar (en rojo), o cuando se pago.
const PlazoLinea = ({ s }) => {
  if (s.estado === "PAGADO") {
    return (
      <span className="block text-[11px] font-medium text-success-500">
        Pagado{s.pagadoAt ? ` el ${formatDateOnly(s.pagadoAt)}` : ""}
      </span>
    );
  }
  if (s.estado === "NO_CORRESPONDE") return <span className="block text-[11px] text-ink-400">No corresponde</span>;
  if (!s.fechaLimitePago) return <span className="block text-[11px] text-ink-400">Sin fecha limite</span>;
  const dias = diasHasta(s.fechaLimitePago);
  const cuando = dias < 0 ? `vencio hace ${-dias} ${dias === -1 ? "dia" : "dias"}` : dias === 0 ? "vence hoy" : `en ${dias} ${dias === 1 ? "dia" : "dias"}`;
  return (
    <span className="block text-[11px] font-medium text-danger-500">
      Pagar antes del {formatDateOnly(s.fechaLimitePago)} · {cuando}
    </span>
  );
};

const ROW_GRID = "lg:grid-cols-[minmax(150px,1.1fr)_minmax(180px,1.6fr)_minmax(110px,0.8fr)_minmax(110px,0.8fr)_minmax(90px,0.6fr)_250px]";

// Fila de la lista (como en Mancato Pagamento). Al hacer clic se abre el detalle completo.
const SollecitoRow = ({ s, busy, onOpen, onEstado }) => {
  const estado = sollecitoEstado(s.estado);
  const stop = (e) => e.stopPropagation();
  const targas = s.targas?.length ? s.targas : s.targa ? [s.targa] : [];
  const nMancatos = s.numerosMancato.length;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(s)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(s))}
      className={clsx(
        "grid cursor-pointer grid-cols-1 gap-2 rounded-xl border-l-4 px-4 py-3 transition-colors hover:bg-line/[0.07] lg:items-center lg:gap-3",
        estado.edge,
        ROW_GRID,
        "lg:rounded-lg lg:border-l-0 lg:border-b lg:border-b-line/10 lg:py-2.5"
      )}
    >
      {/* Fechas: cuando llego (se subio) y, abajo en rojo, el ultimo dia de pago */}
      <div className="min-w-0">
        <span className="block text-[13px] font-medium text-ink-50">Recibido {formatDateOnly(s.createdAt)}</span>
        <PlazoLinea s={s} />
      </div>

      {/* Autopista y atto */}
      <div className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-ink-50" title={s.emisor}>
          {s.emisor}
        </span>
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate text-[12px] text-ink-300">Atto {s.numeroAtto}</span>
          <span onClick={stop}>
            <CopyButton value={s.numeroAtto} label="Copiar atto" />
          </span>
        </span>
      </div>

      {/* Targa(s) */}
      <div className="min-w-0">
        <span
          className="block truncate text-[13px] font-medium tracking-wide text-ink-50"
          title={targas.length > 1 ? targas.join(", ") : undefined}
        >
          {targas.length === 0 ? "-" : targas.length === 1 ? targas[0] : "Varias targas"}
        </span>
        {targas.length > 1 && <span className="block truncate text-[11px] text-ink-400">{targas.join(", ")}</span>}
      </div>

      {/* Mancatos que reclama */}
      <div className="min-w-0">
        <span className="block text-[13px] text-ink-50">
          {nMancatos} {nMancatos === 1 ? "mancato" : "mancatos"}
        </span>
        {s.fechaTransito && (
          <span className="block text-[11px] text-ink-400">Transito {formatDateOnly(s.fechaTransito)}</span>
        )}
      </div>

      {/* Importe */}
      <span className="text-[14px] font-semibold text-ink-50 lg:text-right">
        {s.importe != null ? formatCurrency(s.importe) : "-"}
      </span>

      {/* Acciones */}
      <div className="flex flex-wrap gap-2 lg:justify-end" onClick={stop}>
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
    </div>
  );
};

// Un acordeon por estado (Por pagar, Pagado, No corresponde), con cantidad y total.
const EstadoGrupo = ({ estado, items, resumen, defaultOpen, busyId, onOpen, onEstado }) => {
  const [userOpen, setUserOpen] = useState(null);
  const open = userOpen ?? defaultOpen;
  return (
    <section className={clsx("glass-surface-sm overflow-hidden rounded-2xl border-l-4", estado.edge)}>
      <button
        type="button"
        onClick={() => setUserOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-line/[0.04]"
      >
        <span className="text-[15px] font-semibold text-ink-50">{estado.label}</span>
        <span className={clsx("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", estado.pill)}>{resumen.count}</span>
        <span className="ml-auto text-[16px] font-semibold text-ink-50">{formatCurrency(resumen.total)}</span>
        <ChevronDownIcon className={clsx("h-4 w-4 text-ink-300 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-2 pb-3 lg:gap-0">
          {items.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-ink-400">No hay sollecitos en este estado con estos filtros.</p>
          ) : (
            <>
              <div className={clsx("hidden px-4 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-ink-400 lg:grid lg:gap-3", ROW_GRID)}>
                <span>Fecha</span>
                <span>Autopista / atto</span>
                <span>Targa</span>
                <span>Mancatos</span>
                <span className="text-right">Importe</span>
                <span />
              </div>
              {items.map((s) => (
                <SollecitoRow key={s.id} s={s} busy={busyId === s.id} onOpen={onOpen} onEstado={onEstado} />
              ))}
            </>
          )}
        </div>
      )}
    </section>
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
          <DetailRow label="Ultimo dia de pago">
            {s.fechaLimitePago ? formatDateOnly(s.fechaLimitePago) : "-"}
          </DetailRow>
          <DetailRow label="Recibido / subido">{formatDateOnly(s.createdAt)}</DetailRow>
          <DetailRow label="Targa">{(s.targas?.length ? s.targas : [s.targa]).filter(Boolean).join(", ") || "-"}</DetailRow>
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
      from: from || undefined,
      to: to || undefined,
    })
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((err) => setError(parseApiError(err).message));
  }, [debouncedQ, from, to]);

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
  // Por pagar: primero los que vencen antes (sin fecha limite al final).
  const porEstado = useMemo(() => {
    const groups = Object.fromEntries(SOLLECITO_ESTADOS.map((e) => [e.value, []]));
    (data?.items ?? []).forEach((s) => groups[s.estado]?.push(s));
    groups.POR_PAGAR.sort((x, y) => (x.fechaLimitePago ?? "9999").localeCompare(y.fechaLimitePago ?? "9999"));
    return groups;
  }, [data]);
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
      {data && resumen && (
        <div className="flex flex-col gap-4">
          {SOLLECITO_ESTADOS.map((e) => (
            <EstadoGrupo
              key={e.value}
              estado={e}
              items={porEstado[e.value]}
              resumen={resumen[e.value]}
              defaultOpen={e.value === "POR_PAGAR" || Boolean(debouncedQ.trim())}
              busyId={busyId}
              onOpen={(item) => setDetailId(item.id)}
              onEstado={onEstado}
            />
          ))}
        </div>
      )}

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
