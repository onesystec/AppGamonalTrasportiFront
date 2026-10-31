import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { MapSectionTabs } from "../../components/layout/MapSectionTabs";
import { Alert } from "../../components/ui/Alert";
import { AlertTriangleIcon, ChevronLeftIcon, PhoneIcon, SearchIcon, TruckIcon } from "../../components/ui/icons";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { parseApiError } from "../../lib/api";
import { HIDE_POI_STYLES, NIGHT_MODE_STYLES } from "../../lib/mapStyles";
import { startVisibleInterval } from "../../lib/polling";
import {
  FUENTE_GPS_LABEL,
  gpsAgeText,
  RETRASO_AVISO_MIN,
  SEGUIMIENTO_COLOR_RETRASO,
  SEGUIMIENTO_COLOR_SIN_GPS,
  SEGUIMIENTO_COLOR_SOBRE_ETA,
  SEGUIMIENTO_TIPOS,
  horaRoma,
  llegadaTexto,
  minutosHHMM,
  minutosTexto,
  tipoMeta,
} from "../../lib/seguimiento";
import { getRutaSeguimientoRequest, listSeguimientoRequest } from "../../lib/seguimiento.api";
import { PEAJE_COLOR_CERCA } from "../../lib/peajes";
import { PeajesLayer } from "../../components/mapa/PeajesLayer";

// Mismo arreglo vacio que MapPage: el script de Google Maps se carga una sola vez.
const GOOGLE_MAPS_LIBRARIES = [];
const MILAN_CENTER = { lat: 45.4642, lng: 9.19 };
const REFRESH_INTERVAL_MS = 30000;
const MAP_IDLE_MS = 15 * 60 * 1000;
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

const retrasado = (s) => s.retrasoMin > RETRASO_AVISO_MIN;

const markerIcon = (s) => {
  const color = tipoMeta(s.tipo).color;
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    scale: 10,
    fillColor: color,
    fillOpacity: s.gps?.fuente === "SIMULADO" ? 0.45 : 0.95,
    strokeColor: s.sinGps ? SEGUIMIENTO_COLOR_SIN_GPS : "#ffffff",
    strokeWeight: s.sinGps ? 4 : 2,
    labelOrigin: new window.google.maps.Point(0, 2.6),
  };
};

// Una tarjeta por servicio: tipo, chofer, destino y cuanto falta para llegar. En rojo si no hay ningun GPS (y con el
// telefono del chofer para llamarlo); en ambar si ya se paso de su ETA.
const ServicioItem = ({ s, active, onSelect }) => {
  const tipo = tipoMeta(s.tipo);
  const tarde = retrasado(s);
  const simulado = s.gps?.fuente === "SIMULADO" || !s.gps;
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(s)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(s)}
        className={`cursor-pointer rounded-xl border px-3 py-2.5 text-left transition-colors ${
          s.sinGps
            ? "border-[#ff3b57]/60 bg-[#ff3b57]/10 hover:bg-[#ff3b57]/15"
            : "border-line/10 hover:bg-line/10"
        } ${active ? "ring-2 ring-accent-500/60" : ""}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tipo.color }} />
            <span className="truncate text-[13px] font-semibold tracking-wide text-ink-50">{s.codigo}</span>
          </span>
          <span className="shrink-0 rounded-full border border-line/15 px-2 py-0.5 text-[10.5px] font-medium text-ink-300">
            {s.totalViaje > 1 ? `Viaje ${s.orden}/${s.totalViaje}` : tipo.label}
          </span>
        </div>
        <p className="mt-1 truncate text-[12px] text-ink-300">
          {s.chofer.nombre} · {s.vehiculo ?? "Sin vehículo"}
        </p>
        <p className="truncate text-[12px] text-ink-300">{s.destino}</p>

        {s.llego ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-[#22e093]">
            <span aria-hidden>✓</span>
            {llegadaTexto(s.llegoAt, s.puntualidadMin)}
          </p>
        ) : (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[13px] font-semibold text-ink-50">
            {simulado
              ? `Prevista ${horaRoma(s.llegadaEstimada)}`
              : `Llega en ${minutosTexto(s.minutosRestantes)} · ${horaRoma(s.llegadaEstimada)}`}
          </span>
          <span className="text-[11.5px] text-ink-400">ETA {horaRoma(s.etaPlan)}</span>
          {tarde && (
            <span className="text-[11.5px] font-semibold" style={{ color: SEGUIMIENTO_COLOR_SOBRE_ETA }}>
              +{minutosHHMM(s.retrasoMin)} sobre la ETA
            </span>
          )}
        </div>
        )}

        {s.sinGps ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: SEGUIMIENTO_COLOR_SIN_GPS }}>
              <AlertTriangleIcon className="h-4 w-4 shrink-0" />
              Sin GPS · llámalo ahora
            </span>
            {s.chofer.telefono && (
              <a
                href={`tel:${s.chofer.telefono}`}
                onClick={(e) => e.stopPropagation()}
                className="flex shrink-0 items-center gap-1 rounded-full bg-[#ff3b57] px-2.5 py-1 text-[11.5px] font-semibold text-white hover:brightness-110"
              >
                <PhoneIcon className="h-3.5 w-3.5" />
                Llamar
              </a>
            )}
          </div>
        ) : (
          s.gps && <p className="mt-1 text-[11px] text-ink-400">{FUENTE_GPS_LABEL[s.gps.fuente]}{gpsAgeText(s.gps)}</p>
        )}
      </div>
    </li>
  );
};

// Servicio asignado que todavia no salio: sin GPS ni llegada estimada, solo lo que esta planificado.
const ProgramadoItem = ({ s }) => {
  const tipo = tipoMeta(s.tipo);
  return (
    <li>
      <div className="rounded-xl border border-line/10 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tipo.color }} />
            <span className="truncate text-[13px] font-semibold tracking-wide text-ink-50">{s.codigo}</span>
          </span>
          <span className="shrink-0 rounded-full border border-line/15 px-2 py-0.5 text-[10.5px] font-medium text-ink-300">{tipo.label}</span>
        </div>
        <p className="mt-1 truncate text-[12px] text-ink-300">
          {s.chofer.nombre} · {s.vehiculo ?? "Sin vehículo"}
        </p>
        <p className="truncate text-[12px] text-ink-300">{s.destino}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[13px] font-semibold text-ink-50">
            {s.salidaPlan ? `Sale ${diaHoraRoma(s.salidaPlan)}` : "Sin salir"}
          </span>
          <span className="text-[11.5px] text-ink-400">ETA {diaHoraRoma(s.etaPlan)}</span>
          {s.sinSalir && (
            <span className="text-[11.5px] font-semibold" style={{ color: SEGUIMIENTO_COLOR_RETRASO }}>
              Aún sin iniciar
            </span>
          )}
        </div>
        {s.chofer.telefono && (
          <a href={`tel:${s.chofer.telefono}`} className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent-400 hover:text-accent-300">
            <PhoneIcon className="h-3.5 w-3.5" />
            Llamar al chofer
          </a>
        )}
      </div>
    </li>
  );
};

// Hora de Roma; con el dia delante si no es hoy.
const diaHoraRoma = (value) => {
  const date = new Date(value);
  const dia = (d) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
  if (dia(date) === dia(new Date())) return horaRoma(value);
  return `${date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "Europe/Rome" })} ${horaRoma(value)}`;
};

// Linea de tiempo de un viaje compactado: el orden de los servicios y la hora aproximada de llegada a cada uno.
const LineaDeTiempo = ({ servicio, onSelect }) => (
  <div className="glass-surface absolute inset-x-3 bottom-3 z-10 rounded-2xl px-4 pb-3 pt-2.5">
    <p className="mb-2 text-[12px] font-semibold text-ink-50">
      Viaje compactado · {servicio.chofer.nombre} · {servicio.vehiculo}
    </p>
    <ol className="flex gap-0 overflow-x-auto pb-1">
      {servicio.timeline.map((t, index) => {
        const hecho = t.entregado || t.llego;
        const tarde = !hecho && t.retrasoMin > RETRASO_AVISO_MIN;
        const actual = t.id === servicio.id;
        const color = hecho ? "#22e093" : tarde ? SEGUIMIENTO_COLOR_RETRASO : "#3987e5";
        return (
          <li key={t.id} className="flex min-w-[150px] flex-1 flex-col">
            <div className="flex items-center">
              <button
                type="button"
                disabled={t.entregado}
                onClick={() => onSelect(t.id)}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ${
                  actual ? "ring-2 ring-white/80" : ""
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Servicio ${t.orden}: ${t.codigo}`}
              >
                {hecho ? "✓" : t.orden}
              </button>
              {index < servicio.timeline.length - 1 && <span className="h-0.5 flex-1" style={{ backgroundColor: `${color}88` }} />}
            </div>
            <div className="mt-1.5 pr-3">
              <p className="truncate text-[12px] font-semibold text-ink-50">{t.codigo}</p>
              <p className="truncate text-[11.5px] text-ink-300">{t.destino}</p>
              {t.entregado ? (
                <p className="text-[11.5px] font-medium text-[#22e093]">Entregado</p>
              ) : t.llego ? (
                <p className="text-[11.5px] font-medium text-[#22e093]">{llegadaTexto(t.llegoAt, t.puntualidadMin)}</p>
              ) : (
                <p className="text-[11.5px] text-ink-300">
                  ETA {horaRoma(t.etaPlan)} ·{" "}
                  <span className="font-semibold" style={{ color: tarde ? SEGUIMIENTO_COLOR_SOBRE_ETA : undefined }}>
                    llega ~{horaRoma(t.llegadaEstimada)}
                  </span>
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  </div>
);

export const SeguimientoPage = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const [searchParams] = useSearchParams();

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  const [map, setMap] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(searchParams.get("servicio"));
  const [ruta, setRuta] = useState(null);
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  // "camino": los que ya salieron (con GPS); "programados": asignados que todavia no salieron.
  const [vista, setVista] = useState("camino");
  const [query, setQuery] = useState("");
  const [showPeajes, setShowPeajes] = useState(true);
  // Por defecto no se muestran los servicios con muchas horas de retraso (olvidados, sin cerrar): "Ver antiguos" los trae para poder cerrarlos.
  const [verAntiguos, setVerAntiguos] = useState(false);
  const [listOpen, setListOpen] = useState(
    () => typeof window === "undefined" || window.matchMedia("(min-width: 640px)").matches
  );
  const fittedRef = useRef(null);

  useEffect(() => {
    if (!isPrivileged) return undefined;
    let cancelled = false;
    const load = () =>
      listSeguimientoRequest({ incluirAntiguos: verAntiguos })
        .then((result) => {
          if (!cancelled) {
            setData(result);
            setError("");
          }
        })
        .catch((err) => {
          if (!cancelled) setError(parseApiError(err).message);
        });
    load();
    const stop = startVisibleInterval(load, REFRESH_INTERVAL_MS, { idleMs: MAP_IDLE_MS });
    return () => {
      cancelled = true;
      stop();
    };
  }, [isPrivileged, verAntiguos]);

  const servicios = useMemo(() => data?.servicios ?? [], [data]);
  const programados = useMemo(() => data?.programados ?? [], [data]);
  const selected = useMemo(() => servicios.find((s) => s.id === selectedId) ?? null, [servicios, selectedId]);

  // Ruta del servicio elegido: se vuelve a pedir en cada refresco (la que falta cambia con la posicion).
  useEffect(() => {
    if (!selectedId || !data) {
      setRuta(null);
      return undefined;
    }
    let cancelled = false;
    getRutaSeguimientoRequest(selectedId)
      .then((result) => {
        if (!cancelled) setRuta(result);
      })
      .catch(() => {
        if (!cancelled) setRuta(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, data]);

  const enProgramados = vista === "programados";
  const tipoCounts = useMemo(() => {
    const counts = {};
    (enProgramados ? programados : servicios).forEach((s) => {
      counts[s.tipo] = (counts[s.tipo] ?? 0) + 1;
    });
    return counts;
  }, [servicios, programados, enProgramados]);

  const tipoTabs = useMemo(
    () => [
      { key: "todos", label: "General", count: (enProgramados ? programados : servicios).length, color: null },
      ...SEGUIMIENTO_TIPOS.filter((t) => t.key !== "otros" || tipoCounts.otros).map((t) => ({
        key: t.key,
        label: t.label,
        count: tipoCounts[t.key] ?? 0,
        color: t.color,
      })),
    ],
    [servicios, programados, enProgramados, tipoCounts]
  );

  const inTipo = useMemo(
    () => (tipoFilter === "todos" ? servicios : servicios.filter((s) => s.tipo === tipoFilter)),
    [servicios, tipoFilter]
  );
  const programadosVisibles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return programados.filter((s) => {
      if (tipoFilter !== "todos" && s.tipo !== tipoFilter) return false;
      if (!q) return true;
      return [s.codigo, s.chofer.nombre, s.vehiculo, s.destino, s.cliente].some((v) => v?.toLowerCase().includes(q));
    });
  }, [programados, tipoFilter, query]);
  const sinGpsCount = inTipo.filter((s) => s.sinGps).length;
  const tardeCount = inTipo.filter(retrasado).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inTipo.filter((s) => {
      if (estadoFilter === "sinGps" && !s.sinGps) return false;
      if (estadoFilter === "retraso" && !retrasado(s)) return false;
      if (!q) return true;
      return [s.codigo, s.chofer.nombre, s.vehiculo, s.destino, s.cliente].some((v) => v?.toLowerCase().includes(q));
    });
  }, [inTipo, estadoFilter, query]);

  // Un solo pin por vehiculo: en un viaje compactado todos los servicios comparten la posicion.
  const markers = useMemo(() => {
    const seen = new Set();
    return inTipo.filter((s) => {
      const key = s.grupoId ?? s.id;
      if (seen.has(key) || !s.gps) return false;
      seen.add(key);
      return true;
    });
  }, [inTipo]);

  // Encuadra el servicio elegido (su posicion y su ruta) una vez por seleccion.
  useEffect(() => {
    if (!map || !selected || !ruta || fittedRef.current === selected.id) return;
    fittedRef.current = selected.id;
    const bounds = new window.google.maps.LatLngBounds();
    if (selected.gps) bounds.extend({ lat: selected.gps.lat, lng: selected.gps.lng });
    (ruta.geometria?.coordinates ?? []).forEach(([lng, lat]) => bounds.extend({ lat, lng }));
    ruta.paradas.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    if (!bounds.isEmpty()) {
      // Deja libre lo que tapan la lista (izquierda) y la linea de tiempo (abajo).
      const listVisible = listOpen && typeof window !== "undefined" && window.innerWidth >= 640;
      map.fitBounds(bounds, { top: 60, right: 60, bottom: selected.timeline ? 190 : 60, left: listVisible ? 380 : 60 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selected, ruta]);

  // La primera vez que hay servicios y ninguno elegido, se encuadran todos.
  const fittedAllRef = useRef(false);
  useEffect(() => {
    if (!map || fittedAllRef.current || selectedId || !markers.length) return;
    fittedAllRef.current = true;
    const bounds = new window.google.maps.LatLngBounds();
    markers.forEach((s) => bounds.extend({ lat: s.gps.lat, lng: s.gps.lng }));
    if (markers.length > 1) map.fitBounds(bounds, 70);
    else map.panTo({ lat: markers[0].gps.lat, lng: markers[0].gps.lng });
  }, [map, markers, selectedId]);

  const select = (idOrService) => {
    const id = typeof idOrService === "string" ? idOrService : idOrService.id;
    fittedRef.current = null;
    setSelectedId(id);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches) setListOpen(false);
  };

  const routePath = useMemo(
    () => (ruta?.geometria?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng })),
    [ruta]
  );

  if (!isPrivileged) return <Navigate to="/" replace />;

  const color = selected ? tipoMeta(selected.tipo).color : "#3987e5";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink-50">Seguimiento</h1>
        </div>
        <MapSectionTabs />
      </div>

      <Alert>{error || (loadError ? "No se pudo cargar Google Maps." : "")}</Alert>

      <div className="glass-surface relative overflow-hidden rounded-3xl">
        {isLoaded &&
          (listOpen ? (
            <aside className={`glass-surface absolute left-3 top-3 z-10 flex w-[min(340px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl ${
                selected?.timeline ? "bottom-[10.5rem]" : "bottom-3"
              }`}>
              <header className="flex items-center justify-between gap-2 border-b border-line/10 px-4 py-3">
                <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink-50">
                  <TruckIcon className="h-4 w-4 text-ink-300" />
                  Servicios <span className="font-normal text-ink-400">({enProgramados ? programadosVisibles.length : inTipo.length})</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setListOpen(false)}
                  aria-label="Ocultar la lista de servicios"
                  title="Ocultar lista"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-line/10 hover:text-ink-50"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
              </header>

              <div className="flex gap-1 border-b border-line/10 px-3 py-2.5">
                {[
                  { key: "camino", label: "En camino", count: servicios.length },
                  { key: "programados", label: "Programados", count: programados.length },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setVista(tab.key)}
                    aria-pressed={vista === tab.key}
                    className={`flex-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
                      vista === tab.key ? "bg-accent-500/25 text-ink-50" : "text-ink-300 hover:bg-line/10"
                    }`}
                  >
                    {tab.label} {tab.count}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5 border-b border-line/10 px-3 py-2.5">
                {tipoTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTipoFilter(tab.key)}
                    aria-pressed={tipoFilter === tab.key}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      tipoFilter === tab.key
                        ? "border-accent-500/60 bg-accent-500/20 text-ink-50"
                        : "border-line/10 text-ink-300 hover:bg-line/10"
                    }`}
                  >
                    {tab.color && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tab.color }} />}
                    {tab.label} {tab.count}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2.5 border-b border-line/10 p-3">
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar código, chofer o destino..."
                    aria-label="Buscar servicio"
                    className="glass-input w-full rounded-lg py-2 pl-9 pr-3 text-[13px] text-ink-50"
                  />
                </div>
                <div className={`flex flex-wrap gap-1.5 ${enProgramados ? "hidden" : ""}`}>
                  {[
                    { key: "todos", label: "Todos", count: inTipo.length, dot: null },
                    { key: "sinGps", label: "Sin GPS", count: sinGpsCount, dot: SEGUIMIENTO_COLOR_SIN_GPS },
                    { key: "retraso", label: "Fuera de ETA", count: tardeCount, dot: SEGUIMIENTO_COLOR_RETRASO },
                  ].map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setEstadoFilter(chip.key)}
                      aria-pressed={estadoFilter === chip.key}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        estadoFilter === chip.key
                          ? "border-accent-500/60 bg-accent-500/15 text-ink-50"
                          : "border-line/10 text-ink-300 hover:bg-line/10"
                      }`}
                    >
                      {chip.dot && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: chip.dot }} />}
                      {chip.label} {chip.count}
                    </button>
                  ))}
                </div>
              </div>

              {!enProgramados && (data?.ocultos?.antiguos > 0 || verAntiguos) && (
                <div className="flex items-center justify-between gap-2 border-b border-line/10 px-4 py-2 text-[11px] text-ink-300">
                  <span>
                    {verAntiguos
                      ? `Se muestran también los servicios con más de ${data?.ocultos?.maxRetrasoHoras ?? 6} h de retraso.`
                      : `${data.ocultos.antiguos} servicio(s) con más de ${data.ocultos.maxRetrasoHoras} h de retraso no se muestran (probablemente sin cerrar).`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setVerAntiguos((v) => !v)}
                    className="shrink-0 font-semibold text-accent-400 hover:text-accent-300"
                  >
                    {verAntiguos ? "Ocultar antiguos" : "Ver antiguos"}
                  </button>
                </div>
              )}

              <ul className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                {data === null ? (
                  <li className="flex justify-center py-6">
                    <Spinner className="h-5 w-5 border-line/20 border-t-line" />
                  </li>
                ) : enProgramados ? (
                  programadosVisibles.length === 0 ? (
                    <li className="px-3 py-6 text-center text-[13px] text-ink-400">
                      {programados.length === 0 ? "No hay servicios programados pendientes de salir." : "Sin resultados."}
                    </li>
                  ) : (
                    programadosVisibles.map((s) => <ProgramadoItem key={s.id} s={s} />)
                  )
                ) : visible.length === 0 ? (
                  <li className="px-3 py-6 text-center text-[13px] text-ink-400">
                    {servicios.length === 0 ? "No hay servicios en camino ahora." : "Sin resultados."}
                  </li>
                ) : (
                  visible.map((s) => <ServicioItem key={s.id} s={s} active={s.id === selectedId} onSelect={select} />)
                )}
              </ul>

              <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line/10 px-4 py-2 text-[11px] text-ink-300">
                <label className="flex cursor-pointer items-center gap-1">
                  <input
                    type="checkbox"
                    checked={showPeajes}
                    onChange={(e) => setShowPeajes(e.target.checked)}
                    className="h-3 w-3 accent-[#ff8a1a]"
                  />
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PEAJE_COLOR_CERCA }} />
                  Peajes
                </label>
                {SEGUIMIENTO_TIPOS.filter((t) => t.key !== "otros" || tipoCounts.otros).map((t) => (
                  <span key={t.key} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.label}
                  </span>
                ))}
              </footer>
            </aside>
          ) : (
            <button
              type="button"
              onClick={() => setListOpen(true)}
              className="glass-surface absolute left-3 top-3 z-10 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-medium text-ink-50 transition-colors hover:bg-line/10"
            >
              <TruckIcon className="h-4 w-4 text-ink-300" />
              Servicios ({inTipo.length + programados.length})
              {sinGpsCount > 0 && (
                <span className="rounded-full bg-[#ff3b57] px-1.5 text-[11px] font-bold text-white">{sinGpsCount}</span>
              )}
            </button>
          ))}

        <div className="h-[calc(100dvh-17rem)] min-h-[480px] w-full lg:h-[calc(100dvh-12.5rem)]">
          {!isLoaded ? (
            <div className="flex h-full items-center justify-center">
              <Spinner className="h-6 w-6 border-line/20 border-t-line" />
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={MILAN_CENTER}
              zoom={10}
              onLoad={setMap}
              onUnmount={() => setMap(null)}
              onClick={() => setSelectedId(null)}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                styles: theme === "dark" ? [...NIGHT_MODE_STYLES, ...HIDE_POI_STYLES] : HIDE_POI_STYLES,
              }}
            >
              <PeajesLayer map={map} visible={showPeajes} />
              {routePath.length > 1 && (
                <Polyline
                  path={routePath}
                  options={{
                    strokeColor: color,
                    strokeOpacity: ruta?.simulada ? 0 : 0.9,
                    strokeWeight: 5,
                    icons: ruta?.simulada
                      ? [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.9, strokeColor: color, scale: 3 }, offset: "0", repeat: "14px" }]
                      : undefined,
                  }}
                />
              )}

              {selected &&
                ruta?.paradas.map((p, index) => (
                  <Marker
                    key={`${p.recordId}-${index}`}
                    position={{ lat: p.lat, lng: p.lng }}
                    label={{ text: String(index + 1), color: "#fff", fontSize: "11px", fontWeight: "700" }}
                    title={p.direccion}
                    icon={{
                      path: window.google.maps.SymbolPath.CIRCLE,
                      scale: 9,
                      fillColor: p.recordId === selected.id && p.ultima ? color : "#4b5b78",
                      fillOpacity: 1,
                      strokeColor: "#ffffff",
                      strokeWeight: 2,
                    }}
                    zIndex={5}
                  />
                ))}

              {markers.map((s) => (
                <Marker
                  key={s.grupoId ?? s.id}
                  position={{ lat: s.gps.lat, lng: s.gps.lng }}
                  icon={markerIcon(s)}
                  label={{ text: s.vehiculo ?? "", color: theme === "dark" ? "#fff" : "#111", fontSize: "11px", fontWeight: "700" }}
                  title={`${s.codigo} · ${s.chofer.nombre}`}
                  onClick={() => select(s)}
                  zIndex={s.sinGps ? 20 : 10}
                />
              ))}
            </GoogleMap>
          )}
        </div>

        {isLoaded && selected?.timeline && <LineaDeTiempo servicio={selected} onSelect={select} />}
      </div>
    </div>
  );
};
