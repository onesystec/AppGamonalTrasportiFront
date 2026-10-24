import { GoogleMap, Marker, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { PageLoader } from "../../components/ui/PageLoader";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { parseApiError } from "../../lib/api";
import { getClienteEnVivoRequest } from "../../lib/cliente.api";
import { HIDE_POI_STYLES, NIGHT_MODE_STYLES } from "../../lib/mapStyles";
import { startVisibleInterval } from "../../lib/polling";
import { horaRoma } from "../../lib/seguimiento";
import { VEHICLE_STATUS_META, vehicleMarkerIcon, vehicleStatus } from "../../lib/vehiculoMapa";

// Mismo arreglo vacio que el resto de los mapas: el script de Google Maps se carga una sola vez.
const GOOGLE_MAPS_LIBRARIES = [];
const MILAN_CENTER = { lat: 45.4642, lng: 9.19 };
const REFRESH_INTERVAL_MS = 20000;
const MAP_STYLE = { width: "100%", height: "100%" };
const STATUS_ORDER = { moving: 0, idlingOn: 1, idlingOff: 2 };

const minutosDesde = (iso) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : null);
const haceTexto = (min) => (min == null ? "" : min < 1 ? "ahora" : min < 60 ? `hace ${min} min` : min < 1440 ? `hace ${Math.round(min / 60)} h` : `hace ${Math.round(min / 1440)} d`);

// Mapa "En Vivo" del usuario cliente: la posicion de los vehiculos en tiempo real, como en el Mapa de la oficina pero solo con la targa (sin chofer ni
// servicio) y sin los peajes.
export const ClienteEnVivoPage = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY, libraries: GOOGLE_MAPS_LIBRARIES });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [map, setMap] = useState(null);
  const [selected, setSelected] = useState(null);
  const fittedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getClienteEnVivoRequest()
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

  const vehiculos = useMemo(
    () =>
      (data?.vehiculos ?? [])
        .map((v) => ({ ...v, status: vehicleStatus(v), min: minutosDesde(v.updatedAt) }))
        .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.targa.localeCompare(b.targa)),
    [data]
  );

  // Encuadra todos los vehiculos la primera vez que llegan (no en cada refresco, para que no salte mientras se mira).
  useEffect(() => {
    if (!map || !window.google || fittedRef.current || vehiculos.length === 0) return;
    fittedRef.current = true;
    const bounds = new window.google.maps.LatLngBounds();
    vehiculos.forEach((v) => bounds.extend({ lat: v.lat, lng: v.lng }));
    map.fitBounds(bounds, 60);
    window.google.maps.event.addListenerOnce(map, "idle", () => {
      if (map.getZoom() > 13) map.setZoom(13);
    });
  }, [map, vehiculos]);

  const select = (v) => {
    setSelected(v.targa);
    if (map) {
      map.panTo({ lat: v.lat, lng: v.lng });
      if ((map.getZoom() ?? 0) < 14) map.setZoom(14);
    }
  };

  if (!user?.clienteModulos?.includes("EN_VIVO")) return <Navigate to="/cliente" replace />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-[22px] font-semibold text-ink-50">
          En vivo <span className="ml-2 text-[13px] font-normal text-ink-400">Se actualiza solo cada 20 segundos</span>
        </h1>
        {data && <span className="text-[12px] text-ink-400">Actualizado a las {horaRoma(data.generadoAt)}</span>}
      </div>

      <Alert>{error}</Alert>
      {!data && !error && <PageLoader />}

      {data && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,285px)_1fr] 2xl:grid-cols-[minmax(0,330px)_1fr]">
          <div className="order-2 flex flex-col gap-2 lg:order-1">
            <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11.5px] text-ink-300">
              {Object.values(VEHICLE_STATUS_META).map((m) => (
                <span key={m.label} className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                  {m.label}
                </span>
              ))}
            </div>
            {vehiculos.length === 0 && <p className="glass-surface rounded-2xl px-4 py-5 text-[13px] text-ink-300">Ningun vehiculo esta transmitiendo su posicion ahora mismo.</p>}
            <ul className="glass-surface flex flex-col rounded-2xl p-1.5">
              {vehiculos.map((v) => {
                const meta = VEHICLE_STATUS_META[v.status];
                return (
                  <li key={v.targa}>
                    <button
                      type="button"
                      onClick={() => select(v)}
                      className={clsx("flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-line/10", selected === v.targa && "bg-line/10 ring-1 ring-accent-500/40")}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color, boxShadow: `0 0 8px ${meta.color}` }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold tracking-wide text-ink-50">{v.targa}</span>
                        <span className="block truncate text-[11.5px]" style={{ color: meta.color }}>
                          {meta.label}
                          {v.min != null && v.min >= 1 && <span className="text-ink-400"> · {haceTexto(v.min)}</span>}
                        </span>
                      </span>
                      {v.status === "moving" && v.speed != null && (
                        <span className="shrink-0 text-[12px] font-semibold text-ink-100">
                          {Math.round(v.speed)} {v.speedUnit ?? ""}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="order-1 overflow-hidden rounded-2xl border border-line/10 lg:order-2">
            <div className="relative h-[42dvh] min-h-[300px] w-full lg:h-[calc(100dvh-11.5rem)] lg:min-h-[480px]">
              {!isLoaded ? (
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
                  options={{
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: false,
                    styles: theme === "dark" ? [...NIGHT_MODE_STYLES, ...HIDE_POI_STYLES] : HIDE_POI_STYLES,
                  }}
                >
                  {vehiculos.map((v) => (
                    <Marker key={`v-${v.targa}`} position={{ lat: v.lat, lng: v.lng }} icon={vehicleMarkerIcon(v)} zIndex={selected === v.targa ? 20 : 10} onClick={() => setSelected(v.targa)} />
                  ))}
                  {vehiculos.map((v) => (
                    <OverlayView
                      key={`t-${v.targa}`}
                      position={{ lat: v.lat, lng: v.lng }}
                      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                      getPixelPositionOffset={(width, height) => ({ x: -width / 2, y: -height - 14 })}
                    >
                      {/* Colores fijos: una tarjeta clara que se lee bien sobre cualquier fondo del mapa. */}
                      <div
                        onClick={() => setSelected(v.targa)}
                        className="w-fit cursor-pointer whitespace-nowrap rounded-md border border-gray-300 bg-white px-2 py-1 text-[12px] font-bold text-gray-900 shadow-md"
                      >
                        {v.targa}
                      </div>
                    </OverlayView>
                  ))}
                </GoogleMap>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
