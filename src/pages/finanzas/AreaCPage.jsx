import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { GlassCard } from "../../components/ui/GlassCard";
import {
  AlertTriangleIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClipboardListIcon,
  SearchIcon,
} from "../../components/ui/icons";
import { PageLoader } from "../../components/ui/PageLoader";
import { Pagination } from "../../components/ui/Pagination";
import { Select } from "../../components/ui/Select";
import { StatTile } from "../../components/ui/StatTile";
import { TextField } from "../../components/ui/TextField";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import {
  deleteAreaCEntryRequest,
  listAreaCEntriesRequest,
  updateAreaCEntryRequest,
} from "../../lib/vehicles.api";

const PAGE_SIZE = 10;

const ESTADO_OPTIONS = [
  { value: "NO_PAGADO", label: "Sin pagar" },
  { value: "PAGADO", label: "Pagados" },
];
const SORT_OPTIONS = [
  { value: "reciente", label: "Más recientes" },
  { value: "antiguo", label: "Más antiguos" },
  { value: "targa", label: "Targa" },
];

const romeDay = (value) => new Date(value).toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });

const TrashIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);

// Una fila por entrada al Area C (targa + hora, ya completados por el sistema). El
// "Pagado" y el comprobante son ediciones locales hasta que se confirman con "Guardar"
// (un solo PATCH con los dos juntos, igual que en el resto de la app).
const AreaCRow = ({ entry, onSaved, onDelete }) => {
  const [pagado, setPagado] = useState(entry.pagado);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dirty = pagado !== entry.pagado || file != null;

  const handleSave = async () => {
    setSaving(true);
    setError("");
    const formData = new FormData();
    formData.append("pagado", pagado);
    if (file) formData.append("comprobante", file);

    try {
      const updated = await updateAreaCEntryRequest(entry.id, formData);
      onSaved(updated);
      setFile(null);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <li
      className={clsx(
        "border-t border-l-[3px] border-line/[0.07] px-4 py-3.5 text-[13px] text-ink-200 first:border-t-0",
        entry.pagado ? "border-l-transparent" : "border-l-warning-500"
      )}
    >
      <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[1.2fr_1fr_1fr_1.5fr_auto]">
        <div>
          <span className="block font-medium text-ink-50">{formatDateTime(entry.enteredAt)}</span>
          <span className="text-[12px] text-ink-400">Entrada detectada</span>
        </div>

        <span className="font-semibold tracking-wide text-ink-50">{entry.targa}</span>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={pagado}
            onChange={(e) => setPagado(e.target.checked)}
            className="h-4 w-4 accent-[#22e093]"
          />
          <span
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
              pagado ? "bg-success-500/15 text-success-500" : "bg-warning-500/20 text-warning-500 ring-1 ring-warning-500/40"
            )}
          >
            <span className={clsx("h-1.5 w-1.5 rounded-full", pagado ? "bg-success-500" : "bg-warning-500")} />
            {pagado ? "Pagado" : "Sin pagar"}
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {entry.comprobanteUrl && (
            <a
              href={entry.comprobanteUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] font-medium text-accent-400 hover:underline"
            >
              Ver comprobante
            </a>
          )}
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className="inline-block max-w-[190px] truncate rounded-lg glass-input px-2.5 py-1 text-[12px] text-ink-300">
              {file?.name ?? (entry.comprobanteUrl ? "Reemplazar" : "Subir comprobante")}
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2">
          {dirty && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-brand-foreground disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(entry)}
            aria-label={`Eliminar el registro de ${entry.targa}`}
            title="Eliminar"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line/10 text-ink-300 transition-colors hover:border-danger-500/40 hover:bg-danger-500/10 hover:text-danger-500"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-[12px] text-danger-500">{error}</p>}
    </li>
  );
};

export const AreaCPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [estado, setEstado] = useState("");
  const [sort, setSort] = useState("reciente");
  const [page, setPage] = useState(1);

  // Eliminacion: el registro elegido espera confirmacion en el modal.
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = () =>
    listAreaCEntriesRequest()
      .then(setEntries)
      .catch((err) => setError(parseApiError(err).message));

  useEffect(() => {
    if (!isPrivileged) return;
    load();
  }, [isPrivileged]);

  const filtered = useMemo(() => {
    const needle = query.trim().toUpperCase().replace(/\s+/g, "");
    const list = (entries ?? []).filter((e) => {
      if (estado === "PAGADO" && !e.pagado) return false;
      if (estado === "NO_PAGADO" && e.pagado) return false;
      return !needle || e.targa.toUpperCase().replace(/\s+/g, "").includes(needle);
    });
    return [...list].sort((a, b) => {
      if (sort === "targa") return a.targa.localeCompare(b.targa, "es") || new Date(b.enteredAt) - new Date(a.enteredAt);
      const diff = new Date(b.enteredAt) - new Date(a.enteredAt);
      return sort === "antiguo" ? -diff : diff;
    });
  }, [entries, query, estado, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, estado, sort]);

  if (!isPrivileged) return <Navigate to="/" replace />;

  const total = entries?.length ?? 0;
  const sinPagar = entries?.filter((e) => !e.pagado).length ?? 0;
  const pagados = total - sinPagar;
  const hoy = entries?.filter((e) => romeDay(e.enteredAt) === romeDay(new Date())).length ?? 0;
  const hasFilters = Boolean(query.trim() || estado);

  const handleSaved = (updated) => setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteAreaCEntryRequest(toDelete.id);
      setEntries((prev) => prev.filter((e) => e.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      setDeleteError(parseApiError(err).message);
    } finally {
      setDeleting(false);
    }
  };

  const deleteIsToday = toDelete ? romeDay(toDelete.enteredAt) === romeDay(new Date()) : false;

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-xl text-[14px] text-ink-300">
        Vehículos sin autorización detectados dentro del Área C. Marca los pagados, sube el comprobante o elimina los
        que no quieras guardar.
      </p>

      <Alert>{error}</Alert>

      {entries === null && !error && <PageLoader />}

      {entries !== null && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatTile icon={ClipboardListIcon} value={total} label="Registros guardados" />
            <StatTile
              icon={AlertTriangleIcon}
              tone={sinPagar > 0 ? "warning" : "neutral"}
              value={sinPagar}
              label="Sin pagar"
              detail={total > 0 ? `${Math.round((sinPagar / total) * 100)}% del total` : ""}
            />
            <StatTile
              icon={CheckCircleIcon}
              tone="success"
              value={pagados}
              label="Pagados"
              detail={total > 0 ? `${Math.round((pagados / total) * 100)}% del total` : ""}
            />
            <StatTile icon={CalendarIcon} value={hoy} label="Detectados hoy" />
          </div>

          <div className="glass-surface grid grid-cols-2 gap-3 rounded-2xl p-4 md:grid-cols-[minmax(0,1.6fr)_1fr_1fr]">
            <TextField
              id="areac-search"
              icon={SearchIcon}
              type="search"
              placeholder="Buscar por targa..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="col-span-2 md:col-span-1"
            />
            <Select
              id="areac-estado"
              label="Estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              options={[{ value: "", label: "Todos" }, ...ESTADO_OPTIONS]}
            />
            <Select
              id="areac-sort"
              label="Ordenar por"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              options={SORT_OPTIONS}
            />
          </div>

          {filtered.length === 0 ? (
            <GlassCard className="text-center text-[14px] text-ink-300">
              {hasFilters
                ? "Ningún registro coincide con los filtros."
                : "Todavía no hay entradas al Área C registradas."}
            </GlassCard>
          ) : (
            <>
              <div className="glass-surface overflow-hidden rounded-2xl">
                <div className="hidden grid-cols-[1.2fr_1fr_1fr_1.5fr_auto] gap-3 px-4 py-3.5 text-[11px] font-medium uppercase tracking-wide text-ink-400 md:grid">
                  <span>Fecha y hora</span>
                  <span>Targa</span>
                  <span>Estado</span>
                  <span>Comprobante</span>
                  <span className="w-[88px] text-right">Acciones</span>
                </div>
                <ul className="border-t border-line/[0.07] md:border-t">
                  {pageItems.map((entry) => (
                    <AreaCRow
                      // key con pagado/comprobante: la fila reinicia su estado local al guardar
                      key={`${entry.id}-${entry.pagado}-${entry.comprobanteUrl ?? ""}`}
                      entry={entry}
                      onSaved={handleSaved}
                      onDelete={(e) => {
                        setDeleteError("");
                        setToDelete(e);
                      }}
                    />
                  ))}
                </ul>
              </div>

              <Pagination
                page={currentPage}
                pageCount={pageCount}
                pageSize={PAGE_SIZE}
                total={filtered.length}
                noun="registros"
                onChange={setPage}
              />
            </>
          )}
        </>
      )}

      <ConfirmModal
        open={Boolean(toDelete)}
        title="¿Eliminar este registro?"
        description={
          toDelete
            ? `Se eliminará el registro de ${toDelete.targa} del ${formatDateTime(toDelete.enteredAt)}${
                toDelete.comprobanteUrl ? " junto con su comprobante" : ""
              }. Esta acción no se puede deshacer.${
                deleteIsToday ? " Como es de hoy, no volverá a registrarse hoy aunque el vehículo siga dentro." : ""
              }`
            : ""
        }
        confirmLabel="Eliminar"
        error={deleteError}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setToDelete(null)}
      />
    </div>
  );
};
