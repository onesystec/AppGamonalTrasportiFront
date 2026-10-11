import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import {
  AlertTriangleIcon,
  BellIcon,
  CheckCircleIcon,
  MapPinIcon,
  SearchIcon,
  TruckIcon,
  UserCheckIcon,
  UsersIcon,
} from "../../components/ui/icons";
import { PageLoader } from "../../components/ui/PageLoader";
import { Pagination } from "../../components/ui/Pagination";
import { AttentionGroup, PanelShell } from "../../components/ui/PanelShell";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { MetasKmCard } from "../../components/roles/MetasKmCard";
import { StatTile } from "../../components/ui/StatTile";
import { TextField } from "../../components/ui/TextField";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { AREA_OPTIONS, CARGO_LABELS, GRUPO_LABELS, GRUPO_OPTIONS } from "../../lib/constants";
import {
  computeDriverDocumentAlerts,
  computeDriverKmRanking,
  filterToMainAreas,
  isReperibilidadNoDisponibleHoy,
} from "../../lib/dashboardStats";
import { listDocumentsRequest } from "../../lib/documents.api";
import { driverInScope, getNotificationScopeRequest } from "../../lib/notifications.api";
import { PHONE_GPS_ENABLED } from "../../lib/features";
import { setListSearch, useListSearch } from "../../lib/listSearchStore";
import { listRecordsByMonthRequest } from "../../lib/records.api";
import { currentMonth } from "../../lib/finanzas";
import { listDriversProgressRequest } from "../../lib/metas.api";
import { nivelLabel, userAreaKeys } from "../../lib/roles";
import { listUsersRequest } from "../../lib/users.api";

const areaLabel = (value) => AREA_OPTIONS.find((opt) => opt.value === value)?.label ?? value;
const centroLabel = (grupo) => (grupo ? GRUPO_LABELS[grupo] ?? grupo : "Sin grupo");
const fmtKm = (km) => Math.round(km).toLocaleString("es-AR");
const fullName = (driver) => `${driver.nombre} ${driver.apellido}`;
const isActive = (driver) => driver.estado === "ACTIVO";

const ESTADO_OPTIONS = [
  { value: "ACTIVO", label: "Activos" },
  { value: "INACTIVO", label: "Inactivos" },
];
const SORT_OPTIONS = [
  { value: "nombre", label: "Nombre" },
  { value: "centro", label: "Centro" },
  { value: "km", label: "Km del mes" },
];
const VIEW_OPTIONS = [
  { value: "tabla", label: "Tabla" },
  { value: "tarjetas", label: "Tarjetas" },
];
const VIEW_STORAGE_KEY = "gt_drivers_view";
const PAGE_SIZE_TABLE = 10;
const PAGE_SIZE_CARDS = 9;

// Tabla en escritorio; en celular arranca en tarjetas (seis columnas no entran).
const initialView = () => {
  try {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === "tabla" || saved === "tarjetas") return saved;
  } catch {
    // sin almacenamiento disponible: se usa el valor por defecto
  }
  return typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches ? "tarjetas" : "tabla";
};

const PhoneIcon = ({ className }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
    <path d="M6.6 2.5c.4 0 .77.25.9.63l.85 2.36c.13.36.03.77-.25 1.03l-1.3 1.2c-.2.18-.25.47-.13.71a10.9 10.9 0 0 0 4.9 4.9c.24.12.53.07.71-.13l1.2-1.3c.26-.28.67-.38 1.03-.25l2.36.85c.38.13.63.5.63.9v2.05c0 1.02-.94 1.77-1.93 1.5A15.9 15.9 0 0 1 3.55 5.43a15.7 15.7 0 0 1-.55-3c0-.99.75-1.93 1.5-1.93H6.6z" />
  </svg>
);

// Avatar con un punto verde si el chofer esta compartiendo su ubicacion.
const DriverAvatar = ({ driver, className }) => (
  <div className="relative shrink-0">
    <Avatar user={driver} className={className} />
    {PHONE_GPS_ENABLED && driver.compartirUbicacion && isActive(driver) && (
      <span
        title="Compartiendo ubicación"
        className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success-500 ring-2 ring-[var(--glass-surface-bg)]"
      />
    )}
  </div>
);

// Activo = verde (correcto); inactivo es neutral, no un problema.
const DriverStatusBadge = ({ driver, className }) => (
  <span
    className={clsx(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap",
      isActive(driver) ? "bg-success-500/15 text-success-500" : "bg-line/10 text-ink-300",
      className
    )}
  >
    <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", isActive(driver) ? "bg-success-500" : "bg-ink-400")} />
    {isActive(driver) ? "Activo" : "Inactivo"}
  </span>
);

const PhoneLink = ({ driver }) =>
  driver.numeroCelular ? (
    <a
      href={`tel:${driver.numeroCelular.replace(/\s+/g, "")}`}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Llamar a ${fullName(driver)}`}
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-ink-200 hover:text-accent-400"
    >
      <PhoneIcon className="h-3.5 w-3.5 shrink-0 text-ink-400" />
      {driver.numeroCelular}
    </a>
  ) : (
    <span className="text-ink-400">—</span>
  );

// ---------------------------------------------------------------------------
// Vista de tarjetas (agrupada por centro; los inactivos van aparte al final)
// ---------------------------------------------------------------------------

// state: backgroundLocation - para que App.jsx renderice el detalle como overlay
// sobre esta lista (que sigue montada), en vez de reemplazarla (ver App.jsx).
const DriverCard = ({ driver }) => {
  const location = useLocation();
  return (
    <Link to={`/choferes/${driver.id}`} state={{ backgroundLocation: location }} className="block">
      <GlassCard className="!rounded-2xl !p-4 transition-colors hover:bg-line/[0.06]">
        <div className="flex items-center gap-3">
          <DriverAvatar driver={driver} className="h-10 w-10 text-[13px]" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[14px] font-medium text-ink-50">{fullName(driver)}</h2>
            <p className="truncate text-[12px] text-ink-300">{driver.correoElectronico}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-ink-400">
            {driver.cargo !== "CHOFER" ? `${CARGO_LABELS[driver.cargo]} · ` : ""}
            {nivelLabel(driver.nivelChofer) ? `${nivelLabel(driver.nivelChofer)} · ` : ""}
            {areaLabel(driver.area)}
          </span>
          <DriverStatusBadge driver={driver} className="shrink-0 !px-2 !py-0.5 !text-[11px]" />
        </div>
      </GlassCard>
    </Link>
  );
};

// @container (no breakpoints de viewport): la grilla vive en una columna que no es el
// ancho completo, asi que las variantes @sm/@xl miran el ancho real disponible.
const GroupSection = ({ title, members }) => (
  <div className="@container flex flex-col gap-3">
    <h2 className="text-[13px] font-medium uppercase tracking-wide text-ink-300">
      {title} <span className="text-ink-500">({members.length})</span>
    </h2>
    <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2 @xl:grid-cols-3">
      {members.map((driver) => (
        <DriverCard key={driver.id} driver={driver} />
      ))}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Vista de tabla
// ---------------------------------------------------------------------------

// "1.240 / 2.500 km" con una barra de avance si el nivel del chofer ya tiene meta.
const KmMeta = ({ km, progress }) => {
  if (!progress?.meta) return <>{km ? fmtKm(km) : "—"}</>;
  const pct = Math.min(100, progress.porcentaje ?? 0);
  return (
    <div className="ml-auto flex w-36 flex-col items-end gap-1">
      <span>
        {fmtKm(progress.km)} <span className="text-ink-400">/ {fmtKm(progress.meta)}</span>
      </span>
      <span className="block h-1.5 w-full overflow-hidden rounded-full bg-line/15">
        <span
          className={`block h-full rounded-full ${progress.cumplida ? "bg-success-500" : "bg-accent-400"}`}
          style={{ width: `${pct}%` }}
        />
      </span>
    </div>
  );
};

const DriverTable = ({ drivers, kmByDriver, progressByDriver, onServiceIds }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const open = (id) => navigate(`/choferes/${id}`, { state: { backgroundLocation: location } });

  return (
    <div className="glass-surface overflow-x-auto rounded-2xl">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-ink-400">
            <th className="py-3.5 pl-4 pr-2 font-medium">Chofer</th>
            <th className="px-2 py-3.5 font-medium">Centro</th>
            <th className="px-2 py-3.5 font-medium">Vehículo</th>
            <th className="px-2 py-3.5 font-medium">Teléfono</th>
            <th className="px-2 py-3.5 font-medium">Nivel</th>
            <th className="px-2 py-3.5 text-right font-medium">Km mes / meta</th>
            <th className="py-3.5 pl-2 pr-4 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((driver) => {
            const km = kmByDriver?.get(driver.id);
            return (
              <tr
                key={driver.id}
                onClick={() => open(driver.id)}
                className="cursor-pointer border-t border-line/[0.07] transition-colors hover:bg-line/[0.04]"
              >
                <td className="py-3 pl-4 pr-2">
                  <div className="flex items-center gap-3">
                    <DriverAvatar driver={driver} className="h-9 w-9 text-[12px]" />
                    <div className="min-w-0 max-w-[190px]">
                      <Link
                        to={`/choferes/${driver.id}`}
                        state={{ backgroundLocation: location }}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate font-medium text-ink-50 hover:text-accent-400"
                      >
                        {fullName(driver)}
                        {driver.cargo !== "CHOFER" && (
                          <span className="ml-2 rounded-full bg-accent-500/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-400">
                            {CARGO_LABELS[driver.cargo]}
                          </span>
                        )}
                      </Link>
                      <span className="block truncate text-[12px] text-ink-400">{driver.correoElectronico}</span>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-ink-200">{centroLabel(driver.grupo)}</td>
                <td className="whitespace-nowrap px-2 py-3 text-ink-100">
                  {driver.vehiculoAsignado ? (
                    <span className="inline-flex items-center gap-1.5">
                      <TruckIcon className="h-3.5 w-3.5 text-ink-400" />
                      {driver.vehiculoAsignado.targa}
                    </span>
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </td>
                <td className="px-2 py-3">
                  <PhoneLink driver={driver} />
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-ink-200">
                  {nivelLabel(driver.nivelChofer) ?? <span className="text-ink-400">—</span>}
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums text-ink-100">
                  <KmMeta km={km} progress={progressByDriver?.get(driver.id)} />
                </td>
                <td className="py-3 pl-2 pr-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <DriverStatusBadge driver={driver} />
                    {onServiceIds?.has(driver.id) && (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-500/15 px-2.5 py-1 text-[12px] font-medium text-accent-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
                        En servicio
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Columna derecha
// ---------------------------------------------------------------------------

// Documentos por vencer / vencidos y choferes sin permiso de ubicacion "todo el
// tiempo" - mismas reglas que la campanita (computeDriverDocumentAlerts).
const AttentionPanel = ({ drivers, documents }) => {
  const location = useLocation();
  const state = { backgroundLocation: location };

  const { docs, permisos } = useMemo(() => {
    const now = new Date();
    const docs = documents
      ? computeDriverDocumentAlerts(documents, drivers).map((alert) => ({
          key: alert.id,
          to: alert.link,
          state,
          tone: new Date(alert.date) < now ? "danger" : "warning",
          title: alert.message,
        }))
      : null;

    const permisos = (PHONE_GPS_ENABLED ? drivers : [])
      .filter((d) => d.cargo === "CHOFER" && isActive(d) && d.ubicacionPermisoDenegado)
      .map((d) => ({
        key: `permiso-${d.id}`,
        to: `/choferes/${d.id}`,
        state,
        tone: "warning",
        title: fullName(d),
        detail: 'Sin permiso de ubicación "todo el tiempo"',
      }));

    return { docs, permisos };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivers, documents]);

  const total = (docs?.length ?? 0) + permisos.length;

  return (
    <PanelShell
      icon={BellIcon}
      title="Atención requerida"
      aside={
        total > 0 ? (
          <span className="rounded-full bg-warning-500/15 px-2 py-0.5 text-[12px] font-medium text-warning-500">
            {total}
          </span>
        ) : null
      }
    >
      {docs === null ? (
        <div className="flex justify-center py-4">
          <Spinner className="h-5 w-5 border-line/20 border-t-line" />
        </div>
      ) : total === 0 ? (
        <p className="flex items-center gap-2 py-2 text-[13px] text-ink-300">
          <CheckCircleIcon className="h-5 w-5 text-success-500" />
          Todo en orden: ningún chofer necesita atención.
        </p>
      ) : (
        <div className="flex max-h-[300px] flex-col gap-4 overflow-y-auto pr-1">
          <AttentionGroup title="Documentos" items={docs} />
          <AttentionGroup title="Ubicación" items={permisos} />
        </div>
      )}
    </PanelShell>
  );
};

// Cuantas personas hay en cada centro y cuantas estan activas.
const CenterSummaryPanel = ({ drivers }) => {
  const centers = [...GRUPO_OPTIONS.map((g) => g.value), null]
    .map((grupo) => {
      const members = drivers.filter((d) => (d.grupo ?? null) === grupo);
      return {
        label: centroLabel(grupo),
        total: members.length,
        activos: members.filter(isActive).length,
      };
    })
    .filter((c) => c.total > 0);

  return (
    <PanelShell icon={MapPinIcon} title="Resumen por centro">
      <ul className="flex flex-col gap-2.5">
        {centers.map((c) => (
          <li key={c.label} className="rounded-xl border border-line/[0.07] px-3.5 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-medium text-ink-50">{c.label}</span>
              <span className="text-[12px] text-ink-400">
                {c.total} {c.total === 1 ? "persona" : "personas"}
              </span>
            </div>
            <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-line/10">
              <span className="bg-success-500" style={{ width: `${(c.activos / c.total) * 100}%` }} />
            </div>
            <div className="mt-2 flex items-center gap-3 text-[12px] text-ink-300">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                {c.activos} activos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-ink-400" />
                {c.total - c.activos} inactivos
              </span>
            </div>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
};

const KM_BREAKDOWN_ROWS = [
  { key: "EXTRA_PIAZZA", label: "Extras Piazza", multiplier: 1 },
  { key: "DHL", label: "DHL", multiplier: 2 },
  { key: "AB_SERVICE", label: "AB Service", multiplier: 2 },
];

// Desglose de KM del mes por tipo de servicio, con el x2 de DHL/AB Service
// visible por separado (ver kmMultiplier en dashboardStats.js) en vez de solo
// el total ya ponderado.
const DriverKmModal = ({ entry, onClose }) => {
  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-backdrop backdrop-blur-sm"
      />
      <div className="glass-surface relative z-10 w-full max-w-sm rounded-3xl bg-background p-6">
        <h2 className="text-[17px] font-semibold text-ink-50">{entry.nombre}</h2>
        <p className="mt-1 text-[13px] text-ink-400">KM recorridos este mes, por tipo de servicio.</p>

        <div className="mt-4 flex flex-col gap-2">
          {KM_BREAKDOWN_ROWS.map(({ key, label, multiplier }) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-xl glass-surface-sm px-3 py-2 text-[13px]"
            >
              <span className="text-ink-50">{label}</span>
              <span className="text-ink-300">
                {fmtKm(entry.breakdown[key])} km{multiplier > 1 ? ` x2 = ${fmtKm(entry.breakdown[key] * multiplier)} km` : ""}
              </span>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between rounded-xl bg-line/5 px-3 py-2 text-[13px] font-medium">
            <span className="text-ink-50">Total</span>
            <span className="text-ink-50">{fmtKm(entry.km)} km</span>
          </div>
        </div>

        <Button variant="ghost" className="mt-6" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>,
    document.body
  );
};

// Top de choferes por KM recorrido este mes (planificado o real, ver
// computeDriverKmRanking). Acotado a las 5 areas principales (ver filterToMainAreas),
// mismo criterio que el resto de la app.
const DriverRankingPanel = ({ records }) => {
  const { user } = useAuth();
  const areaKeys = userAreaKeys(user);
  const ranking = records ? computeDriverKmRanking(filterToMainAreas(records, areaKeys), "mes").slice(0, 10) : undefined;
  const [selectedEntry, setSelectedEntry] = useState(null);

  return (
    <PanelShell icon={UsersIcon} title="Ranking de choferes">
      <p className="-mt-1 mb-3 text-[12px] text-ink-400">Km recorridos este mes, de mayor a menor.</p>

      <div className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto pr-1">
        {ranking === undefined && (
          <div className="flex justify-center py-6">
            <Spinner className="h-5 w-5 border-line/20 border-t-line" />
          </div>
        )}
        {ranking?.length === 0 && (
          <p className="py-3 text-center text-[13px] text-ink-300">Sin servicios este mes todavía.</p>
        )}
        {ranking?.map((entry, idx) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setSelectedEntry(entry)}
            className="flex items-center gap-3 rounded-xl border border-line/[0.07] px-3 py-2 text-left text-[13px] transition-colors hover:bg-line/[0.05]"
          >
            <span className="w-4 shrink-0 text-center text-[12px] font-medium text-ink-400">{idx + 1}</span>
            <span className="min-w-0 flex-1 truncate text-ink-50">{entry.nombre}</span>
            <span className="shrink-0 text-[12px] text-ink-300">{fmtKm(entry.km)} km</span>
          </button>
        ))}
      </div>

      {selectedEntry && <DriverKmModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />}
    </PanelShell>
  );
};

// ---------------------------------------------------------------------------
// Pagina
// ---------------------------------------------------------------------------

const todosOption = (label, options) => [{ value: "", label }, ...options];

export const DriversPage = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  // Recursos Humanos ve y gestiona choferes, pero no la operacion (servicios, metas de km, rankings).
  const isRrhh = user?.cargo === "RRHH";
  const canAccess = isPrivileged || isRrhh;
  const { version: driversVersion } = useDataRefresh("drivers");
  const { version: recordsVersion } = useDataRefresh("records");

  const [drivers, setDrivers] = useState(null);
  const [monthlyRecords, setMonthlyRecords] = useState(null);
  const [documents, setDocuments] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  const [view, setView] = useState(initialView);
  const [centro, setCentro] = useState("");
  const [area, setArea] = useState("");
  const [estado, setEstado] = useState("");
  const [sort, setSort] = useState("nombre");
  const [page, setPage] = useState(1);

  // La barra superior y la de la pagina comparten el mismo texto (ver listSearchStore).
  const query = useListSearch();
  const setQuery = setListSearch;

  // Al salir de Choferes se limpia la busqueda.
  useEffect(() => () => setListSearch(""), []);

  const changeView = (next) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // sin almacenamiento disponible: la vista solo dura esta sesion
    }
  };

  useEffect(() => {
    if (!canAccess) return;
    listUsersRequest()
      .then(setDrivers)
      .catch((err) => setError(parseApiError(err).message));
  }, [canAccess, driversVersion]);

  // Depende tambien de recordsVersion: el ranking y los km por chofer salen de los
  // registros del mes, no de los choferes - si se edita un km desde el detalle de un
  // registro, esto tiene que reflejarse aca tambien.
  useEffect(() => {
    if (!isPrivileged) return;
    const now = new Date();
    listRecordsByMonthRequest(now.getFullYear(), now.getMonth() + 1)
      .then(setMonthlyRecords)
      .catch((err) => setError(parseApiError(err).message));
  }, [isPrivileged, recordsVersion]);

  // Km del mes y avance contra la meta de cada nivel (el servidor suma los km completos del chofer).
  useEffect(() => {
    if (!isPrivileged) return;
    listDriversProgressRequest(currentMonth())
      .then(setProgress)
      .catch((err) => setError(parseApiError(err).message));
  }, [isPrivileged, recordsVersion, driversVersion]);

  useEffect(() => {
    if (!canAccess) return;
    listDocumentsRequest()
      .then(setDocuments)
      .catch((err) => setError(parseApiError(err).message));
  }, [canAccess]);

  // Los avisos de documentos por vencer son solo de los choferes de la asignacion de quien mira (un Responsable); el Admin ve todos.
  const [scope, setScope] = useState(null);
  useEffect(() => {
    if (!isPrivileged) return;
    getNotificationScopeRequest(user?.id)
      .then(setScope)
      .catch(() => setScope({ todo: true }));
  }, [isPrivileged, user?.id]);
  const alertDrivers = useMemo(() => (drivers && scope ? drivers.filter((d) => driverInScope(scope, d.id)) : null), [drivers, scope]);

  const progressByDriver = useMemo(
    () => (progress ? new Map(progress.items.map((item) => [item.id, item])) : null),
    [progress]
  );
  const kmByDriver = useMemo(
    () => (progress ? new Map(progress.items.map((item) => [item.id, item.km])) : null),
    [progress]
  );

  const filtered = useMemo(() => {
    if (!drivers) return [];
    const needle = query.trim().toLowerCase();

    const list = drivers.filter((d) => {
      if (centro && (centro === "SIN_GRUPO" ? d.grupo : d.grupo !== centro)) return false;
      if (area && d.area !== area) return false;
      if (estado === "ACTIVO" && !isActive(d)) return false;
      if (estado === "INACTIVO" && isActive(d)) return false;
      if (!needle) return true;
      const haystack = [
        fullName(d),
        d.correoElectronico,
        d.numeroCelular,
        centroLabel(d.grupo),
        areaLabel(d.area),
        d.vehiculoAsignado?.targa,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });

    // Los activos van primero; despues, el orden elegido.
    return [...list].sort((a, b) => {
      if (isActive(a) !== isActive(b)) return isActive(a) ? -1 : 1;
      if (sort === "km") return (kmByDriver?.get(b.id) ?? 0) - (kmByDriver?.get(a.id) ?? 0);
      if (sort === "centro") {
        return centroLabel(a.grupo).localeCompare(centroLabel(b.grupo), "es") || fullName(a).localeCompare(fullName(b), "es");
      }
      return fullName(a).localeCompare(fullName(b), "es");
    });
  }, [drivers, query, centro, area, estado, sort, kmByDriver]);

  // Tramo visible: la tabla muestra 10 por pagina, las tarjetas 9 (grilla de 3 columnas).
  const pageSize = view === "tabla" ? PAGE_SIZE_TABLE : PAGE_SIZE_CARDS;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Al cambiar busqueda, filtros, orden o vista se vuelve a la primera pagina.
  useEffect(() => {
    setPage(1);
  }, [query, centro, area, estado, sort, view]);

  if (!canAccess) return <Navigate to="/" replace />;

  const hasFilters = Boolean(query.trim() || centro || area || estado);
  const total = drivers?.length ?? 0;
  const activos = drivers?.filter(isActive).length ?? 0;
  // Disponibilidad hoy: choferes activos que no estan en un servicio en camino ahora ni se
  // marcaron "no disponible" para hoy (reperibilidad) - quienes pueden tomar el proximo pedido.
  const onServiceIds = monthlyRecords
    ? new Set(monthlyRecords.filter((r) => r.estado === "IN_CONSEGNA" && r.driver?.id).map((r) => r.driver.id))
    : null;
  const choferesActivos = drivers?.filter((d) => d.cargo === "CHOFER" && isActive(d)) ?? [];
  const enServicio = onServiceIds ? choferesActivos.filter((d) => onServiceIds.has(d.id)).length : 0;
  const noDisponibles = choferesActivos.filter((d) => isReperibilidadNoDisponibleHoy(d)).length;
  const disponibles = onServiceIds
    ? choferesActivos.filter((d) => !onServiceIds.has(d.id) && !isReperibilidadNoDisponibleHoy(d)).length
    : null;
  const docAlerts = alertDrivers && documents ? computeDriverDocumentAlerts(documents, alertDrivers).length : null;
  const pct = (n) => (total > 0 ? `${Math.round((n / total) * 100)}% del equipo` : "");

  const groups = [
    ...GRUPO_OPTIONS.map((g) => ({ title: g.label, members: pageItems.filter((d) => isActive(d) && d.grupo === g.value) })),
    { title: "Sin grupo", members: pageItems.filter((d) => isActive(d) && !d.grupo) },
    { title: "Inactivos", members: pageItems.filter((d) => !isActive(d)) },
  ].filter((g) => g.members.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink-50">Choferes</h1>
          <p className="mt-1 text-[14px] text-ink-300">Gestiona y monitorea a tu equipo en tiempo real.</p>
        </div>
        <Link to="/choferes/new" state={{ backgroundLocation: location }}>
          <Button className="!w-auto px-5">+ Nuevo chofer</Button>
        </Link>
      </div>

      <Alert>{error}</Alert>

      {drivers === null && !error && <PageLoader />}

      {drivers?.length === 0 && (
        <GlassCard className="text-center text-[14px] text-ink-300">Todavía no hay choferes cargados.</GlassCard>
      )}

      {drivers !== null && drivers.length > 0 && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_310px] xl:items-start">
          <div className="flex min-w-0 flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <StatTile icon={UsersIcon} value={total} label="Total del equipo" />
              <StatTile icon={CheckCircleIcon} tone="success" value={activos} label="Activos" detail={pct(activos)} />
              {!isRrhh && (
              <StatTile
                icon={UserCheckIcon}
                value={disponibles ?? "…"}
                label="Choferes disponibles hoy"
                detail={
                  disponibles === null
                    ? ""
                    : `${enServicio} en servicio · ${noDisponibles} no disponible${noDisponibles === 1 ? "" : "s"}`
                }
              />
              )}
              <StatTile
                icon={AlertTriangleIcon}
                tone={docAlerts > 0 ? "warning" : "neutral"}
                value={docAlerts ?? "…"}
                label="Documentos por vencer"
                detail="Próximos 30 días"
              />
            </div>

            {!isRrhh && (
              <MetasKmCard
                metas={progress?.metas}
                canEdit={user?.cargo === "OWNER"}
                onSaved={(metas) => {
                  setProgress((prev) => (prev ? { ...prev, metas } : prev));
                  // Los avances de cada chofer se recalculan con la meta nueva.
                  listDriversProgressRequest(currentMonth()).then(setProgress).catch(() => {});
                }}
              />
            )}

            <div className="glass-surface grid grid-cols-2 gap-3 rounded-2xl p-4 md:grid-cols-4">
              <TextField
                id="drivers-search"
                icon={SearchIcon}
                type="search"
                placeholder="Buscar chofer, correo, teléfono..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="col-span-2 md:col-span-4"
              />
              <Select
                id="drivers-centro"
                label="Centro"
                value={centro}
                onChange={(e) => setCentro(e.target.value)}
                options={todosOption("Todos", [
                  ...GRUPO_OPTIONS.map((g) => ({ value: g.value, label: g.label })),
                  { value: "SIN_GRUPO", label: "Sin grupo" },
                ])}
              />
              <Select
                id="drivers-area"
                label="Área"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                options={todosOption("Todas", AREA_OPTIONS)}
              />
              <Select
                id="drivers-estado"
                label="Estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                options={todosOption("Todos", ESTADO_OPTIONS)}
              />
              <Select
                id="drivers-sort"
                label="Ordenar por"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                options={SORT_OPTIONS}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-ink-400">
                {hasFilters ? `${filtered.length} de ${total} personas coinciden` : `${total} personas en el equipo`}
              </p>
              <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={changeView} />
            </div>

            {filtered.length === 0 ? (
              <GlassCard className="text-center text-[14px] text-ink-300">
                Ningún chofer coincide con los filtros.
              </GlassCard>
            ) : view === "tabla" ? (
              <DriverTable
                drivers={pageItems}
                kmByDriver={kmByDriver}
                progressByDriver={progressByDriver}
                onServiceIds={onServiceIds}
              />
            ) : (
              <div className="flex flex-col gap-7">
                {groups.map((g) => (
                  <GroupSection key={g.title} title={g.title} members={g.members} />
                ))}
              </div>
            )}

            {filtered.length > 0 && (
              <Pagination
                page={currentPage}
                pageCount={pageCount}
                pageSize={pageSize}
                total={filtered.length}
                noun="personas"
                onChange={setPage}
              />
            )}
            {hasFilters && filtered.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCentro("");
                  setArea("");
                  setEstado("");
                  setQuery("");
                }}
                className="self-start text-[13px] font-medium text-accent-400 hover:text-accent-300"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <aside className="flex flex-col gap-5 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto xl:pr-1">
            <AttentionPanel drivers={alertDrivers ?? []} documents={documents} />
            <CenterSummaryPanel drivers={drivers} />
            {!isRrhh && <DriverRankingPanel records={monthlyRecords} />}
          </aside>
        </div>
      )}
    </div>
  );
};
