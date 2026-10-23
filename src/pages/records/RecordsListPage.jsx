import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { AreaBadge } from "../../components/records/AreaBadge";
import { ExportRecordsModal } from "../../components/records/ExportRecordsModal";
import {
  BarsIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  ClockIcon,
  DownloadIcon,
  PlusIcon,
  RouteIcon,
  SearchIcon,
} from "../../components/ui/icons";
import { MonthPicker } from "../../components/ui/MonthPicker";
import { PageLoader } from "../../components/ui/PageLoader";
import { PanelShell } from "../../components/ui/PanelShell";
import { Select } from "../../components/ui/Select";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Spinner } from "../../components/ui/Spinner";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { TextField } from "../../components/ui/TextField";
import { useAuth } from "../../context/AuthContext";
import { useRecordChanges } from "../../hooks/useRecordChanges";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import {
  APLICATIVO_LABELS,
  EN_PROCESO_STATUSES,
  RECORD_STATUS_OPTIONS,
  TERMINADOS_STATUSES,
} from "../../lib/constants";
import { formatDate, formatTimeRemaining } from "../../lib/format";
import { userAreaKeys } from "../../lib/roles";
import { AREA_ALL, AREAS_BY_KEY, RECORD_AREAS, classifyRecord } from "../../lib/recordAreas";
import { CompactarModal } from "../../components/records/CompactarModal";
import { FaltantesChips, hasFaltantes } from "../../components/records/FaltantesPanel";
import { EMPTY_RECORD_FILTERS, RecordFilters, countActiveFilters } from "../../components/records/RecordFilters";
import { ViajeChip } from "../../components/records/ViajeChip";
import { DesvioChip } from "../../components/records/DesvioChip";
import {
  listPendingRecordsRequest,
  listRecordsByDayRequest,
  listRecordsByMonthRequest,
  listRecordsRequest,
  listRecordsSummaryByMonthRequest,
  searchRecordsFilteredRequest,
  updateRecordRequest,
} from "../../lib/records.api";
import { kmRecorrido } from "../../lib/km";


const TAB_OPTIONS = [
  { value: "en_proceso", label: "En proceso" },
  { value: "terminados", label: "Terminados" },
];

const TAB_STATUSES = {
  en_proceso: EN_PROCESO_STATUSES,
  terminados: TERMINADOS_STATUSES,
};

// El backend arma los rangos /:year/:month/:day en UTC (buildDateRange). El resumen
// del mes se agrupa client-side, asi que tiene que usar el mismo criterio de "dia"
// (UTC), o el conteo del resumen y lo que trae el fetch puntual de un dia no van a
// coincidir para usuarios en husos horarios distintos a UTC.
const dayKey = (value) => {
  const d = new Date(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

const monthLabel = (year, month) =>
  new Date(Date.UTC(year, month - 1, 1))
    .toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })
    .toUpperCase();
const dayLabel = (value) =>
  new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  });

// "Hoy, 30 de septiembre de 2026" / "Ayer, ..." / "29 de septiembre de 2026".
const longDayLabel = (value) => {
  const text = new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const key = dayKey(value);
  if (key === dayKey(new Date())) return `Hoy, ${text}`;
  if (key === dayKey(new Date(Date.now() - 86400000))) return `Ayer, ${text}`;
  return text;
};

const driverName = (record) =>
  record.driver ? `${record.driver.nombre} ${record.driver.apellido}` : "Sin chofer asignado";

const fmtKm = (km) => Math.round(km).toLocaleString("es-AR");

// Urgencia por tiempo restante a la ETA: >1h verde, 31-59min naranja, <=30min (o ya
// vencido) rojo - para que el panel de Pendientes se pueda escanear de un vistazo.
const URGENCY_STYLES = {
  verde: "border-l-success-500",
  naranja: "border-l-amber-500",
  rojo: "border-l-danger-500",
};

const urgencyLevel = (etaValue) => {
  if (!etaValue) return "verde";
  const diffMin = (new Date(etaValue).getTime() - Date.now()) / 60000;
  if (diffMin >= 60) return "verde";
  if (diffMin >= 31) return "naranja";
  return "rojo";
};

// Agrupa el resumen (liviano, solo id/fechaServicio/estado) de un mes por dia de
// SERVICIO (no de creacion: un import historico masivo puede crearse todo el mismo
// dia pero corresponder a fechas de servicio bien distintas). Mas reciente primero.
const groupSummaryByDay = (list) => {
  const days = new Map();
  for (const item of list) {
    const dKey = dayKey(item.fechaServicio);
    if (!days.has(dKey)) days.set(dKey, { key: dKey, date: item.fechaServicio, count: 0, faltantes: 0 });
    days.get(dKey).count += 1;
    if (item.faltante) days.get(dKey).faltantes += 1;
  }
  return Array.from(days.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
};

const shiftMonth = ({ year, month }, delta) => {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
};

const ChevronIcon = ({ open }) => (
  <svg
    className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M5 7.5L10 12.5L15 7.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DisclosureHeader = ({ open, onClick, children, className }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center justify-between gap-2 text-left ${className ?? ""}`}
  >
    {children}
    <ChevronIcon open={open} />
  </button>
);

// state: backgroundLocation - para que App.jsx renderice el detalle como overlay
// sobre esta misma lista (que sigue montada) en vez de reemplazarla, evitando el
// refetch innecesario de volver a esta pantalla (ver App.jsx).
const RecordCard = ({ record }) => {
  const location = useLocation();
  return (
    <Link to={`/records/${record.id}`} state={{ backgroundLocation: location }}>
      <GlassCard className={`transition-colors hover:bg-line/[0.08] ${hasFaltantes(record) ? "!border-danger-500/50 !bg-danger-500/[0.08]" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[13px] font-medium text-ink-400">{record.codigo}</span>
          <h2 className="mt-0.5 text-[17px] font-medium text-ink-50">{record.destinazione}</h2>
        </div>
        <StatusBadge status={record.estado} />
      </div>

      <p className="mt-2 line-clamp-2 text-[14px] text-ink-300">{record.descripcion}</p>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-400">
        <span>Servicio: {formatDate(record.fechaServicio)}</span>
        <span>ETA: {formatDate(record.eta)}</span>
        <span>
          Vehiculo: {record.vehicle?.targa} - {record.vehicle?.modelo}
        </span>
        <span>Cliente: {record.client?.nombre}</span>
      </div>
      <FaltantesChips faltantes={record.faltantes} className="mt-3" />
      <ViajeChip compactado={record.compactado} className="mt-3" />
      <DesvioChip recorridoEstado={record.recorridoEstado} className="mt-3 ml-2" />
      </GlassCard>
    </Link>
  );
};

// Columnas de la tabla de servicios: Servicio (area + codigo) | Destino / cliente |
// Vehiculo | Conductor | Estado | ETA. Misma grilla en el encabezado y en cada fila.
const ROW_GRID =
  "grid min-w-[780px] grid-cols-[minmax(150px,1.1fr)_minmax(120px,1.3fr)_100px_minmax(100px,0.9fr)_96px_minmax(110px,1fr)] items-center gap-3 px-4";

const CompactRowHeader = () => (
  <div className={`${ROW_GRID} py-2 text-[11px] font-medium uppercase tracking-wide text-ink-500`}>
    <span>Servicio</span>
    <span>Destino / cliente</span>
    <span>Vehiculo</span>
    <span>Conductor</span>
    <span>Estado</span>
    <span>ETA / restante</span>
  </div>
);

// Fila de un servicio: el area (badge + nombre), el codigo, a donde va y con que cliente/km,
// vehiculo, conductor, estado y cuanto falta. Abre el detalle como overlay.
const RecordRow = ({ record }) => {
  const location = useLocation();
  const area = AREAS_BY_KEY[classifyRecord(record)];
  return (
    <Link
      to={`/records/${record.id}`}
      state={{ backgroundLocation: location }}
      className={`${ROW_GRID} rounded-xl py-2.5 text-[12px] text-ink-200 transition-colors ${
        hasFaltantes(record)
          ? "border-l-4 border-danger-500 bg-danger-500/[0.09] hover:bg-danger-500/[0.15]"
          : "hover:bg-line/[0.06]"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <AreaBadge areaKey={area.key} size={32} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-ink-50">{record.codigo}</span>
          <span className="block truncate text-[11px] text-ink-400">{area.label}</span>
        </span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] text-ink-50" title={record.destinazione}>
          {record.destinazione}
        </span>
        <span className="block truncate text-[11px] text-ink-400">
          {record.client?.nombre ?? "Sin cliente"}
          {record.kilometros != null ? ` · ${fmtKm(record.kilometros)} km` : ""}
        </span>
        <FaltantesChips faltantes={record.faltantes} className="mt-1" />
        <ViajeChip compactado={record.compactado} className="mt-1" />
        <DesvioChip recorridoEstado={record.recorridoEstado} className="mt-1" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-ink-100">{record.vehicle?.targa ?? "-"}</span>
        <span className="block truncate text-[11px] text-ink-400">{record.vehicle?.modelo ?? ""}</span>
      </span>
      <span className="truncate" title={driverName(record)}>
        {driverName(record)}
      </span>
      <span>
        <StatusBadge status={record.estado} className="px-2 py-0.5 text-[11px]" />
      </span>
      <span className="min-w-0" title={formatDate(record.eta)}>
        <span className="block truncate text-ink-100">
          {/* "Vencido hace X" no tiene sentido para un servicio ya terminado - ahi solo
              se muestra la fecha de referencia, no la cuenta regresiva/vencida. */}
          {TERMINADOS_STATUSES.includes(record.estado) ? formatDate(record.eta) : formatTimeRemaining(record.eta)}
        </span>
        {record.aplicativo && (
          <span className="block truncate text-[11px] text-ink-400">{APLICATIVO_LABELS[record.aplicativo]}</span>
        )}
      </span>
    </Link>
  );
};

const now = new Date();
const CURRENT_VIEW_DATE = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };

// Fila del panel de Pendientes: sin agrupar por dia (a diferencia del acordeon de la
// izquierda) para poder escanear la urgencia de todo de un vistazo, ordenado por ETA.
// El link (abre el detalle completo) y el selector de estado van separados: un
// <select> no puede anidarse dentro de un <a> (lo que renderiza Link). Es un select
// (no un boton de "marcar entregado") a proposito: un clic de mas en un boton
// cambiaria el estado sin querer, mientras que elegir de una lista requiere abrirla
// primero.
const PendingRow = ({ record, closeTo, onChangeEstado, updating }) => {
  const location = useLocation();
  return (
  <div className={`rounded-xl border-l-4 ${URGENCY_STYLES[urgencyLevel(record.eta)]} glass-surface-sm text-[13px]`}>
    <Link
      to={`/records/${record.id}`}
      state={{ from: closeTo, backgroundLocation: location }}
      className="flex flex-col gap-1 px-3 pt-2.5 transition-colors hover:opacity-90"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-medium text-ink-50">{record.codigo}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-medium uppercase text-ink-400">
          <AreaBadge areaKey={classifyRecord(record)} size={16} />
          {AREAS_BY_KEY[classifyRecord(record)].label}
        </span>
      </div>
      <span className="min-w-0 truncate text-ink-300">{record.destinazione}</span>
      <div className="flex items-center justify-between gap-2 text-[12px] text-ink-400">
        <span className="min-w-0 truncate">{driverName(record)}</span>
        <span className="shrink-0">{formatTimeRemaining(record.eta)}</span>
      </div>
    </Link>
    <div className="px-3 pb-2.5 pt-1.5">
      <Select
        id={`estado-${record.id}`}
        options={RECORD_STATUS_OPTIONS}
        value={record.estado}
        disabled={updating}
        onChange={(e) => onChangeEstado(record.id, e.target.value)}
        className="!py-1.5 !text-[12px]"
      />
    </div>
  </div>
  );
};

// El backend ya filtra (en curso, servicios de hoy) y ordena por ETA - solo se renderiza
// tal cual. Llega ademas filtrado por el area activa (matchesArea del caller). scopedLabel:
// si es un ADMIN de area, el backend ya solo le manda su(s) area(s).
const PendingPanel = ({ records: pending, closeTo, onChangeEstado, updatingId, scopedLabel }) => (
  <PanelShell icon={ClockIcon} title="Pendientes de hoy">
    <p className="-mt-1 mb-3 text-[12px] text-ink-400">
      {scopedLabel ? `Servicios de hoy de ${scopedLabel}` : "Servicios de hoy de todas las areas"}, lo mas urgente
      primero.
    </p>
    <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
      {pending === undefined && (
        <div className="flex justify-center py-8">
          <Spinner className="h-5 w-5 border-line/20 border-t-line" />
        </div>
      )}
      {pending?.length === 0 && <p className="py-4 text-center text-[13px] text-ink-300">No hay servicios pendientes.</p>}
      {pending?.map((record) => (
        <PendingRow
          key={record.id}
          record={record}
          closeTo={closeTo}
          updating={updatingId === record.id}
          onChangeEstado={onChangeEstado}
        />
      ))}
    </div>
  </PanelShell>
);

// Boton "Nuevo servicio" dividido: el principal crea directo en el area activa (o abre el
// menu si se esta viendo "Todos"); la flecha abre el menu para elegir cualquiera de las
// areas permitidas, incluidas DHL Milano y AB Service.
const NewServiceMenu = ({ areas, activeKey }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.type === "keydown" ? e.key === "Escape" : !containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  // state: backgroundLocation - el formulario se abre como panel sobre esta misma lista.
  const goTo = (area) => {
    setOpen(false);
    navigate(area.newPath, { state: { backgroundLocation: location, ...area.newState } });
  };

  const active = areas.find((a) => a.key === activeKey);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex">
        <button
          type="button"
          onClick={() => (active ? goTo(active) : setOpen((v) => !v))}
          className="inline-flex items-center gap-2 rounded-l-full bg-brand py-2.5 pl-5 pr-4 text-[14px] font-semibold text-brand-foreground transition-colors hover:bg-brand-light focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo servicio
        </button>
        <button
          type="button"
          aria-label="Elegir el area del nuevo servicio"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center rounded-r-full border-l border-brand-foreground/25 bg-brand px-3 text-brand-foreground transition-colors hover:bg-brand-light focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
        >
          <ChevronDownIcon className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <ul className="glass-surface absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl bg-popover p-1.5 shadow-xl">
          <li className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            Crear servicio en
          </li>
          {areas.map((area) => (
            <li key={area.key}>
              <button
                type="button"
                onClick={() => goTo(area)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] text-ink-100 transition-colors hover:bg-line/10"
              >
                <AreaBadge areaKey={area.key} size={26} />
                {area.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// section: solo una pista de las rutas viejas (/records/extras-piazza, ...) para abrir en el
// area que corresponde; el area activa vive en ?area= (ver recordAreas.js).
const SECTION_TO_AREA_HINT = {
  "extras-piazza": "piazza-milano",
  "dhl-ab-service": "dhl-milano",
  "extras-stefania": "otros",
};

export const RecordsListPage = ({ section: sectionHint }) => {
  const location = useLocation();
  const { version, refresh: refreshRecords } = useDataRefresh("records");
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  // Un Responsable solo ve las areas que el Admin le marco; las demas ni siquiera se le ofrecen (el
  // servidor tampoco le manda esos registros). null = todas.
  const allowedKeys = userAreaKeys(user);
  const availableAreas = RECORD_AREAS.filter((a) => !allowedKeys || allowedKeys.includes(a.key));

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedArea = searchParams.get("area") ?? SECTION_TO_AREA_HINT[sectionHint] ?? AREA_ALL;
  const areaKey =
    requestedArea === AREA_ALL || availableAreas.some((a) => a.key === requestedArea) ? requestedArea : AREA_ALL;
  const selectArea = (key) => {
    const next = new URLSearchParams(searchParams);
    next.set("area", key);
    setSearchParams(next, { replace: true });
  };
  const matchesArea = (r) => areaKey === AREA_ALL || classifyRecord(r) === areaKey;
  const [error, setError] = useState("");
  const [tab, setTab] = useState("en_proceso");

  const [showExportModal, setShowExportModal] = useState(false);
  const [showCompactar, setShowCompactar] = useState(false);

  // --- Vista OWNER/ADMIN: navega mes a mes, trae solo un resumen liviano del mes
  // y recien pide los registros completos del dia cuando se despliega ese dia. ---
  const [viewDate, setViewDate] = useState(CURRENT_VIEW_DATE);
  const [summary, setSummary] = useState(null);
  const summaryMonthRef = useRef(null);
  const [openDays, setOpenDays] = useState(() => new Set());
  const [dayRecords, setDayRecords] = useState(() => new Map());
  const [loadingDays, setLoadingDays] = useState(() => new Set());
  const [dayErrors, setDayErrors] = useState(() => new Map());

  // --- Vista CHOFER: lista plana simple, trae todo de una (siempre es poco, son
  // solo sus propios servicios). ---
  const [records, setRecords] = useState(null);

  // Panel de Pendientes (OWNER/ADMIN): junta Extras Piazza y DHL - AB Service sin
  // separar por seccion, asi que se trae aparte del resumen mensual (que si esta
  // filtrado por seccion). Se pide una sola vez al entrar a Registros.
  const [pendingRecords, setPendingRecords] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  // Buscador (codigo/cliente/chofer/destino): reemplaza el acordeon de la izquierda
  // mientras hay una busqueda activa. null = sin busqueda, [] = sin resultados.
  // Precarga con ?q= (buscador de la barra superior del AppShell).
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") ?? "");
  const [searchResults, setSearchResults] = useState(null);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  // Filtros (chofer, vehiculo, cliente, estado, tipo, fechas): se combinan con el texto y buscan en todo el historico.
  const [filters, setFilters] = useState(EMPTY_RECORD_FILTERS);
  const activeFilters = countActiveFilters(filters);

  // Filtro "Solo sin cobrar": igual que el buscador, reemplaza el acordeon mientras
  // esta activo, pero acotado al mes que se esta navegando (no todo el historico,
  // que puede ser miles de registros). Pide el mes completo con detalle economico
  // (listRecordsByMonthRequest) porque el resumen liviano del acordeon no trae
  // pagoRecibido.
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);
  const [unpaidRecords, setUnpaidRecords] = useState(null);

  // Fuerza un re-render cada minuto para que "tiempo restante antes de vencer" no quede desactualizado.
  const [, setTick] = useState(0);
  useEffect(() => {
    const intervalId = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (isPrivileged) return;
    let cancelled = false;

    listRecordsRequest()
      .then((data) => {
        if (!cancelled) setRecords(data);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });

    return () => {
      cancelled = true;
    };
  }, [isPrivileged, version]);

  useEffect(() => {
    if (!isPrivileged) return;
    let cancelled = false;

    listPendingRecordsRequest()
      .then((data) => {
        if (!cancelled) setPendingRecords(data);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });

    return () => {
      cancelled = true;
    };
  }, [isPrivileged, version]);

  // Debounce: espera a que se deje de tipear antes de pegarle al backend. Sin texto (menos de 2
  // caracteres) y sin filtros limpia los resultados en vez de buscar (ver SEARCH_MIN_LENGTH del backend).
  useEffect(() => {
    if (!isPrivileged) return;
    const query = searchQuery.trim();
    if (query.length < 2 && activeFilters === 0) {
      setSearchResults(null);
      setSearchTotal(0);
      setSearching(false);
      return;
    }

    setSearching(true);
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      // Si las fechas quedaron al reves se invierten (desde siempre es la mas antigua).
      const [from, to] = filters.from && filters.to && filters.from > filters.to ? [filters.to, filters.from] : [filters.from, filters.to];
      searchRecordsFilteredRequest({
        ...(query.length >= 2 ? { q: query } : {}),
        ...(filters.driverId ? { driverId: filters.driverId } : {}),
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.estado ? { estado: filters.estado } : {}),
        ...(filters.spedizzione ? { spedizzione: filters.spedizzione } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      })
        .then((data) => {
          if (!cancelled) {
            setSearchResults(data.records);
            setSearchTotal(data.total);
          }
        })
        .catch((err) => {
          if (!cancelled) setError(parseApiError(err).message);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isPrivileged, searchQuery, filters, activeFilters]);

  const handleChangeEstado = async (recordId, estado) => {
    setUpdatingId(recordId);
    try {
      await updateRecordRequest(recordId, { estado });
      setPendingRecords((prev) => {
        if (!prev) return prev;
        // Si el nuevo estado ya no es "en proceso" (ej. Entregado/Anulado), sale del
        // panel de Pendientes; si sigue en curso, se actualiza en el lugar.
        if (!EN_PROCESO_STATUSES.includes(estado)) {
          return prev.filter((r) => r.id !== recordId);
        }
        return prev.map((r) => (r.id === recordId ? { ...r, estado } : r));
      });
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    if (!isPrivileged) return;
    let cancelled = false;
    // Solo al cambiar de mes se vacia (spinner); al refrescar por un cambio se conserva lo que hay hasta que llegue lo nuevo.
    const summaryMonthKey = `${viewDate.year}-${viewDate.month}`;
    if (summaryMonthRef.current !== summaryMonthKey) {
      setSummary(null);
      summaryMonthRef.current = summaryMonthKey;
    }

    listRecordsSummaryByMonthRequest(viewDate.year, viewDate.month)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });

    return () => {
      cancelled = true;
    };
  }, [isPrivileged, viewDate.year, viewDate.month, version]);

  useEffect(() => {
    if (!isPrivileged || !showUnpaidOnly) {
      setUnpaidRecords(null);
      return;
    }
    let cancelled = false;
    setUnpaidRecords(null);

    listRecordsByMonthRequest(viewDate.year, viewDate.month)
      .then((data) => {
        if (!cancelled) setUnpaidRecords(data);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });

    return () => {
      cancelled = true;
    };
  }, [isPrivileged, showUnpaidOnly, viewDate.year, viewDate.month, version]);

  const fetchDay = (day) => {
    setLoadingDays((prev) => new Set(prev).add(day.key));
    const d = new Date(day.date);
    listRecordsByDayRequest(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
      .then((data) => {
        setDayRecords((prev) => new Map(prev).set(day.key, data));
      })
      .catch((err) => {
        setDayErrors((prev) => new Map(prev).set(day.key, parseApiError(err).message));
      })
      .finally(() => {
        setLoadingDays((prev) => {
          const next = new Set(prev);
          next.delete(day.key);
          return next;
        });
      });
  };

  // Vuelve a pedir un dia ya desplegado sin mostrar el spinner ni vaciarlo: el cambio aparece en el mismo lugar.
  const refetchDaySilently = (key) => {
    const [year, month, day] = key.split("-").map(Number);
    listRecordsByDayRequest(year, month, day)
      .then((data) => setDayRecords((prev) => new Map(prev).set(key, data)))
      .catch(() => {});
  };

  const toggleDay = (day) => {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(day.key)) next.delete(day.key);
      else next.add(day.key);
      return next;
    });
    if (!dayRecords.has(day.key) && !loadingDays.has(day.key)) fetchDay(day);
  };

  // Se creo/edito/borro un registro en otra pantalla (ver DataRefreshContext) - los
  // dias ya desplegados quedaron con el cache viejo (fetchDay solo pide un dia la
  // primera vez que se abre, ver toggleDay), asi que se vuelven a pedir. Se ignora el
  // primer render (version arranca en 0, no hay nada que refrescar todavia).
  const isFirstVersionRender = useRef(true);
  useEffect(() => {
    if (isFirstVersionRender.current) {
      isFirstVersionRender.current = false;
      return;
    }
    // Los dias abiertos se vuelven a pedir sin vaciarlos (sin parpadeo); los cerrados se piden de nuevo cuando se abran.
    setDayRecords((prev) => new Map([...prev].filter(([key]) => openDays.has(key))));
    setDayErrors(new Map());
    openDays.forEach(refetchDaySilently);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // Se creo, edito o borro un servicio en cualquier lado (otra persona, el bot de Telegram...): el servidor dice que dias cambiaron y solo esos
  // dias (si estan desplegados) se vuelven a pedir, mas el resumen del mes y el panel de pendientes. Sin saber cuales (dias = null), todos los
  // desplegados. Nada se vacia ni se recarga entero.
  useRecordChanges((dias) => {
    if (!isPrivileged) {
      listRecordsRequest()
        .then(setRecords)
        .catch(() => {});
      return;
    }
    listRecordsSummaryByMonthRequest(viewDate.year, viewDate.month)
      .then(setSummary)
      .catch(() => {});
    listPendingRecordsRequest()
      .then(setPendingRecords)
      .catch(() => {});
    if (showUnpaidOnly) {
      listRecordsByMonthRequest(viewDate.year, viewDate.month)
        .then(setUnpaidRecords)
        .catch(() => {});
    }
    [...openDays].filter((key) => dias === null || dias.includes(key)).forEach(refetchDaySilently);
  });

  const visibleRecords = records?.filter((r) => TAB_STATUSES[tab].includes(r.estado) && matchesArea(r));

  // Servicios y km por area del mes (OWNER/ADMIN: del resumen liviano; chofer: de su lista).
  const areaStats = useMemo(() => {
    const stats = Object.fromEntries(RECORD_AREAS.map((a) => [a.key, { count: 0, km: 0 }]));
    (isPrivileged ? summary : records)?.forEach((r) => {
      const entry = stats[classifyRecord(r)];
      entry.count += 1;
      entry.km += kmRecorrido(r);
    });
    return stats;
  }, [isPrivileged, summary, records]);
  const totalCount = availableAreas.reduce((n, a) => n + areaStats[a.key].count, 0);
  const totalKm = availableAreas.reduce((n, a) => n + areaStats[a.key].km, 0);

  const summaryDays = summary ? groupSummaryByDay(summary.filter(matchesArea)) : null;
  const unpaidVisibleRecords = unpaidRecords
    ?.filter((r) => matchesArea(r) && r.pagoRecibido == null)
    .sort((a, b) => new Date(a.fechaServicio) - new Date(b.fechaServicio));

  // Al abrir un mes se despliega solo el dia mas reciente (un unico pedido) para no mostrar
  // una pantalla vacia; el resto se sigue cargando solo cuando se despliega.
  const autoOpenedRef = useRef(null);
  useEffect(() => {
    if (!isPrivileged || !summary) return;
    const monthKey = `${viewDate.year}-${viewDate.month}`;
    if (autoOpenedRef.current === monthKey) return;
    const newest = groupSummaryByDay(summary.filter(matchesArea))[0];
    if (!newest) return;
    autoOpenedRef.current = monthKey;
    setOpenDays((prev) => new Set(prev).add(newest.key));
    if (!dayRecords.has(newest.key) && !loadingDays.has(newest.key)) fetchDay(newest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary]);

  const tabs = [{ key: AREA_ALL, label: "Todos" }, ...availableAreas];
  const monthText = new Date(Date.UTC(viewDate.year, viewDate.month - 1, 1)).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const monthName = monthText.charAt(0).toUpperCase() + monthText.slice(1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink-50">Registros de Servicios</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-ink-300">
            {isPrivileged
              ? `Gestiona y consulta los servicios de ${allowedKeys ? "tus areas" : "todas las areas"}. Cada dia se carga solo al desplegarlo.`
              : "Viajes asignados, ordenados por fecha."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isPrivileged ? (
            <>
              <MonthPicker value={viewDate} onChange={setViewDate} />
              <button
                type="button"
                onClick={() => setShowCompactar(true)}
                className="inline-flex items-center gap-2 rounded-full border border-line/25 px-5 py-2.5 text-[14px] font-semibold text-ink-50 transition hover:bg-line/10"
              >
                <RouteIcon className="h-4 w-4" />
                Compactar
              </button>
              <NewServiceMenu areas={availableAreas} activeKey={areaKey} />
            </>
          ) : (
            // En proceso/Terminados solo tiene sentido para el chofer: no tiene el panel de
            // Pendientes ni navegacion mes a mes, asi que es su unica forma de acotar la lista.
            <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} />
          )}
        </div>
      </div>

      {/* Areas: cada una con su cantidad del mes. */}
      <div role="tablist" aria-label="Areas de servicio" className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
        {tabs.map((t) => {
          const active = areaKey === t.key;
          const count = t.key === AREA_ALL ? totalCount : areaStats[t.key].count;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectArea(t.key)}
              className={`flex shrink-0 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                active
                  ? "border-accent-500/60 bg-accent-500/10 shadow-[0_0_0_1px_var(--accent-500)_inset]"
                  : "glass-surface hover:bg-line/[0.05]"
              }`}
            >
              {t.key === AREA_ALL ? (
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-accent-400">
                  <ClipboardListIcon className="h-[18px] w-[18px]" />
                </span>
              ) : (
                <AreaBadge areaKey={t.key} size={30} />
              )}
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-ink-50">{t.label}</span>
                <span className="block text-[12px] text-ink-400">
                  {summary === null && isPrivileged ? "…" : `${count} servicio${count === 1 ? "" : "s"}`}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {isPrivileged && (
        <div className="glass-surface flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl p-3">
          <TextField
            id="records-search"
            icon={SearchIcon}
            type="search"
            placeholder="Buscar por codigo, cliente o chofer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-w-[240px] flex-1"
          />
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-200">
            <input
              type="checkbox"
              checked={showUnpaidOnly}
              onChange={(e) => setShowUnpaidOnly(e.target.checked)}
              className="h-4 w-4 rounded border-line/20 bg-transparent accent-accent-500"
            />
            Solo sin cobrar
          </label>
          <RecordFilters filters={filters} onChange={setFilters} total={searchResults !== null ? searchTotal : null} />
        </div>
      )}

      <Alert>{error}</Alert>

      {!isPrivileged && records === null && !error && <PageLoader />}

      {!isPrivileged && visibleRecords?.length === 0 && (
        <GlassCard className="text-center text-[14px] text-ink-300">
          {tab === "en_proceso" ? "No tienes registros en proceso." : "Todavia no tienes registros terminados."}
        </GlassCard>
      )}

      {isPrivileged ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
          <section className="glass-surface min-w-0 rounded-2xl">
            <header className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
              {searchResults !== null ? (
                <>
                  <h2 className="text-[15px] font-semibold text-ink-50">
                    Resultados de busqueda{searching && " - buscando..."}
                    {!searching && (
                      <span className="ml-2 text-[12px] font-normal text-ink-400">
                        {searchTotal > searchResults.length
                          ? `mostrando los ${searchResults.length} mas recientes de ${searchTotal}: afina los filtros`
                          : `${searchTotal} servicio${searchTotal === 1 ? "" : "s"}`}
                      </span>
                    )}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setFilters(EMPTY_RECORD_FILTERS);
                    }}
                    className="text-[13px] font-medium text-accent-400 hover:text-accent-300"
                  >
                    Volver al mes
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-[15px] font-semibold text-ink-50">
                    {showUnpaidOnly ? "Sin cobrar" : "Servicios"} · {monthName}
                  </h2>
                  <span className="text-[12px] text-ink-400">
                    {AREAS_BY_KEY[areaKey]?.label ?? "Todas las areas"}
                  </span>
                </>
              )}
            </header>

            {searchResults !== null ? (
              <div className="border-t border-line/10 px-2 pb-4 pt-3">
                {searchResults.filter(matchesArea).length === 0 ? (
                  <p className="py-4 text-center text-[14px] text-ink-300">
                    Sin resultados
                    {searchQuery.trim() && ` para "${searchQuery.trim()}"`}
                    {activeFilters > 0 && ` con esos filtros`}
                    {areaKey !== AREA_ALL && ` en ${AREAS_BY_KEY[areaKey].label}`}.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <CompactRowHeader />
                    <div className="flex min-w-[780px] flex-col gap-0.5 px-2">
                      {searchResults.filter(matchesArea).map((record) => (
                        <RecordRow key={record.id} record={record} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : showUnpaidOnly ? (
              <div className="border-t border-line/10 px-2 pb-4 pt-3">
                {unpaidVisibleRecords === undefined ? (
                  <div className="flex justify-center py-8">
                    <Spinner className="h-5 w-5 border-line/20 border-t-line" />
                  </div>
                ) : unpaidVisibleRecords.length === 0 ? (
                  <p className="py-4 text-center text-[14px] text-ink-300">
                    Ningun servicio sin cobrar este mes en {AREAS_BY_KEY[areaKey]?.label ?? "ninguna area"}.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <CompactRowHeader />
                    <div className="flex min-w-[780px] flex-col gap-0.5 px-2">
                      {unpaidVisibleRecords.map((record) => (
                        <RecordRow key={record.id} record={record} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 border-t border-line/10 p-4">
                {summary === null && (
                  <div className="flex justify-center py-8">
                    <Spinner className="h-5 w-5 border-line/20 border-t-line" />
                  </div>
                )}

                {summaryDays?.length === 0 && (
                  <p className="py-6 text-center text-[14px] text-ink-300">
                    {areaKey === AREA_ALL
                      ? "No hay servicios este mes."
                      : `No hay servicios de ${AREAS_BY_KEY[areaKey].label} en ${monthName}.`}
                  </p>
                )}

                {summaryDays?.map((day) => {
                  const dayOpen = openDays.has(day.key);
                  const loaded = dayRecords.get(day.key);
                  const dayVisibleRecords = loaded
                    ?.filter(matchesArea)
                    .sort((a, b) => driverName(a).localeCompare(driverName(b)));

                  return (
                    <div key={day.key} className="rounded-2xl border border-line/[0.08] bg-line/[0.02]">
                      <DisclosureHeader
                        open={dayOpen}
                        onClick={() => toggleDay(day)}
                        className="px-4 py-3 text-[14px] text-ink-100"
                      >
                        <span className="flex flex-wrap items-center gap-2.5">
                          <span className="font-semibold text-ink-50">{longDayLabel(day.date)}</span>
                          <span className="rounded-full bg-accent-500/15 px-2.5 py-0.5 text-[11px] font-medium text-accent-400">
                            {day.count} servicio{day.count === 1 ? "" : "s"}
                          </span>
                          {day.faltantes > 0 && (
                            <span className="rounded-full bg-danger-500/15 px-2.5 py-0.5 text-[11px] font-medium text-danger-500">
                              {day.faltantes} con faltantes
                            </span>
                          )}
                        </span>
                      </DisclosureHeader>

                      {dayOpen && (
                        <div className="border-t border-line/10 pb-2">
                          {loadingDays.has(day.key) && (
                            <div className="flex justify-center py-6">
                              <Spinner className="h-5 w-5 border-line/20 border-t-line" />
                            </div>
                          )}
                          {dayErrors.has(day.key) && <Alert>{dayErrors.get(day.key)}</Alert>}
                          {dayVisibleRecords && (
                            <div className="overflow-x-auto">
                              <CompactRowHeader />
                              <div className="flex min-w-[780px] flex-col gap-0.5 px-2">
                                {dayVisibleRecords.map((record) => (
                                  <RecordRow key={record.id} record={record} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="flex flex-col gap-5 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto xl:pr-1">
            <PanelShell icon={BarsIcon} title="Resumen del mes">
              <div className="grid grid-cols-2 gap-2.5">
                {availableAreas.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => selectArea(a.key)}
                    className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors hover:bg-line/[0.05] ${
                      areaKey === a.key ? "border-accent-500/50 bg-accent-500/10" : "border-line/10"
                    }`}
                  >
                    <AreaBadge areaKey={a.key} size={30} />
                    <span className="min-w-0">
                      <span className="block text-[18px] font-semibold leading-none text-ink-50">
                        {summary === null ? "…" : areaStats[a.key].count}
                      </span>
                      <span className="mt-1 block truncate text-[11px] text-ink-400">{a.shortLabel ?? a.label}</span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 flex items-center justify-between border-t border-line/10 pt-3 text-[12px] text-ink-300">
                <span>Total del mes</span>
                <span className="font-medium text-ink-100">
                  {totalCount} servicios · {fmtKm(totalKm)} km
                </span>
              </p>
            </PanelShell>

            <PendingPanel
              records={pendingRecords?.filter(matchesArea)}
              closeTo={areaKey === AREA_ALL ? "/records" : `/records?area=${areaKey}`}
              scopedLabel={
                allowedKeys ? availableAreas.map((a) => a.label).join(", ") : null
              }
              onChangeEstado={handleChangeEstado}
              updatingId={updatingId}
            />

            <PanelShell icon={ClockIcon} title="Acciones rapidas">
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center gap-3 rounded-xl border border-line/10 px-3.5 py-2.5 text-left text-[13px] text-ink-100 transition-colors hover:bg-line/[0.05]"
                >
                  <DownloadIcon className="h-[18px] w-[18px] text-ink-300" />
                  Exportar registros a CSV
                </button>
                <button
                  type="button"
                  onClick={() => setShowUnpaidOnly((v) => !v)}
                  className="flex items-center gap-3 rounded-xl border border-line/10 px-3.5 py-2.5 text-left text-[13px] text-ink-100 transition-colors hover:bg-line/[0.05]"
                >
                  <CheckCircleIcon className="h-[18px] w-[18px] text-ink-300" />
                  {showUnpaidOnly ? "Volver a todos los servicios" : "Ver servicios sin cobrar"}
                </button>
              </div>
            </PanelShell>
          </aside>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleRecords?.map((record) => (
            <RecordCard key={record.id} record={record} />
          ))}
        </div>
      )}

      {isPrivileged && <ExportRecordsModal open={showExportModal} onClose={() => setShowExportModal(false)} />}
      {isPrivileged && <CompactarModal open={showCompactar} onClose={() => setShowCompactar(false)} onDone={refreshRecords} />}
    </div>
  );
};
