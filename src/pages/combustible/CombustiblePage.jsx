import { canManageFinance } from "../../lib/financeAccess";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { CombustibleSidebar } from "../../components/combustible/CombustibleSidebar";
import { MancatoKpi } from "../../components/mancato/MancatoKpi";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { PageLoader } from "../../components/ui/PageLoader";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { TextField } from "../../components/ui/TextField";
import {
  CalendarIcon,
  ChevronDownIcon,
  DotsIcon,
  EuroIcon,
  FilterIcon,
  FuelIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  TruckIcon,
  UsersIcon,
} from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import {
  AREA_OPTIONS,
  COMBUSTIBLE_ASIGNACIONES,
  COMBUSTIBLE_ASIGNACION_FILTER_OPTIONS,
  COMBUSTIBLE_AREAS,
} from "../../lib/combustible";
import {
  getCombustibleStatsRequest,
  getCombustibleSummaryRequest,
  listCombustibleMetodosRequest,
  listCombustibleRequest,
} from "../../lib/combustible.api";
import { formatCurrency, formatDateOnly } from "../../lib/format";
import { listUsersRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

const PAGE_SIZE = 20;

const EMPTY_FILTERS = {
  area: "",
  driverId: "",
  targa: "",
  metodo: "",
  asignacion: "",
  from: "",
  to: "",
  q: "",
  orden: "",
};

const ORDEN_OPTIONS = [
  { value: "", label: "Mas recientes" },
  { value: "antiguos", label: "Mas antiguos" },
  { value: "monto", label: "Mayor monto" },
];

const AVATAR_COLORS = ["#ff3b57", "#ff8a1a", "#2f8dff", "#a78bfa", "#22d3ee"];
const avatarColor = (name) =>
  AVATAR_COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
const initials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

// Espera a que se deje de tipear/cambiar antes de pegarle al backend.
const useDebounced = (value, ms) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeoutId = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timeoutId);
  }, [value, ms]);
  return debounced;
};

// Columnas de la tabla (escritorio). El chofer no ve la columna "Chofer": todo es suyo.
const gridCols = (showDriver) =>
  showDriver
    ? "lg:grid-cols-[110px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_110px_36px]"
    : "lg:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_110px_36px]";

const formatRomeTime = (value) =>
  new Date(value).toLocaleTimeString("es-AR", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hour12: false });

// Menu "..." de cada fila: acciones rapidas sin abrir el detalle.
const RowMenu = ({ registro, location }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass =
    "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink-50 transition-colors hover:bg-line/10";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Acciones"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-line/10 hover:text-ink-50"
      >
        <DotsIcon className="h-5 w-5" />
      </button>
      {open && (
        <div className="glass-surface absolute right-0 top-9 z-30 w-48 overflow-hidden rounded-xl bg-background py-1 shadow-xl">
          <Link to={`/finanzas/combustible/${registro.id}`} state={{ backgroundLocation: location }} className={itemClass}>
            Ver detalle
          </Link>
          {registro.comprobante && (
            <a href={registro.comprobante.url} target="_blank" rel="noreferrer noopener" className={itemClass}>
              Ver comprobante
            </a>
          )}
        </div>
      )}
    </div>
  );
};

// Servicio al que se imputa la carga, o por que todavia no tiene (no vence: queda esperando).
const ServicioTag = ({ registro }) => {
  if (registro.asignacion === "AUTO" || registro.asignacion === "CONFIRMADO" || registro.asignacion === "MANUAL") {
    return registro.servicio ? (
      <span className="block truncate text-[11px] text-ink-400">Servicio {registro.servicio.codigo}</span>
    ) : null;
  }
  const info = COMBUSTIBLE_ASIGNACIONES[registro.asignacion];
  return <span className={clsx("block text-[11px] font-medium", info.tone)}>{info.label}</span>;
};

const CombustibleRow = ({ registro, area, showDriver, vehicle, location }) => {
  const driverName = registro.driver ? `${registro.driver.nombre} ${registro.driver.apellido}` : "Sin chofer";

  return (
    <div className="relative">
      <Link
        to={`/finanzas/combustible/${registro.id}`}
        state={{ backgroundLocation: location }}
        style={{ borderLeftColor: area.color }}
        className={clsx(
          "grid grid-cols-1 gap-2 rounded-xl border-l-4 px-4 py-3 pr-14 transition-colors hover:bg-line/[0.07] lg:items-center lg:gap-3",
          gridCols(showDriver),
          "lg:rounded-lg lg:border-l-0 lg:border-b lg:border-b-line/10 lg:py-2.5 lg:pr-4"
        )}
      >
        {/* Fecha + hora de registro */}
        <div className="min-w-0">
          <span className="block text-[13px] font-medium text-ink-50">{formatDateOnly(registro.fecha)}</span>
          <span className="block truncate text-[12px] text-ink-400">cargado {formatRomeTime(registro.registradoAt)}</span>
        </div>

        {/* Chofer */}
        {showDriver && (
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
              style={{ backgroundColor: avatarColor(driverName) }}
            >
              {initials(driverName)}
            </span>
            <span className="block truncate text-[13px] font-medium text-ink-50">{driverName}</span>
          </div>
        )}

        {/* Vehiculo */}
        <div className="min-w-0">
          <span className="block truncate text-[13px] text-ink-50">{vehicle?.modelo ?? "-"}</span>
          <span className="block text-[12px] text-ink-400 underline decoration-ink-500/50 underline-offset-2">
            {registro.targa}
          </span>
          <ServicioTag registro={registro} />
        </div>

        {/* Gasolinera */}
        <span className="min-w-0 truncate text-[13px] text-ink-50">{registro.metodo}</span>

        {/* Monto */}
        <span className="text-[14px] font-semibold text-ink-50 lg:pr-3 lg:text-right">
          {formatCurrency(registro.monto)}
        </span>

        <span className="hidden lg:block" aria-hidden="true" />
      </Link>

      <div className="absolute right-3 top-3 lg:inset-y-0 lg:flex lg:items-center">
        <RowMenu registro={registro} location={location} />
      </div>
    </div>
  );
};

// Acordeon de un area: el encabezado muestra cantidad y total (viene del resumen, sin
// traer filas); la tabla se pide recien al abrirlo y de a PAGE_SIZE.
const AreaAccordion = ({
  area,
  summary,
  params,
  version,
  defaultOpen,
  showDriver,
  vehiclesByTarga,
  location,
}) => {
  // Mientras el usuario no lo toque, abre o cierra solo segun haya resultados; si lo toca,
  // se respeta su eleccion.
  const [userOpen, setUserOpen] = useState(null);
  const open = userOpen ?? defaultOpen;
  const [list, setList] = useState({ items: null, total: 0, page: 1, loading: false, error: "" });
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    if (!open) {
      setList((prev) => (prev.items ? { ...prev, items: null } : prev));
      return undefined;
    }
    let cancelled = false;
    setList((prev) => ({ ...prev, loading: true, error: "" }));
    listCombustibleRequest({ ...params, area: area.value, page: 1, pageSize: PAGE_SIZE })
      .then((data) => {
        if (!cancelled) {
          setList({ items: data.items, total: data.total, page: 1, loading: false, error: "" });
        }
      })
      .catch((err) => {
        if (!cancelled) setList((prev) => ({ ...prev, loading: false, error: parseApiError(err).message }));
      });
    return () => {
      cancelled = true;
    };
    // paramsKey resume params: evita re-pedir por un objeto nuevo con el mismo contenido.
  }, [open, paramsKey, version, area.value]);

  const loadMore = async () => {
    const nextPage = list.page + 1;
    setList((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const data = await listCombustibleRequest({
        ...params,
        area: area.value,
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      setList((prev) => ({
        items: [...(prev.items ?? []), ...data.items],
        total: data.total,
        page: nextPage,
        loading: false,
        error: "",
      }));
    } catch (err) {
      setList((prev) => ({ ...prev, loading: false, error: parseApiError(err).message }));
    }
  };

  const remaining = list.items ? list.total - list.items.length : 0;
  const headerClass = "text-[11px] font-medium uppercase tracking-wide text-ink-400";

  // focus-within: la seccion con un menu abierto sube por encima de las de abajo.
  return (
    <section
      style={{ borderLeftColor: area.color }}
      className="glass-surface relative rounded-2xl border-l-4 focus-within:z-20"
    >
      <button
        type="button"
        onClick={() => setUserOpen(!open)}
        aria-expanded={open}
        className={clsx(
          "flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-line/[0.05]",
          open ? "rounded-t-2xl" : "rounded-2xl"
        )}
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: area.color }} />
        <span className="text-[16px] font-semibold text-ink-50">{area.label}</span>
        <span className="rounded-full bg-line/10 px-2.5 py-0.5 text-[12px] font-semibold text-ink-200">
          {summary.count}
        </span>
        <span className="ml-auto text-[15px] font-semibold text-ink-50">{formatCurrency(summary.total)}</span>
        <ChevronDownIcon
          className={clsx("h-5 w-5 shrink-0 text-ink-300 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="border-t border-line/10 px-2 pb-3 pt-1 sm:px-3">
          <Alert>{list.error}</Alert>

          {list.items === null && list.loading && (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          )}

          {list.items?.length === 0 && (
            <p className="px-3 py-4 text-[14px] text-ink-400">No hay cargas en {area.label}.</p>
          )}

          {list.items?.length > 0 && (
            <>
              <div className={clsx("hidden gap-3 px-4 py-2 lg:grid", gridCols(showDriver))}>
                <span className={headerClass}>Fecha</span>
                {showDriver && <span className={headerClass}>Chofer</span>}
                <span className={headerClass}>Vehiculo</span>
                <span className={headerClass}>Gasolinera</span>
                <span className={clsx(headerClass, "text-right lg:pr-3")}>Monto</span>
                <span />
              </div>

              <div className="flex flex-col gap-2 lg:gap-0">
                {list.items.map((registro) => (
                  <CombustibleRow
                    key={registro.id}
                    registro={registro}
                    area={area}
                    showDriver={showDriver}
                    vehicle={vehiclesByTarga.get(registro.targa)}
                    location={location}
                  />
                ))}
              </div>

              <div className="mt-2 flex flex-col items-center justify-between gap-2 px-3 sm:flex-row">
                <span className="text-[12px] text-ink-400">
                  Mostrando {list.items.length} de {list.total} {list.total === 1 ? "carga" : "cargas"}
                </span>
                {remaining > 0 && (
                  <Button
                    variant="ghost"
                    className="py-2 text-[13px] sm:w-auto sm:px-5"
                    loading={list.loading}
                    onClick={loadMore}
                  >
                    Ver mas ({remaining} restantes)
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export const CombustiblePage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isPrivileged = canManageFinance(user);
  const { version } = useDataRefresh("combustible");

  const [searchParams] = useSearchParams();
  const asignacionParam = searchParams.get("asignacion");
  // Los avisos de "Atencion requerida" (Finanzas) llegan con ?asignacion=... para abrir la lista ya
  // filtrada.
  const [filters, setFilters] = useState(() => ({ ...EMPTY_FILTERS, asignacion: asignacionParam ?? "" }));
  useEffect(() => {
    if (asignacionParam !== null) setFilters((prev) => ({ ...prev, asignacion: asignacionParam }));
  }, [asignacionParam]);
  // En celular arrancan cerrados (ocupan media pantalla); en escritorio, abiertos.
  const [filtersOpen, setFiltersOpen] = useState(() => window.innerWidth >= 1024);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [metodos, setMetodos] = useState([]);
  const [summary, setSummary] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listVehiclesRequest().then(setVehicles).catch(() => {});
    if (isPrivileged) {
      listUsersRequest()
        .then((users) => setDrivers(users.filter((u) => u.estado === "ACTIVO")))
        .catch(() => {});
    }
  }, [isPrivileged]);

  // Se vuelve a pedir tras cada alta/edicion: puede haber una gasolinera nueva.
  useEffect(() => {
    listCombustibleMetodosRequest().then(setMetodos).catch(() => {});
  }, [version]);

  const vehiclesByTarga = useMemo(
    () => new Map(vehicles.map((v) => [v.targa.replace(/\s+/g, "").toUpperCase(), v])),
    [vehicles]
  );

  const setFilter = (field, value) => setFilters((prev) => ({ ...prev, [field]: value }));

  // Los filtros que mueven numeros (resumen, KPIs, grafico). El area y el orden solo
  // cambian que acordeones se ven y como se ordenan las filas.
  const rawParams = useMemo(
    () => ({
      q: filters.q.trim() || undefined,
      driverId: filters.driverId || undefined,
      targa: filters.targa.trim() || undefined,
      metodo: filters.metodo.trim() || undefined,
      asignacion: filters.asignacion || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    }),
    [filters.q, filters.driverId, filters.targa, filters.metodo, filters.asignacion, filters.from, filters.to]
  );
  const params = useDebounced(rawParams, 350);
  const paramsKey = JSON.stringify(params);
  const listParams = useMemo(() => ({ ...params, orden: filters.orden || undefined }), [params, filters.orden]);

  // El resumen y los acordeones respetan el rango de fechas; las estadisticas del
  // encabezado siempre miran por mes, asi que no lo reciben.
  const statsParams = useMemo(() => {
    const { from: _from, to: _to, ...rest } = params;
    return rest;
  }, [params]);
  const statsKey = JSON.stringify(statsParams);

  const activeFilterCount =
    Object.values(params).filter(Boolean).length + (filters.area ? 1 : 0) + (filters.orden ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  useEffect(() => {
    let cancelled = false;
    getCombustibleSummaryRequest(params)
      .then((data) => {
        if (!cancelled) {
          setSummary(data);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
    // paramsKey resume params (ver arriba).
  }, [paramsKey, version]);

  useEffect(() => {
    let cancelled = false;
    getCombustibleStatsRequest(statsParams)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
    // statsKey resume statsParams (ver arriba).
  }, [statsKey, version]);

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const visibleAreas = COMBUSTIBLE_AREAS.filter((a) => !filters.area || a.value === filters.area);
  // Sin filtros abre solo la primera area con cargas; con filtros, todas las que tengan
  // resultados (asi se ve de una que encontro la busqueda).
  const firstWithData = summary ? COMBUSTIBLE_AREAS.find((a) => summary[a.value].count > 0)?.value : null;
  const driverOptions = [
    { value: "", label: "Todos" },
    ...drivers.map((d) => ({ value: d.id, label: `${d.nombre} ${d.apellido}` })),
  ];
  const areaOptions = [{ value: "", label: "Todas" }, ...AREA_OPTIONS];

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <p className="max-w-xl text-[14px] text-ink-300">
              {isPrivileged
                ? "Controla las cargas de combustible de toda la flota, separadas por area."
                : "Tus cargas de combustible. Sube el comprobante apenas cargues."}
            </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="glass-surface-sm flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-ink-300">
            <CalendarIcon className="h-4 w-4 shrink-0" />
            <input
              type="date"
              aria-label="Fecha desde"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => setFilter("from", e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-ink-50 outline-none"
            />
            <span>-</span>
            <input
              type="date"
              aria-label="Fecha hasta"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => setFilter("to", e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-ink-50 outline-none"
            />
          </div>
          <Link to="/finanzas/combustible/new" state={{ backgroundLocation: location }}>
            <Button className="w-full sm:w-auto sm:px-6">
              <PlusIcon className="h-4 w-4" />
              Cargar combustible
            </Button>
          </Link>
        </div>
      </div>

      <Alert>{error}</Alert>
      {(!summary || !stats) && !error && <PageLoader />}

      {summary && stats && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-6">
            {/* Indicadores */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 2xl:grid-cols-4">
              <MancatoKpi
                icon={EuroIcon}
                label={`Gasto de ${stats.mesLabel}`}
                value={formatCurrency(stats.totalMes)}
                deltaPct={stats.totalMesDeltaPct}
                deltaLabel="vs. mes anterior"
                detail="Lo que va del mes"
                color="#22e093"
              />
              <MancatoKpi
                icon={FuelIcon}
                label="Cargas del mes"
                value={stats.cargasMes}
                detail={stats.cargasMes === 1 ? "carga registrada" : "cargas registradas"}
                color="#2f8dff"
              />
              <MancatoKpi
                icon={TruckIcon}
                label="Promedio por carga"
                value={formatCurrency(stats.promedioPorCarga)}
                deltaPct={stats.promedioPorCargaDeltaPct}
                deltaLabel="vs. mes anterior"
                detail="Monto medio de cada carga"
                color="#ff8a1a"
              />
              {isPrivileged ? (
                <MancatoKpi
                  icon={UsersIcon}
                  label="Choferes que cargaron"
                  value={stats.choferesQueCargaron}
                  detail={`de ${stats.totalChoferes ?? 0} choferes`}
                  color="#a78bfa"
                />
              ) : (
                <MancatoKpi
                  icon={FuelIcon}
                  label="Gasolinera frecuente"
                  value={stats.gasolineraTop?.nombre ?? "-"}
                  detail={
                    stats.gasolineraTop
                      ? `${stats.gasolineraTop.count} ${stats.gasolineraTop.count === 1 ? "carga" : "cargas"} este mes`
                      : "Sin cargas este mes"
                  }
                  color="#a78bfa"
                />
              )}
            </div>

            {/* Filtros */}
            <div className="glass-surface-sm rounded-2xl p-4">
              <div className={clsx("flex items-center justify-between gap-3", filtersOpen && "mb-3")}>
                <button
                  type="button"
                  onClick={() => setFiltersOpen((prev) => !prev)}
                  aria-expanded={filtersOpen}
                  className="flex items-center gap-2 text-[13px] font-medium text-ink-300 hover:text-ink-50"
                >
                  <FilterIcon className="h-4 w-4" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <span className="rounded-full bg-accent-500/20 px-2 py-0.5 text-[11px] font-semibold text-accent-300">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDownIcon className={clsx("h-4 w-4 transition-transform", filtersOpen && "rotate-180")} />
                </button>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 rounded-lg glass-input px-3 py-1.5 text-[12px] font-medium text-ink-50 hover:bg-line/10"
                  >
                    <RefreshIcon className="h-3.5 w-3.5" />
                    Limpiar filtros
                  </button>
                )}
              </div>

              <div className={clsx("flex flex-wrap items-end gap-3", !filtersOpen && "hidden")}>
                <TextField
                  id="filtro-q"
                  label="Buscar"
                  icon={SearchIcon}
                  placeholder="Targa, gasolinera o chofer"
                  value={filters.q}
                  onChange={(e) => setFilter("q", e.target.value)}
                  className="min-w-[240px] flex-[2_1_260px]"
                />
                <div className="min-w-[170px] flex-[1_1_170px]">
                  <Select
                    id="filtro-area"
                    label="Área"
                    options={areaOptions}
                    value={filters.area}
                    onChange={(e) => setFilter("area", e.target.value)}
                  />
                </div>
                {isPrivileged && (
                  <div className="min-w-[170px] flex-[1_1_170px]">
                    <Select
                      id="filtro-chofer"
                      label="Chofer"
                      options={driverOptions}
                      value={filters.driverId}
                      onChange={(e) => setFilter("driverId", e.target.value)}
                    />
                  </div>
                )}
                <div className="min-w-[130px] flex-[1_1_130px]">
                  <TextField
                    id="filtro-targa"
                    label="Targa"
                    placeholder="Ej. AB123CD"
                    list="combustible-filtro-targas"
                    autoComplete="off"
                    value={filters.targa}
                    onChange={(e) => setFilter("targa", e.target.value.toUpperCase())}
                  />
                  <datalist id="combustible-filtro-targas">
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.targa} />
                    ))}
                  </datalist>
                </div>
                <div className="min-w-[150px] flex-[1_1_150px]">
                  <TextField
                    id="filtro-metodo"
                    label="Gasolinera"
                    placeholder="Ej. Eni"
                    list="combustible-filtro-metodos"
                    autoComplete="off"
                    value={filters.metodo}
                    onChange={(e) => setFilter("metodo", e.target.value)}
                  />
                  <datalist id="combustible-filtro-metodos">
                    {metodos.map((m) => (
                      <option key={m.nombre} value={m.nombre} />
                    ))}
                  </datalist>
                </div>
                {isPrivileged && (
                  <div className="min-w-[170px] flex-[1_1_170px]">
                    <Select
                      id="filtro-asignacion"
                      label="Servicio"
                      options={COMBUSTIBLE_ASIGNACION_FILTER_OPTIONS}
                      value={filters.asignacion}
                      onChange={(e) => setFilter("asignacion", e.target.value)}
                    />
                  </div>
                )}
                <div className="min-w-[150px] flex-[1_1_150px]">
                  <Select
                    id="filtro-orden"
                    label="Ordenar por"
                    options={ORDEN_OPTIONS}
                    value={filters.orden}
                    onChange={(e) => setFilter("orden", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Acordeones por area */}
            <div className="flex flex-col gap-4">
              {visibleAreas.map((area) => (
                <AreaAccordion
                  // Al activar/desactivar filtros se reinicia la eleccion manual del usuario.
                  key={`${area.value}-${hasActiveFilters ? "f" : "n"}`}
                  area={area}
                  summary={summary[area.value]}
                  params={listParams}
                  version={version}
                  defaultOpen={
                    summary[area.value].count > 0 && (hasActiveFilters || area.value === firstWithData)
                  }
                  showDriver={isPrivileged}
                  vehiclesByTarga={vehiclesByTarga}
                  location={location}
                />
              ))}
            </div>
          </div>

          <CombustibleSidebar stats={stats} isPrivileged={isPrivileged} />
        </div>
      )}
    </div>
  );
};
