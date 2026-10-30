import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MancatoBadge } from "../../components/mancato/MancatoBadge";
import { SugerenciaChip, useRowSuggestions } from "../../components/multas/MultaSugerencia";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { PageLoader } from "../../components/ui/PageLoader";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { TextField } from "../../components/ui/TextField";
import {
  ChevronDownIcon,
  CloseIcon,
  DotsIcon,
  ExpandIcon,
  FileTextIcon,
  FilterIcon,
  ImageIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
} from "../../components/ui/icons";
import { MultasChoferPage } from "./MultasChoferPage";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { formatCurrency, formatDateOnly } from "../../lib/format";
import { MULTA_ESTADOS, QUIEN_PAGA_OPTIONS, TITULAR_OPTIONS, quienPagaLabel, titularLabel } from "../../lib/multas";
import {
  getMultaSummaryRequest,
  listMultasRequest,
  updateMultaRequest,
} from "../../lib/multas.api";
import { listUsersRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

const PAGE_SIZE = 20;

const EMPTY_FILTERS = {
  estado: "",
  driverId: "",
  targa: "",
  from: "",
  to: "",
  quienPaga: "",
  descuentoPendiente: false,
  titular: "",
  q: "",
  orden: "",
};

const TITULAR_FILTER_OPTIONS = [
  { value: "", label: "Todos" },
  ...TITULAR_OPTIONS,
  { value: "SIN", label: "Sin indicar" },
];

const TITULAR_TONE = {
  SRL: "bg-accent-500/15 text-accent-300",
  INDIVIDUAL: "bg-[#a78bfa]/15 text-[#a78bfa]",
};

const ORDEN_OPTIONS = [
  { value: "", label: "Mas urgentes" },
  { value: "recientes", label: "Mas recientes" },
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

const QUIEN_PAGA_TONE = {
  neutral: "bg-ink-500/15 text-ink-300",
  warning: "bg-warning-500/20 text-warning-500",
  success: "bg-success-500/15 text-success-500",
};

// Espera a que se deje de tipear/cambiar antes de pegarle al backend.
const useDebounced = (value, ms) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeoutId = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timeoutId);
  }, [value, ms]);
  return debounced;
};

// Columnas de la tabla (escritorio), en este orden: Estado, Chofer responsable, Titular (SRL / Individual), Targa, Recepcion, Vencimiento, Costo, N. verbale,
// ¿Chofer pago?, Foto o PDF y el menu. Anchos fijos: si la pantalla no alcanza, la tabla se desliza de costado en vez de apretar
// los datos unos contra otros.
const TABLE_COLS = "lg:grid-cols-[130px_210px_96px_100px_110px_140px_105px_180px_140px_72px_40px]";
const TABLE_MIN_WIDTH = "lg:min-w-[1500px]";

const plazoParts = (m) => {
  if (m.estado === "PAGADO") {
    return {
      top: m.pagadoAt ? `Pagada ${formatDateOnly(m.pagadoAt)}` : "Pagada",
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
  return { top, bottom: `en ${dias} ${dias === 1 ? "dia" : "dias"}`, tone: dias <= 7 ? "text-warning-500" : "text-ink-400" };
};

// Menu "..." de cada fila: acciones rapidas sin abrir el detalle (solo la oficina puede
// cambiar el estado). Se dibuja fuera de la tabla (portal) para que no lo recorte la barra de desplazamiento.
const RowMenu = ({ multa, isPrivileged, location, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const onDown = (e) => {
      if (buttonRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight = 130;
      const top = rect.bottom + menuHeight > window.innerHeight ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4;
      setPos({ top, left: Math.max(8, rect.right - 224) });
    }
    setOpen((prev) => !prev);
  };

  const update = async (fields) => {
    setBusy(true);
    try {
      await updateMultaRequest(multa.id, fields);
      onChanged();
    } catch {
      // El detalle muestra el error con mas contexto; aca solo se cierra el menu.
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const itemClass =
    "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink-50 transition-colors hover:bg-line/10";

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Acciones"
        aria-expanded={open}
        onClick={toggle}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-line/10 hover:text-ink-50"
      >
        {busy ? <Spinner className="h-4 w-4" /> : <DotsIcon className="h-5 w-5" />}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            data-row-menu
            style={{ top: pos.top, left: pos.left }}
            className="glass-surface fixed z-50 w-56 overflow-hidden rounded-xl bg-background py-1 shadow-xl"
          >
            <Link to={`/finanzas/multas/${multa.id}`} state={{ backgroundLocation: location }} className={itemClass}>
              Ver y editar
            </Link>
            {isPrivileged && (
              <button
                type="button"
                disabled={busy}
                onClick={() => update({ pagado: String(!multa.pagado) })}
                className={itemClass}
              >
                {multa.pagado ? "Reabrir (marcar pendiente)" : "Marcar como pagada"}
              </button>
            )}
            {isPrivileged && multa.quienPaga === "A_DESCONTAR" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => update({ descontado: String(!multa.descontado) })}
                className={itemClass}
              >
                {multa.descontado ? "Quitar marca de descontado" : "Marcar como descontado"}
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

// Icono para abrir la foto o el PDF de la multa (en otra pestaña), sin entrar al detalle.
const ArchivoLink = ({ archivo }) => {
  if (!archivo?.url) return <span className="text-[13px] text-ink-500">-</span>;
  const Icon = archivo.esPdf ? FileTextIcon : ImageIcon;
  const title = archivo.esPdf ? "Abrir el PDF de la multa" : "Abrir la foto de la multa";
  return (
    <a
      href={archivo.url}
      target="_blank"
      rel="noreferrer"
      title={title}
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg glass-surface-sm text-accent-400 transition-colors hover:bg-accent-500/15 hover:text-accent-300"
    >
      <Icon className="h-[18px] w-[18px]" />
    </a>
  );
};

const MultaRow = ({ multa, showDriver, location, isPrivileged, onChanged, sugerencia }) => {
  const navigate = useNavigate();
  const estado = MULTA_ESTADOS.find((e) => e.value === multa.estado);
  const plazo = plazoParts(multa);
  const quien = quienPagaLabel(multa);
  const driverName = multa.driver ? `${multa.driver.nombre} ${multa.driver.apellido}` : "Sin chofer";
  const openDetail = () => navigate(`/finanzas/multas/${multa.id}`, { state: { backgroundLocation: location } });

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={(e) => e.key === "Enter" && openDetail()}
      className={clsx(
        "relative grid cursor-pointer grid-cols-1 gap-2 rounded-xl border-l-4 px-4 py-3 pr-14 transition-colors hover:bg-line/[0.07] focus:outline-none focus-visible:bg-line/[0.07] lg:items-center lg:gap-x-4 lg:rounded-lg lg:border-l-0 lg:border-b lg:border-b-line/10 lg:py-3 lg:pr-4",
        estado.edge,
        TABLE_COLS
      )}
    >
      {/* Estado */}
      <div>
        <MancatoBadge mancato={multa} />
        {multa.comprobantePendiente && (
          <span className="mt-1 block text-[11px] font-medium text-accent-300">Comprobante por confirmar</span>
        )}
      </div>

      {/* Chofer responsable */}
      {showDriver && (
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{ backgroundColor: avatarColor(driverName) }}
          >
            {initials(driverName)}
          </span>
          <div className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-ink-50" title={driverName}>
              {driverName}
            </span>
            {!multa.driver && <SugerenciaChip sugerencia={sugerencia} className="lg:hidden" />}
          </div>
        </div>
      )}

      {/* Titular del verbale */}
      <div>
        <span
          className={clsx(
            "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium",
            TITULAR_TONE[multa.titular] ?? "bg-line/10 text-ink-400"
          )}
        >
          {titularLabel(multa.titular)}
        </span>
      </div>

      {/* Targa */}
      <span className="whitespace-nowrap text-[13px] font-medium tracking-wide text-ink-50">{multa.targa}</span>

      {/* Fecha de recepcion */}
      <span className="whitespace-nowrap text-[13px] text-ink-50">{formatDateOnly(multa.fechaRecepcion)}</span>

      {/* Fecha de vencimiento */}
      <div className="min-w-0 whitespace-nowrap">
        <span className="block text-[13px] text-ink-50">{plazo.top}</span>
        <span className={clsx("block text-[12px] font-medium", plazo.tone)}>{plazo.bottom}</span>
      </div>

      {/* Costo */}
      <span className="whitespace-nowrap text-[14px] font-semibold text-ink-50 lg:text-right">{formatCurrency(multa.costo)}</span>

      {/* N. verbale */}
      <span className="whitespace-nowrap text-[13px] text-ink-200" title={multa.numeroVerbale}>
        #{multa.numeroVerbale}
      </span>

      {/* ¿Chofer pago? */}
      <div>
        <span
          className={clsx(
            "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium",
            QUIEN_PAGA_TONE[quien.tone]
          )}
        >
          {quien.text}
        </span>
      </div>

      {/* Foto o PDF */}
      <div className="lg:flex lg:justify-center">
        <ArchivoLink archivo={multa.multa} />
      </div>

      <div className="absolute right-3 top-3 lg:static">
        <RowMenu multa={multa} isPrivileged={isPrivileged} location={location} onChanged={onChanged} />
      </div>

      {/* Escritorio: la sugerencia va en una linea propia, porque la columna del chofer es angosta */}
      {showDriver && !multa.driver && sugerencia?.candidatos?.length > 0 && (
        <div className="hidden min-w-0 lg:col-span-full lg:block">
          <SugerenciaChip sugerencia={sugerencia} wide />
        </div>
      )}
    </div>
  );
};

// Pide las multas de un estado (de a pageSize) cuando "active"; se vuelve a pedir si cambian los filtros o los datos.
const useMultaList = ({ estado, params, version, active, pageSize }) => {
  const [list, setList] = useState({ items: null, total: 0, page: 1, loading: false, error: "" });
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    if (!active) {
      setList((prev) => (prev.items ? { ...prev, items: null } : prev));
      return undefined;
    }
    let cancelled = false;
    setList((prev) => ({ ...prev, loading: true, error: "" }));
    listMultasRequest({ ...params, estado, page: 1, pageSize })
      .then((data) => {
        if (!cancelled) setList({ items: data.items, total: data.total, page: 1, loading: false, error: "" });
      })
      .catch((err) => {
        if (!cancelled) setList((prev) => ({ ...prev, loading: false, error: parseApiError(err).message }));
      });
    return () => {
      cancelled = true;
    };
    // paramsKey resume params: evita re-pedir por un objeto nuevo con el mismo contenido.
  }, [active, paramsKey, version, estado, pageSize]);

  const loadMore = async () => {
    const nextPage = list.page + 1;
    setList((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const data = await listMultasRequest({ ...params, estado, page: nextPage, pageSize });
      setList((prev) => {
        // Si entre pagina y pagina cambio el orden, una multa podria venir dos veces: no se repite.
        const seen = new Set((prev.items ?? []).map((m) => m.id));
        return {
          items: [...(prev.items ?? []), ...data.items.filter((m) => !seen.has(m.id))],
          total: data.total,
          page: nextPage,
          loading: false,
          error: "",
        };
      });
    } catch (err) {
      setList((prev) => ({ ...prev, loading: false, error: parseApiError(err).message }));
    }
  };

  return [list, loadMore];
};

// Encabezado de columnas + filas + pie ("Mostrando X de Y" / Ver mas). La tabla tiene su propia barra de desplazamiento (de costado y
// hacia abajo) para que se vea siempre; el encabezado queda fijo. Con "expanded" ocupa todo el alto disponible.
const MultasTable = ({ list, onLoadMore, label, expanded, showDriver, location, isPrivileged, onChanged }) => {
  const suggestions = useRowSuggestions(list.items, isPrivileged && showDriver);
  const remaining = list.items ? list.total - list.items.length : 0;
  const headerClass = "text-[11px] font-medium uppercase tracking-wide text-ink-400 whitespace-nowrap";

  return (
    <div className={clsx(expanded && "flex min-h-0 flex-1 flex-col")}>
      <Alert>{list.error}</Alert>

      {list.items === null && list.loading && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}

      {list.items?.length === 0 && <p className="px-3 py-4 text-[14px] text-ink-400">No hay multas {label}.</p>}

      {list.items?.length > 0 && (
        <>
          <div className={clsx("h-scroll pb-2", expanded ? "min-h-0 flex-1 overflow-auto" : "overflow-x-auto lg:max-h-[65vh] lg:overflow-auto")}>
            <div className={TABLE_MIN_WIDTH}>
              <div
                className={clsx(
                  "hidden gap-x-4 px-4 py-2 lg:sticky lg:top-0 lg:z-10 lg:grid lg:border-b lg:border-line/10 lg:bg-background",
                  TABLE_COLS
                )}
              >
                <span className={headerClass}>Estado</span>
                {showDriver && <span className={headerClass}>Chofer responsable</span>}
                <span className={headerClass}>Titular</span>
                <span className={headerClass}>Targa</span>
                <span className={headerClass}>Recepcion</span>
                <span className={headerClass}>Vencimiento</span>
                <span className={clsx(headerClass, "text-right")}>Costo</span>
                <span className={headerClass}>N. verbale</span>
                <span className={headerClass}>¿Chofer pago?</span>
                <span className={clsx(headerClass, "text-center")}>Foto / PDF</span>
                <span />
              </div>

              <div className="flex flex-col gap-2 lg:gap-0">
                {list.items.map((multa) => (
                  <MultaRow
                    key={multa.id}
                    multa={multa}
                    showDriver={showDriver}
                    location={location}
                    isPrivileged={isPrivileged}
                    onChanged={onChanged}
                    sugerencia={suggestions[multa.id]}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-col items-center justify-between gap-2 px-3 sm:flex-row">
            <span className="text-[12px] text-ink-400">
              Mostrando {list.items.length} de {list.total} {list.total === 1 ? "multa" : "multas"}
            </span>
            {remaining > 0 && (
              <Button variant="ghost" className="py-2 text-[13px] sm:w-auto sm:px-5" loading={list.loading} onClick={onLoadMore}>
                Ver mas ({remaining} restantes)
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const ESTADO_LABEL = { VENCIDO: "vencidas", PENDIENTE: "pendientes", PAGADO: "pagadas" };
const EXPANDED_PAGE_SIZE = 50; // el maximo que acepta el servidor por pagina

// Acordeon de un estado: el encabezado muestra cantidad y total (viene del resumen, sin
// traer filas); la tabla se pide recien al abrirlo y de a PAGE_SIZE.
const EstadoAccordion = ({
  estado,
  summary,
  params,
  version,
  defaultOpen,
  showDriver,
  location,
  isPrivileged,
  onChanged,
  onExpand,
}) => {
  const info = MULTA_ESTADOS.find((e) => e.value === estado);
  // Mientras el usuario no lo toque, abre o cierra solo segun haya resultados; si lo toca,
  // se respeta su eleccion.
  const [userOpen, setUserOpen] = useState(null);
  const open = userOpen ?? defaultOpen;
  const [list, loadMore] = useMultaList({ estado, params, version, active: open, pageSize: PAGE_SIZE });
  const label = ESTADO_LABEL[estado];

  // focus-within: la seccion con un menu abierto sube por encima de las de abajo.
  return (
    <section className={clsx("glass-surface relative rounded-2xl border-l-4 focus-within:z-20", info.edge)}>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setUserOpen(!open)}
          aria-expanded={open}
          className={clsx(
            "flex min-w-0 flex-1 items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-line/[0.05]",
            open ? "rounded-tl-2xl" : "rounded-l-2xl"
          )}
        >
          <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", info.dot)} />
          <span className="text-[16px] font-semibold capitalize text-ink-50">{label}</span>
          <span className={clsx("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", info.pill)}>
            {summary.count}
          </span>
          <span className="ml-auto text-[15px] font-semibold text-ink-50">{formatCurrency(summary.total)}</span>
        </button>
        <button
          type="button"
          onClick={onExpand}
          title="Ver en pantalla completa"
          aria-label={`Expandir ${label} a pantalla completa`}
          className="mx-1 flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-300 transition-colors hover:bg-line/10 hover:text-ink-50"
        >
          <ExpandIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Expandir</span>
        </button>
        <button
          type="button"
          onClick={() => setUserOpen(!open)}
          aria-label={open ? "Cerrar" : "Abrir"}
          className={clsx(
            "flex shrink-0 items-center px-4 py-4 transition-colors hover:bg-line/[0.05]",
            open ? "rounded-tr-2xl" : "rounded-r-2xl"
          )}
        >
          <ChevronDownIcon className={clsx("h-5 w-5 shrink-0 text-ink-300 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="border-t border-line/10 px-2 pb-3 pt-1 sm:px-3">
          <MultasTable
            list={list}
            onLoadMore={loadMore}
            label={label}
            showDriver={showDriver}
            location={location}
            isPrivileged={isPrivileged}
            onChanged={onChanged}
          />
        </div>
      )}
    </section>
  );
};

// Vista expandida: todas las multas de un estado en pantalla completa, como una lista simple (sin acordeon). Se puede pasar de un
// estado a otro desde las pestañas de arriba; al tocar una multa se abre su detalle para editarla, y "Cerrar" vuelve a la pantalla de siempre.
const MultasExpandida = ({ estado, summary, params, version, showDriver, location, isPrivileged, onChanged, onChangeEstado, onClose }) => {
  const info = MULTA_ESTADOS.find((e) => e.value === estado);
  const label = ESTADO_LABEL[estado];
  const [list, loadMore] = useMultaList({ estado, params, version, active: true, pageSize: EXPANDED_PAGE_SIZE });
  const detailOpen = Boolean(location.state?.backgroundLocation);

  useEffect(() => {
    const onKey = (e) => {
      // Con el detalle de una multa o el menu de una fila abiertos, Escape cierra eso y no esta vista.
      if (e.key === "Escape" && !detailOpen && !document.querySelector("[data-row-menu]")) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [detailOpen, onClose]);

  // Debajo de la barra de arriba de la app (que siempre queda visible) y por encima del menu lateral y del resto de la pagina.
  return createPortal(
    <div className="fixed inset-x-0 bottom-0 top-0 z-20 flex flex-col bg-background sm:top-16">
      <div className="flex flex-wrap items-center gap-3 border-b border-line/10 px-5 py-3">
        <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", info.dot)} />
        <h2 className="text-[18px] font-semibold capitalize text-ink-50">Multas {label}</h2>
        <span className={clsx("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", info.pill)}>{summary[estado].count}</span>
        <span className="text-[15px] font-semibold text-ink-50">{formatCurrency(summary[estado].total)}</span>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-1 rounded-xl glass-surface-sm p-1 sm:flex">
            {MULTA_ESTADOS.map((e) => (
              <button
                key={e.value}
                type="button"
                onClick={() => onChangeEstado(e.value)}
                className={clsx(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                  e.value === estado ? "bg-accent-500/20 text-ink-50" : "text-ink-300 hover:bg-line/10 hover:text-ink-50"
                )}
              >
                <span className={clsx("h-2 w-2 rounded-full", e.dot)} />
                {ESTADO_LABEL[e.value]}
                <span className="text-[12px] text-ink-400">{summary[e.value].count}</span>
              </button>
            ))}
          </div>
          <Button variant="ghost" className="w-auto gap-2 px-4 py-2 text-[14px]" onClick={onClose}>
            <CloseIcon className="h-4 w-4" />
            Cerrar
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 pt-2 sm:px-5">
        <MultasTable
          expanded
          list={list}
          onLoadMore={loadMore}
          label={label}
          showDriver={showDriver}
          location={location}
          isPrivileged={isPrivileged}
          onChanged={onChanged}
        />
      </div>
    </div>,
    document.body
  );
};

const MultasOficinaPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const { version, refresh } = useDataRefresh("multas");

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  // Panel de filtros (se abre con el boton "Filtros", igual que en Mancato Pagamento); un clic fuera lo cierra.
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
  const [error, setError] = useState("");
  // Estado que se esta viendo en pantalla completa (null = la pantalla de siempre).
  const [expandedEstado, setExpandedEstado] = useState(null);

  useEffect(() => {
    listVehiclesRequest().then(setVehicles).catch(() => {});
    if (isPrivileged) {
      listUsersRequest()
        .then((users) => setDrivers(users.filter((u) => u.estado === "ACTIVO")))
        .catch(() => {});
    }
  }, [isPrivileged]);

  const setFilter = (field, value) => setFilters((prev) => ({ ...prev, [field]: value }));

  // Los filtros que cambian los totales de cada acordeon. El estado y el orden solo
  // cambian que acordeones se ven y como se ordenan las filas.
  const rawParams = useMemo(
    () => ({
      q: filters.q.trim() || undefined,
      driverId: filters.driverId || undefined,
      targa: filters.targa.trim() || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      quienPaga: filters.quienPaga || undefined,
      descuentoPendiente: filters.descuentoPendiente ? "true" : undefined,
      titular: filters.titular || undefined,
    }),
    [
      filters.q,
      filters.driverId,
      filters.targa,
      filters.from,
      filters.to,
      filters.quienPaga,
      filters.descuentoPendiente,
      filters.titular,
    ]
  );
  const params = useDebounced(rawParams, 350);
  const paramsKey = JSON.stringify(params);
  const listParams = useMemo(() => ({ ...params, orden: filters.orden || undefined }), [params, filters.orden]);

  const activeFilterCount =
    Object.values(params).filter(Boolean).length + (filters.estado ? 1 : 0) + (filters.orden ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  useEffect(() => {
    let cancelled = false;
    getMultaSummaryRequest(params)
      .then((summaryData) => {
        if (!cancelled) {
          setSummary(summaryData);
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

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const visibleEstados = MULTA_ESTADOS.filter((e) => !filters.estado || e.value === filters.estado);
  const driverOptions = [
    { value: "", label: "Todos" },
    ...drivers.map((d) => ({ value: d.id, label: `${d.nombre} ${d.apellido}` })),
  ];
  const estadoOptions = [
    { value: "", label: "Todos" },
    ...MULTA_ESTADOS.map((e) => ({ value: e.value, label: e.label })),
  ];
  const quienPagaOptions = [{ value: "", label: "Todos" }, ...QUIEN_PAGA_OPTIONS.map((o) => ({ value: o.value, label: o.label.replace(/^(Si|No), /, "") }))];

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <p className="max-w-xl text-[14px] text-ink-300">
          Controla las multas de la flota: vencimientos, pagos y lo que hay que descontar a los choferes.
        </p>
        {isPrivileged && (
          <Link to="/finanzas/multas/new" state={{ backgroundLocation: location }}>
            <Button className="w-full sm:w-auto sm:px-6">
              <PlusIcon className="h-4 w-4" />
              Nueva multa
            </Button>
          </Link>
        )}
      </div>

      <Alert>{error}</Alert>
      {!summary && !error && <PageLoader />}

      {summary && (
        <div className="flex min-w-0 flex-col gap-4">
          {/* Una sola barra: buscador + boton "Filtros" (abre un panel con el resto), como en Mancato Pagamento */}
          <div ref={filtersRef} className="relative flex flex-wrap items-center gap-2">
            <TextField
              id="filtro-q"
              icon={SearchIcon}
              placeholder="Buscar verbale, targa, chofer o comentario"
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

            {filtersOpen && (
              <div className="glass-surface absolute right-0 top-full z-30 mt-2 grid w-full max-w-[640px] grid-cols-1 gap-3 rounded-2xl bg-background p-4 shadow-2xl sm:grid-cols-2">
                <div className="min-w-0">
                  <Select
                    id="filtro-estado"
                    label="Estado"
                    options={estadoOptions}
                    value={filters.estado}
                    onChange={(e) => setFilter("estado", e.target.value)}
                  />
                </div>
                <div className="min-w-0">
                  <Select
                    id="filtro-titular"
                    label="Titular"
                    options={TITULAR_FILTER_OPTIONS}
                    value={filters.titular}
                    onChange={(e) => setFilter("titular", e.target.value)}
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
                    list="multas-filtro-targas"
                    autoComplete="off"
                    value={filters.targa}
                    onChange={(e) => setFilter("targa", e.target.value.toUpperCase())}
                  />
                  <datalist id="multas-filtro-targas">
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.targa} />
                    ))}
                  </datalist>
                </div>
                {/* Rango de fechas sobre la fecha de recepcion; se puede dejar uno vacio. */}
                <TextField
                  id="filtro-desde"
                  label="Recepcion desde"
                  type="date"
                  value={filters.from}
                  max={filters.to || undefined}
                  onChange={(e) => setFilter("from", e.target.value)}
                  className="min-w-0"
                />
                <TextField
                  id="filtro-hasta"
                  label="Recepcion hasta"
                  type="date"
                  value={filters.to}
                  min={filters.from || undefined}
                  onChange={(e) => setFilter("to", e.target.value)}
                  className="min-w-0"
                />
                <div className="min-w-0">
                  <Select
                    id="filtro-quien-paga"
                    label="¿Chofer pago?"
                    options={quienPagaOptions}
                    value={filters.quienPaga}
                    onChange={(e) => setFilter("quienPaga", e.target.value)}
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
                <label className="flex cursor-pointer items-center gap-2.5 self-end rounded-xl glass-input px-4 py-3 text-[14px] text-ink-50 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={filters.descuentoPendiente}
                    onChange={(e) => setFilter("descuentoPendiente", e.target.checked)}
                    className="h-4 w-4 accent-[var(--warning-500)]"
                  />
                  Descuento pendiente
                </label>
              </div>
            )}
          </div>

          {/* Acordeones por estado */}
          <div className="flex flex-col gap-4">
            {visibleEstados.map((estado) => (
              <EstadoAccordion
                // Al activar/desactivar filtros se reinicia la eleccion manual del usuario.
                key={`${estado.value}-${hasActiveFilters ? "f" : "n"}`}
                estado={estado.value}
                summary={summary[estado.value]}
                params={listParams}
                version={version}
                defaultOpen={summary[estado.value].count > 0 && (hasActiveFilters || estado.value !== "PAGADO")}
                showDriver={isPrivileged}
                location={location}
                isPrivileged={isPrivileged}
                onChanged={refresh}
                onExpand={() => setExpandedEstado(estado.value)}
              />
            ))}
          </div>
        </div>
      )}

      {expandedEstado && summary && (
        <MultasExpandida
          estado={expandedEstado}
          summary={summary}
          params={listParams}
          version={version}
          showDriver={isPrivileged}
          location={location}
          isPrivileged={isPrivileged}
          onChanged={refresh}
          onChangeEstado={setExpandedEstado}
          onClose={() => setExpandedEstado(null)}
        />
      )}
    </div>
  );
};

// El chofer ve sus multas de forma simple; la oficina, el panel de gestion.
export const MultasPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  return isPrivileged ? <MultasOficinaPage /> : <MultasChoferPage />;
};
