import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ServicioPendienteRow } from "../../components/chofer/ServiciosPendientesCard";
import { StatusPill } from "../../components/chofer/StatusPill";
import { HorasEstadoChip } from "../../components/horas/HorasEstadoChip";
import { Alert } from "../../components/ui/Alert";
import { PageLoader } from "../../components/ui/PageLoader";
import { CheckCircleIcon, ChevronDownIcon, ChevronRightIcon, RouteIcon } from "../../components/ui/icons";
import { useCerrarServicio } from "../../hooks/useCerrarServicio";
import { parseApiError } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { isPending, sortPending } from "../../lib/pendientes";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { listRecordsRequest } from "../../lib/records.api";

const ROME = { timeZone: "Europe/Rome" };
const dayKey = (value) => new Date(value).toLocaleDateString("en-CA", ROME);
const monthKey = (value) => dayKey(value).slice(0, 7);
const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-AR", { month: "long", timeZone: "UTC" });
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
};

// Acordeon: el contenido solo se arma al abrirlo, asi un historial largo no pesa en el celular.
const Acordeon = ({ title, count, badge, badgeTone, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="glass-surface overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="truncate text-[16px] font-semibold text-ink-50">{title}</span>
          <span className="shrink-0 rounded-full bg-line/10 px-2.5 py-0.5 text-[12px] font-medium text-ink-300">{count}</span>
          {badge && (
            <span
              className={clsx(
                "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                badgeTone === "danger" ? "bg-danger-500/15 text-danger-500" : "bg-success-500/15 text-success-500"
              )}
            >
              {badge}
            </span>
          )}
        </span>
        <ChevronDownIcon className={clsx("h-5 w-5 shrink-0 text-ink-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-line/10">{children}</div>}
    </section>
  );
};

// Servicio ya resuelto: fila compacta que abre el detalle.
const ServicioRow = ({ service }) => {
  const location = useLocation();
  return (
    <Link
      to={`/records/${service.id}`}
      state={{ backgroundLocation: location }}
      className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-line/[0.05]"
    >
      <span className="min-w-0">
        <span className="block text-[14px] font-medium leading-snug text-ink-50">
          {service.codigo} <span className="font-normal text-ink-400">—</span> {service.destinazione}
        </span>
        <span className="mt-0.5 block text-[12px] text-ink-400">
          {formatDateTime(service.fechaRetiro ?? service.fechaServicio)}
          {service.vehicle?.targa ? ` · ${service.vehicle.targa}` : ""}
        </span>
        {service.jornada?.estado && <HorasEstadoChip estado={service.jornada.estado} className="mt-1.5" />}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <StatusPill estado={service.estado} />
        <ChevronRightIcon className="h-4 w-4 text-ink-400" />
      </span>
    </Link>
  );
};

// Servicios compactados en un solo viaje: una tarjeta con sus paradas en orden.
const ViajeGroup = ({ services }) => (
  <div className="bg-accent-500/[0.04]">
    <p className="flex items-center gap-2 px-4 pt-3 text-[12px] font-semibold text-accent-300">
      <RouteIcon className="h-3.5 w-3.5" />
      Viaje compacto · {services.length} servicios
    </p>
    <div className="flex flex-col divide-y divide-line/10">
      {services.map((service) => (
        <ServicioRow key={service.id} service={service} />
      ))}
    </div>
  </div>
);

// Agrupa los servicios de un mismo viaje (en el orden de sus paradas) y deja el resto sueltos.
const groupTrips = (items) => {
  const out = [];
  const seen = new Map();
  for (const r of items) {
    if (!r.compactado) {
      out.push({ key: r.id, services: [r] });
      continue;
    }
    let group = seen.get(r.compactado.id);
    if (!group) {
      group = { key: r.compactado.id, trip: true, services: [] };
      seen.set(r.compactado.id, group);
      out.push(group);
    }
    group.services.push(r);
  }
  for (const g of out) g.services.sort((a, b) => (a.compactado?.orden ?? 0) - (b.compactado?.orden ?? 0));
  return out;
};

const Stat = ({ label, value, tone }) => (
  <div className="glass-surface-sm rounded-2xl px-3 py-3 text-center">
    <span
      className={clsx(
        "block text-[24px] font-semibold leading-none",
        tone === "danger" ? "text-danger-500" : tone === "success" ? "text-success-500" : "text-ink-50"
      )}
    >
      {value}
    </span>
    <span className="mt-1 block text-[11px] font-medium uppercase tracking-normal text-ink-300">{label}</span>
  </div>
);

// Todos los servicios del chofer, ordenados para el celular: primero lo pendiente (con su boton para resolverlo)
// y despues el historial en un acordeon por mes.
export const MisServiciosPage = () => {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    listRecordsRequest()
      .then(setRecords)
      .catch((err) => setError(parseApiError(err).message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Al cerrar un servicio con "Guardar y salir" la lista se actualiza sola.
  const { version: recordsVersion } = useDataRefresh("records");
  const seenRecordsVersion = useRef(recordsVersion);
  useEffect(() => {
    if (seenRecordsVersion.current === recordsVersion) return;
    seenRecordsVersion.current = recordsVersion;
    load();
  }, [recordsVersion, load]);

  const actions = useCerrarServicio(load);

  const { pending, months, stats } = useMemo(() => {
    const list = records ?? [];
    const pend = list.filter(isPending).sort(sortPending);
    const pendingIds = new Set(pend.map((r) => r.id));
    // Las paradas de un viaje pendiente se ven dentro de su servicio principal, no por separado.
    const pendingTrips = new Set(pend.filter((r) => r.compactado?.principal).map((r) => r.compactado.id));
    const byMonth = new Map();
    for (const r of list) {
      if (pendingIds.has(r.id)) continue;
      if (r.compactado && pendingTrips.has(r.compactado.id)) continue;
      const key = monthKey(r.fechaServicio);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(r);
    }
    const sorted = [...byMonth.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, items]) => [key, items.sort((a, b) => new Date(b.fechaServicio) - new Date(a.fechaServicio))]);
    const today = dayKey(new Date());
    return {
      pending: pend,
      months: sorted,
      stats: {
        hoy: list.filter((r) => dayKey(r.fechaServicio) === today).length,
        mes: list.filter((r) => monthKey(r.fechaServicio) === today.slice(0, 7)).length,
      },
    };
  }, [records]);

  if (error && !records) return <Alert>{error}</Alert>;
  if (!records) return <PageLoader />;

  const currentMonth = dayKey(new Date()).slice(0, 7);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink-50">Mis servicios</h1>
        <p className="mt-0.5 text-[13px] text-ink-300">Lo pendiente primero, y tu historial por mes.</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Pendientes" value={pending.length} tone={pending.length > 0 ? "danger" : "success"} />
        <Stat label="Hoy" value={stats.hoy} />
        <Stat label="Este mes" value={stats.mes} />
      </div>

      <Alert>{error}</Alert>

      <Acordeon
        title="Pendientes"
        count={pending.length}
        badge={pending.length === 0 ? "Todo al día" : null}
        badgeTone="success"
        defaultOpen={pending.length > 0}
      >
        {pending.length === 0 ? (
          <p className="flex items-center gap-2 px-4 py-4 text-[14px] text-ink-300">
            <CheckCircleIcon className="h-5 w-5 shrink-0 text-success-500" />
            No tienes nada pendiente.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-line/10">
            {pending.map((service) => (
              <div key={service.id} className="px-4 py-4">
                <ServicioPendienteRow
                  service={service}
                  opening={actions.openingId === service.id}
                  uploading={actions.uploadingId === service.id}
                  error={actions.errors[service.id]}
                  onClose={actions.onClose(service.id)}
                  onUpload={actions.onUpload(service.id)}
                />
              </div>
            ))}
          </div>
        )}
      </Acordeon>

      {months.length === 0 && pending.length === 0 && (
        <p className="px-1 text-[14px] text-ink-300">Todavía no tienes servicios.</p>
      )}

      {months.map(([key, items]) => (
        <Acordeon key={key} title={monthLabel(key)} count={items.length} defaultOpen={key === currentMonth}>
          <div className="flex flex-col divide-y divide-line/10">
            {groupTrips(items).map((group) =>
              group.trip && group.services.length > 1 ? (
                <ViajeGroup key={group.key} services={group.services} />
              ) : (
                <ServicioRow key={group.key} service={group.services[0]} />
              )
            )}
          </div>
        </Acordeon>
      ))}

      {actions.modal}
    </div>
  );
};
