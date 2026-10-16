import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Select } from "../ui/Select";
import { SearchableSelect } from "../ui/SearchableSelect";
import { TextField } from "../ui/TextField";
import { parseApiError } from "../../lib/api";
import { listClientsRequest } from "../../lib/clients.api";
import { RECORD_STATUS_OPTIONS } from "../../lib/constants";
import { formatDate } from "../../lib/format";
import { listUsersRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

// Filtros de la lista de Registros (chofer, vehiculo/targa, cliente, estado, tipo y rango de fechas). Se combinan entre si y con el
// texto del buscador: la busqueda se hace en el servidor sobre todo el historico (no solo el mes que se esta viendo).
export const EMPTY_RECORD_FILTERS = { driverId: "", vehicleId: "", clientId: "", estado: "", spedizzione: "", from: "", to: "" };
export const countActiveFilters = (filters) => Object.values(filters).filter(Boolean).length;

const SPEDIZZIONE_OPTIONS = [
  { value: "", label: "Todos los tipos" },
  { value: "DHL", label: "DHL" },
  { value: "AB_SERVICE", label: "AB Service" },
  { value: "EXTRA_PIAZZA", label: "Extras Piazza" },
  { value: "EXTRAS_STEFANIA", label: "Otros (Extras Stefania)" },
];
const SPEDIZZIONE_LABELS = Object.fromEntries(SPEDIZZIONE_OPTIONS.map((o) => [o.value, o.label]));
const ESTADO_OPTIONS = [{ value: "", label: "Todos los estados" }, ...RECORD_STATUS_OPTIONS];

// Fechas en hora de Roma, como el resto de la app ("AAAA-MM-DD").
const romeToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
const shiftDay = (day, n) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const monthBounds = (day, deltaMonths = 0) => {
  const [y, m] = day.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  const last = new Date(Date.UTC(y, m + deltaMonths, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
};

const QUICK_RANGES = [
  { label: "Hoy", range: (t) => ({ from: t, to: t }) },
  { label: "Ayer", range: (t) => ({ from: shiftDay(t, -1), to: shiftDay(t, -1) }) },
  { label: "Ultimos 7 dias", range: (t) => ({ from: shiftDay(t, -6), to: t }) },
  { label: "Este mes", range: (t) => monthBounds(t) },
  { label: "Mes anterior", range: (t) => monthBounds(t, -1) },
];

export const RecordFilters = ({ filters, onChange, total }) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(null);
  const [error, setError] = useState("");
  const active = countActiveFilters(filters);
  const set = (patch) => onChange({ ...filters, ...patch });

  // Las listas (choferes, vehiculos, clientes) se piden solo cuando se abre el panel o hay un filtro puesto (para nombrarlo en la etiqueta).
  useEffect(() => {
    if ((!open && active === 0) || options) return undefined;
    let cancelled = false;
    Promise.all([listUsersRequest(), listVehiclesRequest(), listClientsRequest()])
      .then(([users, vehicles, clients]) => {
        if (cancelled) return;
        setOptions({
          drivers: users
            .filter((u) => ["CHOFER", "ADMIN", "OWNER"].includes(u.cargo))
            .map((u) => ({ value: u.id, label: `${u.nombre} ${u.apellido}${u.estado === "ACTIVO" ? "" : " (inactivo)"}` }))
            .sort((a, b) => a.label.localeCompare(b.label)),
          vehicles: vehicles
            .map((v) => ({ value: v.id, label: `${v.targa}${v.modelo && !/completar/i.test(v.modelo) ? ` · ${v.modelo}` : ""}` }))
            .sort((a, b) => a.label.localeCompare(b.label)),
          clients: clients.map((c) => ({ value: c.id, label: c.nombre })).sort((a, b) => a.label.localeCompare(b.label)),
        });
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [open, active, options]);

  const labelOf = (list, value) => list?.find((o) => o.value === value)?.label ?? "...";
  const chips = useMemo(
    () =>
      [
        filters.driverId && { key: "driverId", text: `Chofer: ${labelOf(options?.drivers, filters.driverId)}` },
        filters.vehicleId && { key: "vehicleId", text: `Vehiculo: ${labelOf(options?.vehicles, filters.vehicleId)}` },
        filters.clientId && { key: "clientId", text: `Cliente: ${labelOf(options?.clients, filters.clientId)}` },
        filters.estado && { key: "estado", text: `Estado: ${labelOf(ESTADO_OPTIONS, filters.estado)}` },
        filters.spedizzione && { key: "spedizzione", text: `Tipo: ${SPEDIZZIONE_LABELS[filters.spedizzione]}` },
        filters.from && { key: "from", text: `Desde ${formatDate(`${filters.from}T12:00:00`)}` },
        filters.to && { key: "to", text: `Hasta ${formatDate(`${filters.to}T12:00:00`)}` },
      ].filter(Boolean),
    [filters, options]
  );

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={clsx(
            "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-colors",
            open || active > 0 ? "border-accent-500/50 bg-accent-500/10 text-accent-300" : "border-line/20 text-ink-200 hover:bg-line/10"
          )}
        >
          Filtros
          {active > 0 && <span className="rounded-full bg-accent-500 px-1.5 text-[11px] font-semibold text-white">{active}</span>}
        </button>
        {chips.map((chip) => (
          <span key={chip.key} className="flex items-center gap-1.5 rounded-full bg-line/10 py-1 pl-3 pr-1.5 text-[12px] text-ink-100">
            {chip.text}
            <button
              type="button"
              aria-label={`Quitar ${chip.text}`}
              onClick={() => set({ [chip.key]: "" })}
              className="flex h-5 w-5 items-center justify-center rounded-full text-ink-300 hover:bg-line/20 hover:text-ink-50"
            >
              &times;
            </button>
          </span>
        ))}
        {active > 0 && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_RECORD_FILTERS)}
            className="text-[12px] font-medium text-accent-400 hover:text-accent-300"
          >
            Limpiar filtros
          </button>
        )}
        {total != null && active > 0 && <span className="ml-auto text-[12px] text-ink-400">{total} resultado{total === 1 ? "" : "s"}</span>}
      </div>

      {open && (
        <div className="rounded-2xl border border-line/10 bg-line/[0.03] p-4">
          {error && <p className="mb-3 text-[13px] text-danger-500">{error}</p>}
          {!options && !error && <p className="mb-3 text-[12px] text-ink-400">Cargando choferes, vehiculos y clientes...</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SearchableSelect
              id="filtro-chofer"
              label="Chofer"
              placeholder="Escribe un nombre"
              options={options?.drivers ?? []}
              value={filters.driverId}
              onChange={(v) => set({ driverId: v })}
            />
            <SearchableSelect
              id="filtro-vehiculo"
              label="Vehiculo (targa)"
              placeholder="Escribe la targa"
              options={options?.vehicles ?? []}
              value={filters.vehicleId}
              onChange={(v) => set({ vehicleId: v })}
              maxSuggestions={8}
            />
            <SearchableSelect
              id="filtro-cliente"
              label="Cliente"
              placeholder="Escribe un cliente"
              options={options?.clients ?? []}
              value={filters.clientId}
              onChange={(v) => set({ clientId: v })}
              maxSuggestions={8}
            />
            <Select id="filtro-estado" label="Estado" options={ESTADO_OPTIONS} value={filters.estado} onChange={(e) => set({ estado: e.target.value })} />
            <Select
              id="filtro-tipo"
              label="Tipo de servicio"
              options={SPEDIZZIONE_OPTIONS}
              value={filters.spedizzione}
              onChange={(e) => set({ spedizzione: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField id="filtro-desde" label="Desde" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} />
              <TextField id="filtro-hasta" label="Hasta" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-ink-400">Rango rapido:</span>
            {QUICK_RANGES.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => set(q.range(romeToday()))}
                className="rounded-full glass-surface-sm px-3 py-1 text-[12px] text-ink-200 hover:bg-line/10"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
