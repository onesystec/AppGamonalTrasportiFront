import { GoogleMap, Marker, OverlayView, Polyline, useJsApiLoader } from "@react-google-maps/api";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { PageLoader } from "../../components/ui/PageLoader";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { parseApiError } from "../../lib/api";
import { getClienteRutaRequest, getClienteSeguimientoRequest } from "../../lib/cliente.api";
import { HIDE_POI_STYLES, NIGHT_MODE_STYLES } from "../../lib/mapStyles";
import { startVisibleInterval } from "../../lib/polling";
import { horaRoma, minutosTexto } from "../../lib/seguimiento";

// Mismo arreglo vacio que el resto de los mapas: el script de Google Maps se carga una sola vez.
const GOOGLE_MAPS_LIBRARIES = [];
const MILAN_CENTER = { lat: 45.4642, lng: 9.19 };
const REFRESH_INTERVAL_MS = 30000;
const MAP_STYLE = { width: "100%", height: "100%" };

const ESTADO = {
  EN_CAMINO: { label: "En camino", pill: "bg-accent-500/15 text-accent-300", color: "#2f8dff" },
  CON_RETRASO: { label: "Con retraso", pill: "bg-warning-500/15 text-warning-500", color: "#ff8a1a" },
  LLEGO: { label: "Llego", pill: "bg-success-500/15 text-success-500", color: "#22c55e" },
};

const Targa = ({ children }) => (
  <span className="inline-block rounded-md border border-line/30 px-2 py-0.5 text-[12px] font-bold tracking-wider text-ink-50">{children}</span>
);

// Una linea que dice si va a tiempo o cuantos minutos se atraso.
const puntualidadTexto = (s) => {
  if (s.estado === "LLEGO") return `Llego a las ${horaRoma(s.llegoAt)}`;
  if (s.retrasoMin >= 5) return `Retraso de ${minutosTexto(s.retrasoMin)}`;
  return "A tiempo";
};

const ServicioCard = ({ s, selected, onSelect, verLista, verMapa, ruta, cargando }) => {
  const estado = ESTADO[s.estado];
  return (
    <button
      type="button"
      onClick={() => onSelect(s.id)}
      className={clsx(
        "glass-surface flex w-full flex-col gap-1.5 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-line/[0.06]",
        selected && "ring-2 ring-accent-500/60"
      )}
    >
      <span className="flex flex-wrap items-center gap-2">
        <Targa>{s.targa ?? "Sin targa"}</Targa>
        <span className="text-[12px] text-ink-400">{s.codigo}</span>
        <span className={clsx("ml-auto rounded-full px-2.5 py-0.5 text-[12px] font-medium", estado.pill)}>
          {verLista ? (s.estado === "LLEGO" ? "Llego" : s.estado === "CON_RETRASO" ? `Retraso de ${minutosTexto(s.retrasoMin)}` : estado.label) : estado.label}
        </span>
      </span>
      <span className="text-[14px] font-medium text-ink-50">{s.destino}</span>
      {verLista && (
        <span className="text-[13px] text-ink-300">
          {s.estado === "LLEGO" ? (
            <>Llego a las {horaRoma(s.llegoAt)}</>
          ) : (
            <>
              Llegada estimada {horaRoma(s.llegadaEstimada)}
              {s.minutosRestantes != null && <> · faltan {minutosTexto(s.minutosRestantes)}</>}
              <span className="block text-[12px] text-ink-400">
                Hora prevista {horaRoma(s.etaPlan)} · {puntualidadTexto(s)}
              </span>
            </>
          )}
        </span>
      )}
      {s.sinSenal && verMapa && <span className="text-[12px] text-warning-500">Sin senal del vehiculo por ahora</span>}
      {selected && cargando && <span className="text-[12px] text-ink-400">Calculando el recorrido...</span>}
      {selected && ruta && (
        <span className="text-[12px] font-medium text-accent-300">
          {ruta.aproximada ? `A unos ${String(ruta.distanciaKm).replace(".", ",")} km en linea recta` : `Le faltan ${String(ruta.distanciaKm).replace(".", ",")} km por carretera`}
        </span>
      )}
    </button>
  );
};

export const ClienteSeguimientoPage = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const modulos = user?.clienteModulos ?? [];
  const verMapa = modulos.includes("MAPA");
  const verLista = modulos.includes("LISTA");

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY, libraries: GOOGLE_MAPS_LIBRARIES });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [map, setMap] = useState(null);
  const [ruta, setRuta] = useState(null);
  const fittedRef = useRef("");
  const fittedRutaRef = useRef(null);
  const userMovedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getClienteSeguimientoRequest()
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
    const stop = startVisibleInterval(load, REFRESH_INTERVAL_MS, { idleMs: 15 * 60 * 1000 });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  const enCamino = useMemo(() => data?.enCamino ?? [], [data]);
  const vehiculos = useMemo(() => enCamino.filter((s) => s.posicion), [enCamino]);
  const destinos = useMemo(() => enCamino.filter((s) => s.destinoCoords), [enCamino]);

  // Encuadra el mapa cuando cambian los servicios (no en cada refresco, para que no salte mientras lo mira).
  const fitKey = [...vehiculos.map((s) => s.id), "|", ...destinos.map((s) => s.id)].join(",");
  useEffect(() => {
    if (!map || !window.google || !fitKey.replace("|", "") || fittedRef.current === fitKey) return;
    fittedRef.current = fitKey;
    const bounds = new window.google.maps.LatLngBounds();
    vehiculos.forEach((s) => bounds.extend(s.posicion));
    destinos.forEach((s) => bounds.extend(s.destinoCoords));
    map.fitBounds(bounds, 60);
    window.google.maps.event.addListenerOnce(map, "idle", () => {
      if (map.getZoom() > 15) map.setZoom(15);
    });
  }, [map, fitKey, vehiculos, destinos]);

  const selected = useMemo(() => enCamino.find((s) => s.id === selectedId) ?? null, [enCamino, selectedId]);

  // Tocar un servicio lleva el mapa al vehiculo de inmediato (mientras se calcula el recorrido) y muestra lo que le falta hasta su parada;
  // tocarlo otra vez lo quita.
  const select = (id) => {
    if (id === selectedId) {
      setSelectedId(null);
      return;
    }
    setSelectedId(id);
    setRuta(null);
    userMovedRef.current = false;
    const s = enCamino.find((x) => x.id === id);
    const point = s?.posicion ?? s?.destinoCoords;
    if (map && point) {
      map.panTo(point);
      if ((map.getZoom() ?? 0) < 14) map.setZoom(14);
    }
  };

  // Recorrido del servicio elegido: se pide al elegirlo y de nuevo cada vez que la furgoneta se mueve (unos 100 m), asi cambia solo si toma
  // otro camino. Se guarda con el id del servicio para no dibujar nunca el recorrido de otro.
  const posKey = selected?.posicion ? `${selected.posicion.lat.toFixed(3)},${selected.posicion.lng.toFixed(3)}` : null;
  useEffect(() => {
    if (!verMapa || !selectedId || !posKey) {
      setRuta(null);
      return undefined;
    }
    let cancelled = false;
    getClienteRutaRequest(selectedId)
      .then((r) => !cancelled && setRuta(r ? { ...r, id: selectedId } : null))
      .catch(() => !cancelled && setRuta(null));
    return () => {
      cancelled = true;
    };
  }, [verMapa, selectedId, posKey]);

  const rutaActual = ruta && ruta.id === selectedId ? ruta : null;
  const cargandoRuta = Boolean(selected?.posicion) && !rutaActual;

  // Encuadra el mapa en el recorrido (y el vehiculo) la primera vez que llega para el servicio elegido.
  useEffect(() => {
    if (!map || !window.google || !rutaActual?.geometria?.coordinates?.length || fittedRutaRef.current === selectedId) return;
    fittedRutaRef.current = selectedId;
    const bounds = new window.google.maps.LatLngBounds();
    rutaActual.geometria.coordinates.forEach(([lng, lat]) => bounds.extend({ lat, lng }));
    if (selected?.posicion) bounds.extend(selected.posicion);
    map.fitBounds(bounds, 70);
  }, [map, rutaActual, selectedId, selected]);

  // Si la furgoneta se sale de la vista al moverse, el mapa la sigue; si la persona movio el mapa a mano, se respeta.
  const posLat = selected?.posicion?.lat;
  const posLng = selected?.posicion?.lng;
  useEffect(() => {
    if (!map || posLat == null || userMovedRef.current) return;
    const bounds = map.getBounds();
    if (bounds && !bounds.contains({ lat: posLat, lng: posLng })) map.panTo({ lat: posLat, lng: posLng });
  }, [map, posLat, posLng]);

  // El recorrido arranca siempre en la posicion actual (el dibujo no se queda atras mientras llega el calculo nuevo).
  const rutaPath = useMemo(() => {
    if (!rutaActual) return [];
    const coords = rutaActual.geometria.coordinates.map(([lng, lat]) => ({ lat, lng }));
    return selected?.posicion && !rutaActual.aproximada ? [selected.posicion, ...coords] : coords;
  }, [rutaActual, selected]);

  const programados = data?.programados ?? [];
  const hayMapa = verMapa && isLoaded;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-[22px] font-semibold text-ink-50">
          Tus servicios en camino <span className="ml-2 text-[13px] font-normal text-ink-400">Se actualiza solo cada 30 segundos</span>
        </h1>
        {data && <span className="text-[12px] text-ink-400">Actualizado a las {horaRoma(data.generadoAt)}</span>}
      </div>

      <Alert>{error}</Alert>
      {!data && !error && <PageLoader />}

      {data && (
        <div className={clsx("grid grid-cols-1 gap-5", verMapa && verLista && "lg:grid-cols-[minmax(0,380px)_1fr] 2xl:grid-cols-[minmax(0,440px)_1fr]")}>
          {verLista && (
            <div className="order-2 flex flex-col gap-3 lg:order-1">
              {enCamino.length === 0 && (
                <p className="glass-surface rounded-2xl px-5 py-6 text-[14px] text-ink-300">No tienes servicios en camino ahora mismo.</p>
              )}
              {verMapa && enCamino.some((s) => s.posicion) && <p className="px-1 text-[12px] text-ink-400">Toca un servicio para ver el recorrido que le falta hasta tu parada.</p>}
              {enCamino.map((s) => (
                <ServicioCard key={s.id} s={s} selected={selectedId === s.id} onSelect={select} verLista={verLista} verMapa={verMapa} ruta={selectedId === s.id ? rutaActual : null} cargando={selectedId === s.id && cargandoRuta} />
              ))}

              {programados.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-400">Programados</h2>
                  <div className="glass-surface rounded-2xl">
                    {programados.map((p, index) => (
                      <div key={p.id} className={clsx("flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5", index > 0 && "border-t border-line/10")}>
                        {p.targa && <Targa>{p.targa}</Targa>}
                        <span className="min-w-0 flex-1 basis-40 truncate text-[13px] text-ink-100">{p.destino}</span>
                        <span className="text-[12px] text-ink-300">Hora prevista {horaRoma(p.etaPlan)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {verMapa && (
            <div className={clsx("order-1 overflow-hidden rounded-2xl border border-line/10", verLista && "lg:order-2")}>
              <div className="relative h-[42dvh] min-h-[300px] w-full lg:h-[calc(100dvh-11.5rem)] lg:min-h-[480px]">
                {selected && cargandoRuta && hayMapa && (
                  <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-900 shadow-md">
                    <Spinner className="h-3.5 w-3.5 border-gray-300 border-t-gray-700" />
                    Calculando el recorrido...
                  </div>
                )}
                {!hayMapa ? (
                  <div className="flex h-full items-center justify-center">
                    <Spinner className="h-6 w-6 border-line/20 border-t-line" />
                  </div>
                ) : (
                  <GoogleMap
                    mapContainerStyle={MAP_STYLE}
                    center={MILAN_CENTER}
                    zoom={9}
                    onLoad={setMap}
                    onUnmount={() => setMap(null)}
                    onDragStart={() => {
                      userMovedRef.current = true;
                    }}
                    options={{
                      streetViewControl: false,
                      mapTypeControl: false,
                      fullscreenControl: false,
                      styles: theme === "dark" ? [...NIGHT_MODE_STYLES, ...HIDE_POI_STYLES] : HIDE_POI_STYLES,
                    }}
                  >
                    {rutaPath.length > 1 && selected && rutaActual && (
                      <Polyline
                        path={rutaPath}
                        options={
                          rutaActual.aproximada
                            ? {
                                strokeOpacity: 0,
                                icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.9, strokeColor: ESTADO[selected.estado].color, scale: 3 }, offset: "0", repeat: "12px" }],
                                zIndex: 5,
                              }
                            : { strokeColor: ESTADO[selected.estado].color, strokeOpacity: 0.85, strokeWeight: 5, zIndex: 5 }
                        }
                      />
                    )}
                    {destinos.map((s) => (
                      <Marker
                        key={`d-${s.id}`}
                        position={s.destinoCoords}
                        title={`Tu entrega: ${s.destino}`}
                        icon={{
                          path: window.google.maps.SymbolPath.CIRCLE,
                          scale: 7,
                          fillColor: "#ffffff",
                          fillOpacity: 1,
                          strokeColor: ESTADO[s.estado].color,
                          strokeWeight: 3,
                        }}
                        onClick={() => select(s.id)}
                      />
                    ))}
                    {vehiculos.map((s) => (
                      <Marker
                        key={`v-${s.id}`}
                        position={s.posicion}
                        icon={{
                          path: window.google.maps.SymbolPath.CIRCLE,
                          scale: selectedId === s.id ? 11 : 9,
                          fillColor: ESTADO[s.estado].color,
                          fillOpacity: 0.95,
                          strokeColor: "#ffffff",
                          strokeWeight: 2,
                        }}
                        zIndex={selectedId === s.id ? 20 : 10}
                        onClick={() => select(s.id)}
                      />
                    ))}
                    {vehiculos.map((s) => (
                      <OverlayView
                        key={`t-${s.id}`}
                        position={s.posicion}
                        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                        getPixelPositionOffset={(width, height) => ({ x: -width / 2, y: -height - 14 })}
                      >
                        {/* Colores fijos: una tarjeta clara que se lee bien sobre cualquier fondo del mapa. */}
                        <div
                          onClick={() => select(s.id)}
                          className="w-fit cursor-pointer whitespace-nowrap rounded-md border border-gray-300 bg-white px-2 py-1 text-[12px] font-bold text-gray-900 shadow-md"
                        >
                          {s.targa}
                          {verLista && s.estado === "CON_RETRASO" && <span className="ml-1.5 font-semibold text-orange-600">+{minutosTexto(s.retrasoMin)}</span>}
                        </div>
                      </OverlayView>
                    ))}
                  </GoogleMap>
                )}
              </div>
              {vehiculos.length === 0 && enCamino.length > 0 && (
                <p className="border-t border-line/10 px-4 py-2.5 text-[13px] text-ink-300">
                  Todavia no hay posicion de tus vehiculos en el mapa. Aparecen apenas empiezan a transmitir.
                </p>
              )}
              {enCamino.length === 0 && <p className="border-t border-line/10 px-4 py-2.5 text-[13px] text-ink-300">No hay vehiculos en camino para ti ahora mismo.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
