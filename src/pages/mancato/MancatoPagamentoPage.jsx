import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { MancatoBadge } from "../../components/mancato/MancatoBadge";
import { MancatoTotalAnual } from "../../components/mancato/MancatoTotalAnual";
import { ReevaluarMancatosModal } from "../../components/mancato/ReevaluarMancatosModal";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { CopyButton } from "../../components/ui/CopyButton";
import { PageLoader } from "../../components/ui/PageLoader";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { TextField } from "../../components/ui/TextField";
import {
  ChevronDownIcon,
  ClockIcon,
  DotsIcon,
  FilterIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
} from "../../components/ui/icons";
import { MancatoChoferPage } from "./MancatoChoferPage";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { formatCurrency, formatDateOnly } from "../../lib/format";
import {
  MANCATO_ESTADOS_PAGAMENTO,
  asignacionInfo,
  sitioWebHref,
} from "../../lib/mancato";
import {
  getMancatoMesesRequest,
  getMancatoStatsRequest,
  getMancatoSummaryRequest,
  listMancatosRequest,
  updateMancatoRequest,
} from "../../lib/mancato.api";
import { listUsersRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

const PAGE_SIZE = 20;

const EMPTY_FILTERS = {
  estado: "",
  driverId: "",
  targa: "",
  from: "",
  to: "",
  fueraDePlazo: false,
  asignacion: "",
  q: "",
  orden: "",
  vence: "",
};

const ORDEN_OPTIONS = [
  { value: "", label: "Mas urgentes" },
  { value: "recientes", label: "Mas recientes" },
  { value: "antiguos", label: "Mas antiguos" },
  { value: "monto", label: "Mayor monto" },
];

// Filtro aparte del orden: solo los sin pagar que vencen ese dia.
const VENCE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "HOY", label: "Vencen hoy" },
  { value: "MANANA", label: "Vencen mañana" },
  { value: "HOY_MANANA", label: "Vencen hoy y mañana" },
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
    ? "lg:grid-cols-[132px_minmax(0,1.25fr)_minmax(0,1.1fr)_96px_110px_132px_36px]"
    : "lg:grid-cols-[116px_minmax(0,1.2fr)_96px_110px_132px_36px]";

// "02/10/2026 11:05" en hora de Roma.
const formatSubida = (value) =>
  new Date(value).toLocaleString("es-AR", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const plazoParts = (m) => {
  if (m.estado === "PAGADO") {
    return {
      top: m.pagadoAt ? `Pagado ${formatDateOnly(m.pagadoAt)}` : "Pagado",
      bottom: m.pagadoFueraDePlazo ? "fuera de plazo" : "a tiempo",
      tone: m.pagadoFueraDePlazo ? "text-warning-500" : "text-success-500",
    };
  }
  const dias = m.diasRestantes;
  const top = `Vence ${formatDateOnly(m.fechaVencimiento)}`;
  if (dias < 0) {
    return { top, bottom: `hace ${-dias} ${-dias === 1 ? "dia" : "dias"}`, tone: "text-danger-500" };
  }
  if (dias === 0) return { top, bottom: "hoy", tone: "text-danger-500" };
  return { top, bottom: `en ${dias} ${dias === 1 ? "dia" : "dias"}`, tone: dias <= 3 ? "text-warning-500" : "text-ink-400" };
};

// Menu "..." de cada fila: acciones rapidas sin abrir el detalle.
const RowMenu = ({ mancato, isPrivileged, location, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const update = async (fields) => {
    setBusy(true);
    try {
      await updateMancatoRequest(mancato.id, fields);
      onChanged();
    } catch {
      // El detalle muestra el error con mas contexto; aca solo se cierra el menu.
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };
  const togglePagado = () => update({ pagado: String(!mancato.pagado) });
  const toggleObservado = () => update({ observado: String(!mancato.observado) });

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
        {busy ? <Spinner className="h-4 w-4" /> : <DotsIcon className="h-5 w-5" />}
      </button>
      {open && (
        <div className="glass-surface absolute right-0 top-9 z-30 w-52 overflow-hidden rounded-xl bg-background py-1 shadow-xl">
          <Link
            to={`/finanzas/mancato/${mancato.id}`}
            state={{ backgroundLocation: location }}
            className={itemClass}
          >
            Ver detalle
          </Link>
          {sitioWebHref(mancato.sitioWeb) && !mancato.pagado && (
            <a href={sitioWebHref(mancato.sitioWeb)} target="_blank" rel="noreferrer noopener" className={itemClass}>
              Pagar en el sitio web
            </a>
          )}
          {isPrivileged && (
            <button type="button" onClick={togglePagado} disabled={busy} className={itemClass}>
              {mancato.pagado ? "Reabrir (marcar pendiente)" : "Marcar como pagado"}
            </button>
          )}
          {isPrivileged && !mancato.pagado && (
            <button type="button" onClick={toggleObservado} disabled={busy} className={itemClass}>
              {mancato.observado ? "Quitar observado" : "Marcar como observado"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Servicio al que pertenece el peaje, o por que todavia no tiene (ver MancatoServicioCard).
const ServicioTag = ({ mancato }) => {
  const info = asignacionInfo(mancato.asignacion);
  if (mancato.asignacion === "AUTO" || mancato.asignacion === "CONFIRMADO" || mancato.asignacion === "MANUAL") {
    return mancato.servicio ? (
      <span className="block truncate text-[11px] text-ink-400">Servicio {mancato.servicio.codigo}</span>
    ) : null;
  }
  return <span className={clsx("block text-[11px] font-medium", info.tone)}>{info.label}</span>;
};

const MancatoRow = ({ mancato, showDriver, vehicle, location, isPrivileged, onChanged }) => {
  const estado = MANCATO_ESTADOS_PAGAMENTO.find((e) => e.value === mancato.estado) ?? MANCATO_ESTADOS_PAGAMENTO[0];
  const plazo = plazoParts(mancato);
  const driverName = mancato.driver ? `${mancato.driver.nombre} ${mancato.driver.apellido}` : "Sin chofer";

  return (
    <div className="relative">
      <Link
        to={`/finanzas/mancato/${mancato.id}`}
        state={{ backgroundLocation: location }}
        className={clsx(
          "grid grid-cols-1 gap-2 rounded-xl border-l-4 px-4 py-3 pr-14 transition-colors hover:bg-line/[0.07] lg:items-center lg:gap-3",
          estado.edge,
          gridCols(showDriver),
          "lg:rounded-lg lg:border-l-0 lg:border-b lg:border-b-line/10 lg:py-2.5 lg:pr-4"
        )}
      >
        {/* Fecha del aviso + cuando se subio (el numero ya va en la columna del mancato) */}
        <div className="min-w-0">
          <span className="block text-[13px] font-medium text-ink-50">{formatDateOnly(mancato.fecha)}</span>
          <span className="block truncate text-[11px] text-ink-400">Subido el {formatSubida(mancato.registradoAt)}</span>
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
            <div className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-ink-50">{driverName}</span>
              {mancato.fueraDePlazo && (
                <span className="block text-[11px] font-medium text-danger-500">Fuera de plazo</span>
              )}
              {mancato.subidoTarde && (
                <span className="block text-[11px] font-medium text-danger-500">
                  Subido {Math.floor(mancato.horasHastaSubida / 24)} dias despues
                </span>
              )}
              <ServicioTag mancato={mancato} />
            </div>
          </div>
        )}

        {/* Mancato: numero, sitio de pago (como texto, sin enlace) y targa */}
        <div className="min-w-0" title={vehicle?.modelo ?? undefined}>
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate text-[13px] font-medium text-ink-50">N. {mancato.numero}</span>
            <CopyButton value={mancato.numero} label="Copiar numero" />
          </span>
          <span
            className={clsx("block truncate text-[12px]", mancato.sitioWeb ? "text-ink-300" : "text-ink-500")}
            title={mancato.sitioWeb ?? undefined}
          >
            {mancato.sitioWeb?.trim() || "Sin sitio de pago"}
          </span>
          <span className="block truncate text-[12px] font-medium tracking-wide text-ink-400">{mancato.targa}</span>
          {!showDriver && mancato.fueraDePlazo && (
            <span className="block text-[11px] font-medium text-danger-500">Fuera de plazo</span>
          )}
          {!showDriver && <ServicioTag mancato={mancato} />}
        </div>

        {/* Monto */}
        <span className="text-[14px] font-semibold text-ink-50 lg:pr-3 lg:text-right">{formatCurrency(mancato.costo)}</span>

        {/* Estado */}
        <div>
          <MancatoBadge mancato={mancato} />
        </div>

        {/* Plazo */}
        <div className="min-w-0">
          <span className="block text-[13px] text-ink-50">{plazo.top}</span>
          <span className={clsx("block text-[12px] font-medium", plazo.tone)}>{plazo.bottom}</span>
        </div>

        <span className="hidden lg:block" aria-hidden="true" />
      </Link>

      <div className="absolute right-3 top-3 lg:inset-y-0 lg:flex lg:items-center">
        <RowMenu mancato={mancato} isPrivileged={isPrivileged} location={location} onChanged={onChanged} />
      </div>
    </div>
  );
};

// Acordeon generico: el encabezado muestra cantidad y total (vienen de un resumen, sin traer filas); la tabla se pide recien al abrirlo
// y de a PAGE_SIZE. Lo usan los acordeones por estado y por mes.
const GrupoAccordion = ({
  title,
  edgeClass,
  dotClass,
  pillClass,
  count,
  total,
  headerExtra,
  listParams,
  version,
  defaultOpen,
  emptyText,
  showDriver,
  vehiclesByTarga,
  location,
  isPrivileged,
  onChanged,
}) => {
  // Mientras el usuario no lo toque, abre o cierra solo segun haya resultados; si lo toca,
  // se respeta su eleccion.
  const [userOpen, setUserOpen] = useState(null);
  const open = userOpen ?? defaultOpen;
  const [list, setList] = useState({ items: null, total: 0, page: 1, loading: false, error: "" });
  const paramsKey = JSON.stringify(listParams);
  // Cuantas paginas ("Ver mas") hay abiertas y con que filtros. Si solo cambian los datos
  // (ej. se marco uno como pagado), se vuelven a pedir todas esas paginas para no perder lo
  // que ya se estaba viendo. Si cambian los filtros, se vuelve a la primera pagina.
  const loadedRef = useRef({ key: paramsKey, pages: 1 });

  useEffect(() => {
    if (!open) {
      setList((prev) => (prev.items ? { ...prev, items: null } : prev));
      loadedRef.current = { key: paramsKey, pages: 1 };
      return undefined;
    }
    let cancelled = false;
    const pages = loadedRef.current.key === paramsKey ? loadedRef.current.pages : 1;
    loadedRef.current = { key: paramsKey, pages };
    setList((prev) => ({ ...prev, loading: true, error: "" }));
    Promise.all(
      Array.from({ length: pages }, (_, i) =>
        listMancatosRequest({ ...listParams, page: i + 1, pageSize: PAGE_SIZE })
      )
    )
      .then((results) => {
        if (cancelled) return;
        const seen = new Set();
        const items = results
          .flatMap((data) => data.items)
          .filter((m) => (seen.has(m.id) ? false : seen.add(m.id)));
        const total = results[results.length - 1].total;
        setList({ items, total, page: pages, loading: false, error: "" });
      })
      .catch((err) => {
        if (!cancelled) setList((prev) => ({ ...prev, loading: false, error: parseApiError(err).message }));
      });
    return () => {
      cancelled = true;
    };
    // paramsKey resume los parametros: evita re-pedir por un objeto nuevo con el mismo contenido.
  }, [open, paramsKey, version]);

  const loadMore = async () => {
    const nextPage = list.page + 1;
    setList((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const data = await listMancatosRequest({ ...listParams, page: nextPage, pageSize: PAGE_SIZE });
      loadedRef.current = { key: paramsKey, pages: nextPage };
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
    <section className={clsx("glass-surface relative rounded-2xl border-l-4 focus-within:z-20", edgeClass)}>
      <button
        type="button"
        onClick={() => setUserOpen(!open)}
        aria-expanded={open}
        className={clsx(
          "flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4 text-left transition-colors hover:bg-line/[0.05]",
          open ? "rounded-t-2xl" : "rounded-2xl"
        )}
      >
        <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", dotClass)} />
        <span className="text-[16px] font-semibold text-ink-50">{title}</span>
        <span className={clsx("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", pillClass)}>{count}</span>
        <span className="text-[15px] font-semibold text-ink-50">{formatCurrency(total)}</span>
        {headerExtra}
        <ChevronDownIcon
          className={clsx("ml-auto h-5 w-5 shrink-0 text-ink-300 transition-transform", open && "rotate-180")}
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

          {list.items?.length === 0 && <p className="px-3 py-4 text-[14px] text-ink-400">{emptyText}</p>}

          {list.items?.length > 0 && (
            <>
              <div className={clsx("hidden gap-3 px-4 py-2 lg:grid", gridCols(showDriver))}>
                <span className={headerClass}>Fecha</span>
                {showDriver && <span className={headerClass}>Chofer</span>}
                <span className={headerClass}>Mancato / Pago / Targa</span>
                <span className={clsx(headerClass, "lg:pr-3 text-right")}>Monto</span>
                <span className={headerClass}>Estado</span>
                <span className={headerClass}>Plazo</span>
                <span />
              </div>

              <div className="flex flex-col gap-2 lg:gap-0">
                {list.items.map((mancato) => (
                  <MancatoRow
                    key={mancato.id}
                    mancato={mancato}
                    showDriver={showDriver}
                    vehicle={vehiclesByTarga.get(mancato.targa)}
                    location={location}
                    isPrivileged={isPrivileged}
                    onChanged={onChanged}
                  />
                ))}
              </div>

              <div className="mt-2 flex flex-col items-center justify-between gap-2 px-3 sm:flex-row">
                <span className="text-[12px] text-ink-400">
                  Mostrando {list.items.length} de {list.total} {list.total === 1 ? "aviso" : "avisos"}
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

// Acordeon de un estado (pendientes / vencidos / pagados).
const EstadoAccordion = ({ estado, summary, params, ...rest }) => {
  const info = MANCATO_ESTADOS_PAGAMENTO.find((e) => e.value === estado);
  return (
    <GrupoAccordion
      title={info.plural}
      edgeClass={info.edge}
      dotClass={info.dot}
      pillClass={info.pill}
      count={summary.count}
      total={summary.total}
      listParams={{ ...params, estado }}
      emptyText={`No hay mancato pagamento ${info.label.toLowerCase()}.`}
      {...rest}
    />
  );
};

const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesLabel = (mes) => {
  const [year, month] = mes.split("-").map(Number);
  const name = MESES_LARGO[month - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
};
const mesStart = (mes) => `${mes}-01`;
const mesEnd = (mes) => {
  const [year, month] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
};

// Pildora chica de un estado dentro del encabezado de un mes ("12 pagados").
const EstadoMini = ({ count, label, tone }) =>
  count > 0 ? (
    <span className={clsx("hidden rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline", tone)}>
      {count} {label}
    </span>
  ) : null;

// Acordeon de un mes (por la fecha del transito): cantidad, total y como se reparte por estado; las filas se piden al abrirlo.
const MesAccordion = ({ mes, params, filters, ...rest }) => {
  // Si hay un rango de fechas puesto a mano, el mes se recorta a ese rango.
  const from = filters.from && filters.from > mesStart(mes.mes) ? filters.from : mesStart(mes.mes);
  const to = filters.to && filters.to < mesEnd(mes.mes) ? filters.to : mesEnd(mes.mes);
  return (
    <GrupoAccordion
      title={mesLabel(mes.mes)}
      edgeClass="border-accent-500"
      dotClass="bg-accent-400"
      pillClass="bg-accent-500/15 text-accent-300"
      count={mes.count}
      total={mes.total}
      headerExtra={
        <>
          <EstadoMini count={mes.VENCIDO.count} label="vencidos" tone="bg-danger-500/15 text-danger-500" />
          <EstadoMini count={mes.PENDIENTE.count} label="pendientes" tone="bg-warning-500/15 text-warning-500" />
          <EstadoMini count={mes.OBSERVADO?.count ?? 0} label="observados" tone="bg-[#a78bfa]/15 text-[#a78bfa]" />
          <EstadoMini count={mes.HISTORIAL_VENCIDO?.count ?? 0} label="historial vencidos" tone="bg-line/15 text-ink-300" />
          <EstadoMini count={mes.PAGADO.count} label="pagados" tone="bg-success-500/15 text-success-500" />
        </>
      }
      listParams={{ ...params, from, to, estado: filters.estado || undefined }}
      emptyText="No hay mancato pagamento este mes con estos filtros."
      {...rest}
    />
  );
};

const MancatoOficinaPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const { version, refresh } = useDataRefresh("mancato");
  const [reevaluar, setReevaluar] = useState(false);
  const [searchParams] = useSearchParams();
  const asignacionParam = searchParams.get("asignacion");

  // Los avisos de "Atencion requerida" (Finanzas) llegan con ?asignacion=... para abrir la
  // lista ya filtrada.
  const [filters, setFilters] = useState(() => ({ ...EMPTY_FILTERS, asignacion: asignacionParam ?? "" }));
  // Como se agrupan los avisos: por mes (acordeon por mes con selector) o por estado (pendientes, vencidos, pagados).
  const [grupo, setGrupo] = useState("mes");
  const [meses, setMeses] = useState(null);
  // Todos los meses que hay (para el selector), aunque haya un rango de fechas puesto: se actualiza solo con pedidos sin fechas.
  const [mesesOpciones, setMesesOpciones] = useState([]);
  useEffect(() => {
    if (asignacionParam !== null) setFilters((prev) => ({ ...prev, asignacion: asignacionParam }));
  }, [asignacionParam]);
  // Panel de filtros (se abre con el boton "Filtros"); un clic fuera lo cierra.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef(null);
  useEffect(() => {
    if (!filtersOpen) return undefined;
    const onDown = (e) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target)) setFiltersOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setFiltersOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
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

  const vehiclesByTarga = useMemo(
    () => new Map(vehicles.map((v) => [v.targa.replace(/\s+/g, "").toUpperCase(), v])),
    [vehicles]
  );

  const setFilter = (field, value) => setFilters((prev) => ({ ...prev, [field]: value }));

  // Los filtros que mueven numeros (resumen, KPIs, grafico). El estado y el orden solo
  // cambian que acordeones se ven y como se ordenan las filas.
  const rawParams = useMemo(
    () => ({
      q: filters.q.trim() || undefined,
      driverId: filters.driverId || undefined,
      targa: filters.targa.trim() || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      fueraDePlazo: filters.fueraDePlazo ? "true" : undefined,
      asignacion: filters.asignacion || undefined,
      vence: filters.vence || undefined,
    }),
    [filters.q, filters.driverId, filters.targa, filters.from, filters.to, filters.fueraDePlazo, filters.asignacion, filters.vence]
  );
  const params = useDebounced(rawParams, 350);
  const paramsKey = JSON.stringify(params);
  const ordenParam = filters.orden || undefined;
  const listParams = useMemo(() => ({ ...params, orden: ordenParam }), [params, ordenParam]);

  // "vence" ya cuenta como filtro dentro de params.
  const activeFilterCount =
    Object.values(params).filter(Boolean).length + (filters.estado ? 1 : 0) + (ordenParam ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMancatoSummaryRequest(params), getMancatoStatsRequest(params)])
      .then(([summaryData, statsData]) => {
        if (!cancelled) {
          setSummary(summaryData);
          setStats(statsData);
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

  // Mes elegido en el selector: es un rango de fechas que justo coincide con un mes completo.
  const mesSeleccionado = useMemo(
    () => mesesOpciones.find((m) => filters.from === mesStart(m.mes) && filters.to === mesEnd(m.mes))?.mes ?? "",
    [mesesOpciones, filters.from, filters.to]
  );
  // Con un rango a mano (que no es un mes entero) los totales de cada mes tienen que respetarlo: se piden con las fechas.
  const customRange = Boolean((filters.from || filters.to) && !mesSeleccionado);
  const mesesParams = useMemo(() => {
    if (customRange) return params;
    const { from, to, ...rest } = params;
    return rest;
  }, [params, customRange]);
  const mesesKey = JSON.stringify(mesesParams);

  useEffect(() => {
    if (grupo !== "mes") return undefined;
    let cancelled = false;
    getMancatoMesesRequest(mesesParams)
      .then((data) => {
        if (cancelled) return;
        setMeses(data);
        if (!customRange) setMesesOpciones(data);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
    // mesesKey resume mesesParams (ver arriba).
  }, [grupo, mesesKey, version]);

  const setMes = (mes) =>
    setFilters((prev) => ({ ...prev, from: mes ? mesStart(mes) : "", to: mes ? mesEnd(mes) : "" }));

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const visibleEstados = MANCATO_ESTADOS_PAGAMENTO.filter((e) => !filters.estado || e.value === filters.estado);
  const sinResumen = { count: 0, total: 0 };
  const driverOptions = [
    { value: "", label: "Todos" },
    ...drivers.map((d) => ({ value: d.id, label: `${d.nombre} ${d.apellido}` })),
  ];
  const estadoOptions = [
    { value: "", label: "Todos" },
    ...MANCATO_ESTADOS_PAGAMENTO.map((e) => ({ value: e.value, label: e.label })),
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <p className="max-w-xl text-[14px] text-ink-300">
              {isPrivileged
                ? "Controla los avisos de pago omitido de toda la flota. Cada uno vence 13 dias despues de la fecha del aviso."
                : "Tus avisos de pago omitido. Cada uno vence 13 dias despues de la fecha del aviso."}
            </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {user?.cargo === "OWNER" && (
            <Button variant="ghost" className="w-full sm:w-auto sm:px-6" onClick={() => setReevaluar(true)}>
              <RefreshIcon className="h-4 w-4" />
              Reevaluar asignaciones
            </Button>
          )}
          <Link to="/finanzas/mancato/new" state={{ backgroundLocation: location }}>
            <Button className="w-full sm:w-auto sm:px-6">
              <PlusIcon className="h-4 w-4" />
              Nuevo registro
            </Button>
          </Link>
        </div>
      </div>

      <Alert>{error}</Alert>
      {!summary && !error && <PageLoader />}

      {summary && stats && (
        <div className="flex flex-col gap-4">
          <div className="flex min-w-0 flex-col gap-3">
            {/* Total del año (y del mes elegido) */}
            {stats.totales && (
              <MancatoTotalAnual
                totales={stats.totales}
                periodoLabel={
                  mesSeleccionado
                    ? mesLabel(mesSeleccionado)
                    : filters.from || filters.to
                      ? `${filters.from ? formatDateOnly(filters.from) : "…"} a ${filters.to ? formatDateOnly(filters.to) : "…"}`
                      : ""
                }
              />
            )}

            {/* Una sola barra: buscador + boton "Filtros" (abre un panel con el resto) + agrupar por mes o estado */}
            <div ref={filtersRef} className="relative flex flex-wrap items-center gap-2">
              <TextField
                id="filtro-q"
                icon={SearchIcon}
                placeholder="Buscar numero, targa, chofer o comentario"
                aria-label="Buscar"
                value={filters.q}
                onChange={(e) => setFilter("q", e.target.value)}
                className="min-w-[220px] flex-1"
              />
              <button
                type="button"
                onClick={() => setFiltersOpen((prev) => !prev)}
                aria-expanded={filtersOpen}
                className={clsx(
                  "flex items-center gap-2 rounded-xl glass-input px-4 py-3 text-[14px] font-medium transition-colors hover:bg-line/10",
                  filtersOpen || activeFilterCount > 0 ? "text-ink-50" : "text-ink-300"
                )}
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
                  title="Limpiar filtros"
                  className="flex items-center gap-1.5 rounded-xl glass-input px-3 py-3 text-[13px] font-medium text-ink-50 hover:bg-line/10"
                >
                  <RefreshIcon className="h-4 w-4" />
                  <span className="hidden md:inline">Limpiar</span>
                </button>
              )}
              <SegmentedControl
                options={[
                  { value: "mes", label: "Por mes" },
                  { value: "estado", label: "Por estado" },
                ]}
                value={grupo}
                onChange={setGrupo}
              />

              {filtersOpen && (
                <div className="glass-surface absolute right-0 top-full z-30 mt-2 grid w-full max-w-[640px] grid-cols-1 gap-3 rounded-2xl bg-background p-4 shadow-2xl sm:grid-cols-2">
                {grupo === "mes" && (
                  <div className="min-w-0">
                    <Select
                      id="filtro-mes"
                      label="Mes"
                      options={[
                        { value: "", label: customRange ? "Rango personalizado" : "Todos los meses" },
                        ...mesesOpciones.map((m) => ({ value: m.mes, label: `${mesLabel(m.mes)} (${m.count})` })),
                      ]}
                      value={mesSeleccionado}
                      onChange={(e) => setMes(e.target.value)}
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <Select
                    id="filtro-estado"
                    label="Estado"
                    options={estadoOptions}
                    value={filters.estado}
                    onChange={(e) => setFilter("estado", e.target.value)}
                  />
                </div>
                {isPrivileged && (
                  <div className="min-w-0">
                    <Select
                      id="filtro-chofer"
                      label="Chofer"
                      options={driverOptions}
                      value={filters.driverId}
                      onChange={(e) => setFilter("driverId", e.target.value)}
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <TextField
                    id="filtro-targa"
                    label="Targa"
                    placeholder="Ej. AB123CD"
                    list="mancato-filtro-targas"
                    autoComplete="off"
                    value={filters.targa}
                    onChange={(e) => setFilter("targa", e.target.value.toUpperCase())}
                  />
                  <datalist id="mancato-filtro-targas">
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.targa} />
                    ))}
                  </datalist>
                </div>
                {/* Rango de fechas a mano (sobre la fecha del aviso). Sirve para un solo dia
                    (mismo dia en las dos) o para un rango; se puede dejar uno vacio. */}
                <TextField
                  id="filtro-desde"
                  label="Desde"
                  type="date"
                  value={filters.from}
                  max={filters.to || undefined}
                  onChange={(e) => setFilter("from", e.target.value)}
                  className="min-w-0"
                />
                <TextField
                  id="filtro-hasta"
                  label="Hasta"
                  type="date"
                  value={filters.to}
                  min={filters.from || undefined}
                  onChange={(e) => setFilter("to", e.target.value)}
                  className="min-w-0"
                />
                <div className="min-w-0">
                  <Select
                    id="filtro-vence"
                    label="Vencimiento"
                    options={VENCE_OPTIONS}
                    value={filters.vence}
                    onChange={(e) => setFilter("vence", e.target.value)}
                  />
                </div>
                <div className="min-w-0">
                  <Select
                    id="filtro-orden"
                    label="Ordenar por"
                    options={ORDEN_OPTIONS}
                    value={filters.orden}
                    onChange={(e) => setFilter("orden", e.target.value)}
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 self-end rounded-xl glass-input px-4 py-3 text-[14px] text-ink-50">
                  <input
                    type="checkbox"
                    checked={filters.fueraDePlazo}
                    onChange={(e) => setFilter("fueraDePlazo", e.target.checked)}
                    className="h-4 w-4 accent-[var(--danger-500)]"
                  />
                  Registrados fuera de plazo
                </label>
                </div>
              )}
            </div>

            {/* Atajo de vencimiento: cuantos son y cuanto suman */}
            {filters.vence && (
              <div className="glass-surface-sm flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border-l-4 border-l-warning-500 px-4 py-2.5">
                <ClockIcon className="h-5 w-5 shrink-0 text-warning-500" />
                <span className="text-[15px] font-semibold text-ink-50">
                  {VENCE_OPTIONS.find((o) => o.value === filters.vence)?.label}
                </span>
                <span className="rounded-full bg-warning-500/20 px-2.5 py-0.5 text-[12px] font-semibold text-warning-500">
                  {summary.PENDIENTE?.count ?? 0}
                </span>
                <span className="ml-auto text-[16px] font-semibold text-ink-50">
                  {formatCurrency(summary.PENDIENTE?.total ?? 0)}
                </span>
              </div>
            )}

          </div>

          <div className="flex min-w-0 flex-col gap-6">
            {grupo === "mes" ? (
              <div className="flex flex-col gap-4">
                {meses === null && <PageLoader />}
                {meses?.length === 0 && (
                  <p className="px-1 py-4 text-[14px] text-ink-400">No hay mancato pagamento con estos filtros.</p>
                )}
                {(meses ?? [])
                  .filter((m) => !mesSeleccionado || m.mes === mesSeleccionado)
                  .map((mes, index) => (
                    <MesAccordion
                      // Al cambiar de filtros se reinicia la eleccion manual de abrir/cerrar.
                      key={`${mes.mes}-${hasActiveFilters ? "f" : "n"}`}
                      mes={mes}
                      params={listParams}
                      filters={filters}
                      version={version}
                      defaultOpen={Boolean(mesSeleccionado) || (index === 0 && mes.count > 0)}
                      showDriver={isPrivileged}
                      vehiclesByTarga={vehiclesByTarga}
                      location={location}
                      isPrivileged={isPrivileged}
                      onChanged={refresh}
                    />
                  ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {visibleEstados.map((estado) => (
                  <EstadoAccordion
                    // Al activar/desactivar filtros se reinicia la eleccion manual del usuario.
                    key={`${estado.value}-${hasActiveFilters ? "f" : "n"}`}
                    estado={estado.value}
                    summary={summary[estado.value] ?? sinResumen}
                    params={listParams}
                    version={version}
                    defaultOpen={
                      (summary[estado.value]?.count ?? 0) > 0 &&
                      (hasActiveFilters || (estado.value !== "PAGADO" && estado.value !== "HISTORIAL_VENCIDO"))
                    }
                    showDriver={isPrivileged}
                    vehiclesByTarga={vehiclesByTarga}
                    location={location}
                    isPrivileged={isPrivileged}
                    onChanged={refresh}
                  />
                ))}
              </div>

            )}
          </div>
        </div>
      )}
      {reevaluar && <ReevaluarMancatosModal onClose={() => setReevaluar(false)} onApplied={refresh} />}
    </div>
  );
};

// El chofer solo sube sus avisos; la oficina controla pagos, plazos y estados.
export const MancatoPagamentoPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  return isPrivileged ? <MancatoOficinaPage /> : <MancatoChoferPage />;
};
