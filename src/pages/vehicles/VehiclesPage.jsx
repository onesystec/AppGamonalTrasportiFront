import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  BellIcon,
  CheckCircleIcon,
  MapPinIcon,
  RouteIcon,
  SearchIcon,
  TruckIcon,
} from "../../components/ui/icons";
import { PageLoader } from "../../components/ui/PageLoader";
import { Pagination } from "../../components/ui/Pagination";
import { AttentionGroup, PanelShell } from "../../components/ui/PanelShell";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { StatTile } from "../../components/ui/StatTile";
import { Switch } from "../../components/ui/Switch";
import { TextField } from "../../components/ui/TextField";
import { VehicleStatusBadge } from "../../components/ui/VehicleStatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import {
  GRUPO_LABELS,
  GRUPO_OPTIONS,
  TAGLIANDO_STATUS_LABELS,
  VEHICLE_AREA_OPTIONS,
  VEHICLE_STATUS_OPTIONS,
  getTagliandoStatus,
} from "../../lib/constants";
import { computeVehicleDocumentAlerts } from "../../lib/dashboardStats";
import { getKmRankingRequest } from "../../lib/finanzas.api";
import { SpeedingAlertsPanel } from "../../components/vehicles/SpeedingAlertsPanel";
import { getNotificationScopeRequest, vehicleInScope } from "../../lib/notifications.api";
import { listVehiclesRequest, setMapaVisibilityRequest, syncVehiclesFromVelocityFleetRequest } from "../../lib/vehicles.api";
import { setListSearch, useListSearch } from "../../lib/listSearchStore";

const areaLabel = (value) => VEHICLE_AREA_OPTIONS.find((opt) => opt.value === value)?.label ?? value;
const centroLabel = (grupo) => (grupo ? GRUPO_LABELS[grupo] ?? grupo : "Sin grupo");
const fmtKm = (km) => Math.round(km).toLocaleString("es-AR");
const conductorLabel = (vehicle) => vehicle.conductores?.map((c) => c.nombre).join(", ") || "—";

const SORT_OPTIONS = [
  { value: "targa", label: "Matrícula" },
  { value: "km", label: "Kilómetros" },
  { value: "modelo", label: "Modelo" },
];
const VIEW_OPTIONS = [
  { value: "tabla", label: "Tabla" },
  { value: "tarjetas", label: "Tarjetas" },
];
const VIEW_STORAGE_KEY = "gt_vehicles_view";

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

// Miniatura rectangular del vehiculo (o el icono de camion si no hay foto cargada).
const VehicleThumb = ({ vehicle, className }) =>
  vehicle.imagenUrl ? (
    <img
      src={vehicle.imagenUrl}
      alt={vehicle.targa}
      loading="lazy"
      className={clsx("shrink-0 rounded-lg bg-line/5 object-cover", className)}
    />
  ) : (
    <div className={clsx("flex shrink-0 items-center justify-center rounded-lg bg-line/5 text-ink-400", className)}>
      <TruckIcon className="h-5 w-5" />
    </div>
  );

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Vista de tarjetas (agrupada por centro, como antes)
// ---------------------------------------------------------------------------

const VehicleCard = ({ vehicle, onToggleMap }) => {
  const location = useLocation();
  return (
    <Link to={`/vehiculos/${vehicle.id}`} state={{ backgroundLocation: location }} className="block">
      <GlassCard className="!rounded-2xl !p-4 transition-colors hover:bg-line/[0.06]">
        <div className="flex items-center gap-3">
          <VehicleThumb vehicle={vehicle} className="h-10 w-14" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[14px] font-medium text-ink-50">{vehicle.modelo}</h2>
            <p className="truncate text-[12px] text-ink-300">{vehicle.targa}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-ink-400">{areaLabel(vehicle.area)}</span>
          <VehicleStatusBadge status={vehicle.estado} className="shrink-0 !px-2 !py-0.5 !text-[11px]" />
        </div>

        {onToggleMap && (
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/[0.07] pt-3">
            <span className="text-[11px] text-ink-400">{vehicle.mostrarEnMapa === false ? "Oculto en el mapa" : "Visible en el mapa"}</span>
            <MapaSwitch vehicle={vehicle} onToggle={onToggleMap} />
          </div>
        )}
      </GlassCard>
    </Link>
  );
};

// @container (no breakpoints de viewport): la grilla vive en una columna que no es el
// ancho completo, asi que las variantes @sm/@md/@xl miran el ancho real disponible.
const GroupSection = ({ title, members, onToggleMap }) => (
  <div className="@container flex flex-col gap-3">
    <h2 className="text-[13px] font-medium uppercase tracking-wide text-ink-300">
      {title} <span className="text-ink-500">({members.length})</span>
    </h2>
    <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2 @xl:grid-cols-3">
      {members.map((vehicle) => (
        <VehicleCard key={vehicle.id} vehicle={vehicle} onToggleMap={onToggleMap} />
      ))}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Vista de tabla
// ---------------------------------------------------------------------------

// Interruptor "se ve en el Mapa" de cada vehiculo. Lo guarda la pagina (onToggle) al tocarlo, sin entrar a editar. Los importados solos de Velocity
// Fleet (que pueden ser de otras empresas de la cuenta, como UNIVEX) nacen apagados.
const MapaSwitch = ({ vehicle, onToggle }) => (
  <div
    onClick={(e) => {
      // Dentro de una tarjeta que es un enlace: tocar el interruptor no abre la ficha.
      e.preventDefault();
      e.stopPropagation();
    }}
    className="flex justify-center"
  >
    <Switch id={`mapa-${vehicle.id}`} checked={vehicle.mostrarEnMapa !== false} onChange={(value) => onToggle([vehicle.id], value)} />
  </div>
);

const VehicleTable = ({ vehicles, onToggleMap }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const open = (id) => navigate(`/vehiculos/${id}`, { state: { backgroundLocation: location } });

  return (
    <div className="glass-surface overflow-x-auto rounded-2xl">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-ink-400">
            <th className="py-3.5 pl-4 pr-2 font-medium">Vehículo</th>
            <th className="px-2 py-3.5 font-medium">Matrícula</th>
            <th className="px-2 py-3.5 font-medium">Centro</th>
            <th className="px-2 py-3.5 font-medium">Conductor</th>
            <th className="px-2 py-3.5 text-right font-medium">Km</th>
            {onToggleMap && <th className="px-2 py-3.5 text-center font-medium">En el mapa</th>}
            <th className="py-3.5 pl-2 pr-4 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((vehicle) => (
            <tr
              key={vehicle.id}
              onClick={() => open(vehicle.id)}
              className="cursor-pointer border-t border-line/[0.07] transition-colors hover:bg-line/[0.04]"
            >
              <td className="py-3 pl-4 pr-2">
                <div className="flex items-center gap-3">
                  <VehicleThumb vehicle={vehicle} className="h-9 w-12" />
                  <div className="min-w-0 max-w-[170px]">
                    <Link
                      to={`/vehiculos/${vehicle.id}`}
                      state={{ backgroundLocation: location }}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate font-medium text-ink-50 hover:text-accent-400"
                    >
                      {vehicle.modelo}
                    </Link>
                    <span className="block truncate text-[12px] text-ink-400">{areaLabel(vehicle.area)}</span>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-2 py-3 font-medium text-ink-100">{vehicle.targa}</td>
              <td className="whitespace-nowrap px-2 py-3 text-ink-200">{centroLabel(vehicle.grupo)}</td>
              <td className="max-w-[140px] truncate px-2 py-3 text-ink-200" title={conductorLabel(vehicle)}>{conductorLabel(vehicle)}</td>
              <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums text-ink-100">
                {vehicle.kmActual != null ? fmtKm(vehicle.kmActual) : "—"}
              </td>
              {onToggleMap && (
                <td className="px-2 py-3">
                  <MapaSwitch vehicle={vehicle} onToggle={onToggleMap} />
                </td>
              )}
              <td className="py-3 pl-2 pr-4">
                <VehicleStatusBadge status={vehicle.estado} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Columna derecha
// ---------------------------------------------------------------------------

// Documentos por vencer (poliza / revision tecnica), Tagliando proximo o urgente y
// vehiculos que no estan disponibles - todo con lo que ya trae la lista de vehiculos.
const AttentionPanel = ({ vehicles }) => {
  const location = useLocation();
  const state = { backgroundLocation: location };

  const { documents, tagliando, unavailable } = useMemo(() => {
    const now = new Date();
    const documents = computeVehicleDocumentAlerts(vehicles).map((alert) => ({
      key: alert.id,
      to: alert.link,
      state,
      tone: new Date(alert.date) < now ? "danger" : "warning",
      title: alert.message,
    }));

    const tagliando = vehicles
      .map((v) => ({ vehicle: v, status: getTagliandoStatus(v.kmUltimoMantenimiento, v.kmActual) }))
      .filter((item) => item.status && item.status.level !== "ok")
      .sort((a, b) =>
        a.status.level !== b.status.level
          ? a.status.level === "urgente"
            ? -1
            : 1
          : a.status.restante - b.status.restante
      )
      .map(({ vehicle, status }) => ({
        key: `tagliando-${vehicle.id}`,
        to: `/vehiculos/${vehicle.id}`,
        state,
        tone: status.level === "urgente" ? "danger" : "warning",
        title: `${vehicle.targa} - ${vehicle.modelo}`,
        detail: `${TAGLIANDO_STATUS_LABELS[status.level]} - ${fmtKm(status.restante)} km restantes`,
      }));

    const unavailable = vehicles
      .filter((v) => v.estado !== "DISPONIBLE")
      .map((v) => ({
        key: `estado-${v.id}`,
        to: `/vehiculos/${v.id}`,
        state,
        tone: v.estado === "FUERA_DE_SERVICIO" ? "danger" : "warning",
        title: `${v.targa} - ${v.modelo}`,
        detail: v.estado === "FUERA_DE_SERVICIO" ? "Fuera de servicio" : "En mantenimiento",
      }));

    return { documents, tagliando, unavailable };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles]);

  const total = documents.length + tagliando.length + unavailable.length;

  return (
    <PanelShell
      icon={BellIcon}
      title="Atención requerida"
      aside={
        total > 0 ? (
          <span className="rounded-full bg-warning-500/10 px-2 py-0.5 text-[12px] font-medium text-warning-500">
            {total}
          </span>
        ) : null
      }
    >
      {total === 0 ? (
        <p className="flex items-center gap-2 py-2 text-[13px] text-ink-300">
          <CheckCircleIcon className="h-5 w-5 text-success-500" />
          Todo en orden: ningún vehículo necesita atención.
        </p>
      ) : (
        <div className="flex max-h-[300px] flex-col gap-4 overflow-y-auto pr-1">
          <AttentionGroup title="Documentos" items={documents} />
          <AttentionGroup title="Tagliando" items={tagliando} />
          <AttentionGroup title="Estado de la flota" items={unavailable} />
        </div>
      )}
    </PanelShell>
  );
};

// Cuantos vehiculos hay en cada centro y como se reparten por estado.
const CenterSummaryPanel = ({ vehicles }) => {
  const centers = [...GRUPO_OPTIONS.map((g) => g.value), null]
    .map((grupo) => {
      const members = vehicles.filter((v) => (v.grupo ?? null) === grupo);
      return {
        grupo,
        label: centroLabel(grupo),
        total: members.length,
        disponibles: members.filter((v) => v.estado === "DISPONIBLE").length,
        mantenimiento: members.filter((v) => v.estado === "EN_MANTENIMIENTO").length,
        fuera: members.filter((v) => v.estado === "FUERA_DE_SERVICIO").length,
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
                {c.total} {c.total === 1 ? "vehículo" : "vehículos"}
              </span>
            </div>
            <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-line/10">
              <span className="bg-success-500" style={{ width: `${(c.disponibles / c.total) * 100}%` }} />
              <span className="bg-warning-500" style={{ width: `${(c.mantenimiento / c.total) * 100}%` }} />
              <span className="bg-danger-500" style={{ width: `${(c.fuera / c.total) * 100}%` }} />
            </div>
            <div className="mt-2 flex items-center gap-3 text-[12px] text-ink-300">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                {c.disponibles}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-warning-500" />
                {c.mantenimiento}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-danger-500" />
                {c.fuera}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
};

// Suma de los km del mes en curso: los mismos que se pagan y que muestra el ranking (la suma de la flota).
const KmMonthPanel = ({ ranking }) => {
  const total = ranking ? ranking.vehiculos.reduce((sum, v) => sum + v.km, 0) : null;
  const monthName = new Date().toLocaleDateString("es-AR", { month: "long" });

  return (
    <PanelShell icon={RouteIcon} title="Kilómetros del mes">
      {total === null ? (
        <div className="flex justify-center py-4">
          <Spinner className="h-5 w-5 border-line/20 border-t-line" />
        </div>
      ) : (
        <>
          <div className="text-[30px] font-semibold leading-none tracking-tight text-ink-50">
            {fmtKm(total)} km
          </div>
          <p className="mt-2 text-[12px] text-ink-400">Recorridos en {monthName}</p>
        </>
      )}
    </PanelShell>
  );
};

const KM_BREAKDOWN_ROWS = [
  { key: "EXTRA_PIAZZA", label: "Extras Piazza" },
  { key: "DHL", label: "DHL" },
  { key: "AB_SERVICE", label: "AB Service" },
  { key: "EXTRAS_STEFANIA", label: "Otros", onlyIfAny: true },
];

// Desglose de KM del mes por tipo de servicio: los mismos km que se pagan (ver getKmRankingForActor en el servidor).
const VehicleKmModal = ({ entry, onClose }) => {
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
        <p className="mt-1 text-[13px] text-ink-400">KM de este mes por tipo de servicio, los mismos que se pagan.</p>

        <div className="mt-4 flex flex-col gap-2">
          {KM_BREAKDOWN_ROWS.filter(({ key, onlyIfAny }) => !onlyIfAny || entry.breakdown[key] > 0).map(({ key, label }) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-xl glass-surface-sm px-3 py-2 text-[13px]"
            >
              <span className="text-ink-50">{label}</span>
              <span className="text-ink-300">
                {fmtKm(entry.breakdown[key])} km
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

// Top de vehiculos por KM de este mes: los mismos que se pagan en Pago a choferes (km reales del chofer o circuito del sistema).
const FleetRankingPanel = ({ ranking: all }) => {
  const ranking = all ? all.vehiculos.slice(0, 10) : undefined;
  const [selectedEntry, setSelectedEntry] = useState(null);

  return (
    <PanelShell icon={TruckIcon} title="Ranking de flota">
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

      {selectedEntry && <VehicleKmModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />}
    </PanelShell>
  );
};

// ---------------------------------------------------------------------------
// Pagina
// ---------------------------------------------------------------------------

const PAGE_SIZE_TABLE = 10;
const PAGE_SIZE_CARDS = 9;

const todosOption = (label, options) => [{ value: "", label }, ...options];

export const VehiclesPage = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  // Recursos Humanos gestiona los vehiculos pero no ve la operacion (km del mes, rankings).
  const isRrhh = user?.cargo === "RRHH";
  const canAccess = isPrivileged || isRrhh;
  const { version: vehiclesVersion, refresh: refreshVehicles } = useDataRefresh("vehicles");
  const { version: recordsVersion } = useDataRefresh("records");

  const [vehicles, setVehicles] = useState(null);
  const [scope, setScope] = useState(null);
  const [kmRanking, setKmRanking] = useState(null);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const [view, setView] = useState(initialView);
  const [centro, setCentro] = useState("");
  const [area, setArea] = useState("");
  const [estado, setEstado] = useState("");
  const [sort, setSort] = useState("targa");
  const [page, setPage] = useState(1);

  // La barra superior y la de la pagina comparten el mismo texto (ver listSearchStore).
  const query = useListSearch();
  const setQuery = setListSearch;

  // Al salir de Vehiculos se limpia la busqueda.
  useEffect(() => () => setListSearch(""), []);

  // Mostrar u ocultar en el Mapa (uno o varios): se ve al instante y se guarda; si falla vuelve a como estaba.
  const [mapaBusy, setMapaBusy] = useState(false);
  const setMapa = async (ids, value) => {
    const idSet = new Set(ids);
    const apply = (visible) => (prev) => prev?.map((v) => (idSet.has(v.id) ? { ...v, mostrarEnMapa: visible } : v));
    const previous = vehicles;
    setVehicles(apply(value));
    setMapaBusy(true);
    try {
      await setMapaVisibilityRequest(ids, value);
    } catch (err) {
      setVehicles(previous);
      setError(parseApiError(err).message);
    } finally {
      setMapaBusy(false);
    }
  };

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
    listVehiclesRequest()
      .then(setVehicles)
      .catch((err) => setError(parseApiError(err).message));
  }, [canAccess, vehiclesVersion]);

  // A que vehiculos se refieren los avisos de quien mira (un Responsable: solo los de su asignacion; el Admin: todos).
  useEffect(() => {
    if (!isPrivileged) return;
    getNotificationScopeRequest(user?.id)
      .then(setScope)
      .catch(() => setScope({ todo: true }));
  }, [isPrivileged, user?.id]);

  // Depende tambien de recordsVersion: el uso de flota/ranking sale de los registros
  // del mes, no de los vehiculos - si se edita un km desde el detalle de un registro,
  // esto tiene que reflejarse aca tambien. El servidor calcula los mismos km que el pago.
  useEffect(() => {
    if (!isPrivileged) return;
    getKmRankingRequest({ periodo: "mes" })
      .then(setKmRanking)
      .catch((err) => setError(parseApiError(err).message));
  }, [isPrivileged, recordsVersion]);

  const filtered = useMemo(() => {
    if (!vehicles) return [];
    const needle = query.trim().toLowerCase();

    const list = vehicles.filter((v) => {
      if (centro && (centro === "SIN_GRUPO" ? v.grupo : v.grupo !== centro)) return false;
      if (area && v.area !== area) return false;
      if (estado && v.estado !== estado) return false;
      if (!needle) return true;
      const haystack = [v.targa, v.modelo, centroLabel(v.grupo), areaLabel(v.area), conductorLabel(v)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });

    return [...list].sort((a, b) => {
      if (sort === "km") return (b.kmActual ?? -1) - (a.kmActual ?? -1);
      if (sort === "modelo") return a.modelo.localeCompare(b.modelo, "es");
      return a.targa.localeCompare(b.targa, "es");
    });
  }, [vehicles, query, centro, area, estado, sort]);

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
  const total = vehicles?.length ?? 0;
  const count = (status) => vehicles?.filter((v) => v.estado === status).length ?? 0;
  const disponibles = count("DISPONIBLE");
  const mantenimiento = count("EN_MANTENIMIENTO");
  const fuera = count("FUERA_DE_SERVICIO");
  const pct = (n) => (total > 0 ? `${Math.round((n / total) * 100)}% de la flota` : "");

  // Importa a demanda las targas que Velocity Fleet reporte y todavia no tengan
  // ficha (se crean con area "Sin asignar" para revisar despues) - solo OWNER, mismo
  // criterio que el backend.
  const handleSyncFromVelocity = async () => {
    setSyncing(true);
    setError("");
    setSyncMessage("");
    try {
      const result = await syncVehiclesFromVelocityFleetRequest();
      const avisos = result.avisos?.length ? ` (${result.avisos.join("; ")})` : "";
      setSyncMessage(
        result.createdCount === 0
          ? `No hay dispositivos nuevos: OneSystec tiene ${result.dispositivosOnesystec ?? 0} y Velocity Fleet no trae targas nuevas${avisos}.`
          : `Se importaron ${result.createdCount} vehículo(s): ${result.created.map((v) => v.targa).join(", ")}. ` +
              `Los de OneSystec (${result.onesystec ?? 0}) quedan visibles en el mapa; los de Velocity Fleet (${result.velocity ?? 0}) quedan ocultos hasta que los actives. ` +
              `Revisa su área/modelo en la ficha de cada uno${avisos}.`
      );
      refreshVehicles();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSyncing(false);
    }
  };

  const groups = [...GRUPO_OPTIONS.map((g) => ({ value: g.value, title: g.label })), { value: null, title: "Sin grupo" }]
    .map((g) => ({ ...g, members: pageItems.filter((v) => (v.grupo ?? null) === g.value) }))
    .filter((g) => g.members.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink-50">Vehículos</h1>
          <p className="mt-1 text-[14px] text-ink-300">Gestiona y monitorea tu flota en tiempo real.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user?.cargo === "OWNER" && (
            <Button variant="ghost" className="!w-auto px-5" onClick={handleSyncFromVelocity} loading={syncing}>
              Buscar dispositivos nuevos
            </Button>
          )}
          <Link to="/vehiculos/new" state={{ backgroundLocation: location }}>
            <Button className="!w-auto px-5">+ Nuevo vehículo</Button>
          </Link>
        </div>
      </div>

      {syncMessage && <Alert variant="success">{syncMessage}</Alert>}

      <Alert>{error}</Alert>

      {vehicles === null && !error && <PageLoader />}

      {vehicles?.length === 0 && (
        <GlassCard className="text-center text-[14px] text-ink-300">Todavía no hay vehículos cargados.</GlassCard>
      )}

      {vehicles !== null && vehicles.length > 0 && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_310px] xl:items-start">
          <div className="flex min-w-0 flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <StatTile icon={TruckIcon} value={total} label="Total de vehículos" />
              <StatTile
                icon={CheckCircleIcon}
                tone="success"
                value={disponibles}
                label="Disponibles"
                detail={pct(disponibles)}
              />
              <StatTile
                icon={AlertTriangleIcon}
                tone={mantenimiento > 0 ? "warning" : "neutral"}
                value={mantenimiento}
                label="En mantenimiento"
                detail={pct(mantenimiento)}
              />
              <StatTile
                icon={AlertCircleIcon}
                tone={fuera > 0 ? "danger" : "neutral"}
                value={fuera}
                label="Fuera de servicio"
                detail={pct(fuera)}
              />
            </div>

            <div className="glass-surface grid grid-cols-2 gap-3 rounded-2xl p-4 md:grid-cols-4">
              <TextField
                id="vehicles-search"
                icon={SearchIcon}
                type="search"
                placeholder="Buscar vehículo, matrícula, conductor..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="col-span-2 md:col-span-4"
              />
              <Select
                id="vehicles-centro"
                label="Centro"
                value={centro}
                onChange={(e) => setCentro(e.target.value)}
                options={todosOption("Todos", [
                  ...GRUPO_OPTIONS.map((g) => ({ value: g.value, label: g.label })),
                  { value: "SIN_GRUPO", label: "Sin grupo" },
                ])}
              />
              <Select
                id="vehicles-area"
                label="Área"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                options={todosOption("Todas", VEHICLE_AREA_OPTIONS)}
              />
              <Select
                id="vehicles-estado"
                label="Estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                options={todosOption("Todos", VEHICLE_STATUS_OPTIONS)}
              />
              <Select
                id="vehicles-sort"
                label="Ordenar por"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                options={SORT_OPTIONS}
              />
            </div>

            {isPrivileged && (
              <div className="glass-surface flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-ink-50">Vehículos en el mapa</p>
                  <p className="text-[12px] text-ink-400">
                    {vehicles.filter((v) => v.mostrarEnMapa !== false).length} de {total} visibles
                    {hasFilters ? ` · los botones aplican a los ${filtered.length} de esta lista` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="!w-auto px-4 py-2 text-[13px]"
                    disabled={mapaBusy || filtered.length === 0}
                    onClick={() => setMapa(filtered.map((v) => v.id), true)}
                  >
                    Mostrar todos
                  </Button>
                  <Button
                    variant="ghost"
                    className="!w-auto px-4 py-2 text-[13px]"
                    disabled={mapaBusy || filtered.length === 0}
                    onClick={() => setMapa(filtered.map((v) => v.id), false)}
                  >
                    Ocultar todos
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-ink-400">
                {hasFilters ? `${filtered.length} de ${total} vehículos coinciden` : `${total} vehículos en la flota`}
              </p>
              <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={changeView} />
            </div>

            {filtered.length === 0 ? (
              <GlassCard className="text-center text-[14px] text-ink-300">
                Ningún vehículo coincide con los filtros.
              </GlassCard>
            ) : view === "tabla" ? (
              <VehicleTable vehicles={pageItems} onToggleMap={isPrivileged ? setMapa : undefined} />
            ) : (
              <div className="flex flex-col gap-7">
                {groups.map((g) => (
                  <GroupSection key={g.title} title={g.title} members={g.members} onToggleMap={isPrivileged ? setMapa : undefined} />
                ))}
              </div>
            )}
            {filtered.length > 0 && (
              <Pagination
                page={currentPage}
                pageCount={pageCount}
                pageSize={pageSize}
                total={filtered.length}
                noun="vehículos"
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
            {(!isPrivileged || scope) && (
              <AttentionPanel vehicles={isPrivileged ? vehicles.filter((v) => vehicleInScope(scope, v.id)) : vehicles} />
            )}
            {isPrivileged && <SpeedingAlertsPanel />}
            <CenterSummaryPanel vehicles={vehicles} />
            {!isRrhh && <KmMonthPanel ranking={kmRanking} />}
            {!isRrhh && <FleetRankingPanel ranking={kmRanking} />}
          </aside>
        </div>
      )}
    </div>
  );
};
