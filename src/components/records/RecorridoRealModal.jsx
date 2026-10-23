import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Alert } from "../ui/Alert";
import { Spinner } from "../ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { getRecorridoRequest } from "../../lib/records.api";

// Mismo arreglo vacio que el resto de los mapas: el script de Google Maps se carga una sola vez.
const GOOGLE_MAPS_LIBRARIES = [];
const PLAN_COLOR = "#3987e5";
const REAL_COLOR = "#ff8a1a";
const FUERA_COLOR = "#ff3b57";

const toPath = (geometry) => geometry?.coordinates?.map(([lng, lat]) => ({ lat, lng })) ?? [];

const Dato = ({ label, value, tone }) => (
  <div className="rounded-xl bg-line/[0.06] px-3 py-2.5">
    <span className="block text-[11px] uppercase tracking-wide text-ink-400">{label}</span>
    <span className={`block text-[16px] font-semibold ${tone === "warn" ? "text-warning-500" : "text-ink-50"}`}>{value}</span>
  </div>
);

const metros = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

// El recorrido real del vehiculo (GPS de OneSystec) junto a la ruta planificada: azul el plan, naranja lo que hizo el vehiculo y en rojo los tramos
// donde se salio mucho de la ruta. Se calcula la primera vez que se mira (o al cerrar el servicio) y queda guardado.
export const RecorridoRealModal = ({ recordId, onClose }) => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [map, setMap] = useState(null);
  const [recalculating, setRecalculating] = useState(false);
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const load = useCallback(
    (recalcular = false) => {
      setError("");
      return getRecorridoRequest(recordId, { recalcular })
        .then(setData)
        .catch((err) => setError(parseApiError(err).message));
    },
    [recordId]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const plan = useMemo(() => toPath(data?.plan?.geometria), [data]);
  const real = useMemo(() => toPath(data?.real), [data]);
  const resumen = data?.resumen;
  const sinDatos = Boolean(resumen?.sinDatos);

  useEffect(() => {
    if (!map || !window.google || (!plan.length && !real.length)) return;
    const bounds = new window.google.maps.LatLngBounds();
    [...plan, ...real].forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 40);
  }, [map, plan, real]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    await load(true);
    setRecalculating(false);
  };

  const showMap = isLoaded && !loadError;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-backdrop backdrop-blur-sm" />
      <div className="glass-surface relative z-10 flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-3 border-b border-line/10 px-5 pb-3 pt-5">
          <div>
            <h2 className="text-[18px] font-semibold text-ink-50">Recorrido real del vehículo</h2>
            <p className="mt-0.5 text-[12px] text-ink-300">
              <span style={{ color: PLAN_COLOR }}>■</span> ruta planificada · <span style={{ color: REAL_COLOR }}>■</span> recorrido real (GPS) ·{" "}
              <span style={{ color: FUERA_COLOR }}>■</span> tramos fuera de ruta
            </p>
          </div>
          <div className="flex items-center gap-4">
            {user?.cargo === "OWNER" && data && (
              <button
                type="button"
                onClick={handleRecalculate}
                disabled={recalculating}
                title="Vuelve a pedir el recorrido al GPS y lo compara de nuevo"
                className="text-[13px] font-medium text-accent-400 hover:text-accent-300 disabled:opacity-50"
              >
                {recalculating ? "Recalculando…" : "Recalcular"}
              </button>
            )}
            <button type="button" onClick={onClose} className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
              Cerrar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Alert>{error}</Alert>
          {!data && !error && (
            <p className="flex items-center gap-2 text-[13px] text-ink-300">
              <Spinner className="h-4 w-4" /> Consultando el GPS del vehículo… (puede tardar unos segundos)
            </p>
          )}

          {data && sinDatos && (
            <div className="flex flex-col gap-3">
              <Alert variant="warning">{resumen.motivo}</Alert>
              <p className="text-[12px] text-ink-400">
                Cuando el vehículo tenga puntos en OneSystec para el horario del servicio, se podrá comparar. Se vuelve a intentar al abrir de nuevo.
              </p>
            </div>
          )}

          {data && resumen && !sinDatos && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="h-[320px] overflow-hidden rounded-xl lg:col-span-3 lg:h-[460px]">
                {showMap ? (
                  <GoogleMap
                    mapContainerStyle={{ width: "100%", height: "100%" }}
                    center={plan[0] ?? real[0] ?? { lat: 45.4642, lng: 9.19 }}
                    zoom={10}
                    onLoad={setMap}
                    onUnmount={() => setMap(null)}
                    options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
                  >
                    {plan.length > 1 && <Polyline path={plan} options={{ strokeColor: PLAN_COLOR, strokeWeight: 5, strokeOpacity: 0.75, zIndex: 1 }} />}
                    {real.length > 1 && <Polyline path={real} options={{ strokeColor: REAL_COLOR, strokeWeight: 4, strokeOpacity: 0.95, zIndex: 2 }} />}
                    {resumen.tramosFuera.map((t, i) => (
                      <Marker
                        key={`fuera-${i}`}
                        position={t.inicio}
                        title={`Salió de la ruta ${t.km} km (${t.minutos} min), hasta ${metros(t.maxM)} del plan`}
                        label={{ text: "!", color: "#ffffff", fontWeight: "800" }}
                        zIndex={5}
                      />
                    ))}
                    {data.plan?.puntos?.map((p, i) => (
                      <Marker key={`punto-${i}`} position={{ lat: p.lat, lng: p.lng }} title={p.nombre} zIndex={3} />
                    ))}
                  </GoogleMap>
                ) : (
                  <p className="p-4 text-[13px] text-ink-300">No se pudo cargar Google Maps. El resumen se ve a la derecha.</p>
                )}
              </div>

              <div className="flex flex-col gap-3 lg:col-span-2">
                <div className="grid grid-cols-2 gap-2">
                  <Dato label="Km reales (ida)" value={`${resumen.kmReal} km`} />
                  <Dato label="Km planificados" value={resumen.kmPlan != null ? `${resumen.kmPlan} km` : "—"} />
                  <Dato
                    label="Km de más"
                    value={resumen.extraKm != null ? `${resumen.extraKm > 0 ? "+" : ""}${resumen.extraKm} km` : "—"}
                    tone={resumen.extraKm != null && resumen.extraKm >= 10 ? "warn" : undefined}
                  />
                  <Dato label="Desvío máximo" value={metros(resumen.desvioMaxM)} tone={resumen.desvioMaxM >= 3000 ? "warn" : undefined} />
                  <Dato label="Fuera de ruta" value={`${resumen.fueraDeRutaPct}%`} tone={resumen.fueraDeRutaPct >= 10 ? "warn" : undefined} />
                  <Dato label="Área C" value={resumen.areaC?.minutos > 0 ? `${resumen.areaC.minutos} min` : "No entró"} tone={resumen.areaC?.minutos > 0 ? "warn" : undefined} />
                </div>

                {resumen.motivos?.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {resumen.motivos.map((m) => (
                      <li
                        key={m.codigo}
                        className={`rounded-lg px-3 py-2 text-[12.5px] ${m.nivel === "revisar" ? "bg-warning-500/10 text-warning-500" : "bg-line/[0.06] text-ink-200"}`}
                      >
                        {m.nivel === "revisar" ? "⚠ " : ""}
                        {m.texto}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-lg bg-success-500/10 px-3 py-2 text-[12.5px] text-success-500">Siguió la ruta planificada, sin desvíos importantes.</p>
                )}

                {resumen.tramosFuera?.length > 0 && (
                  <div>
                    <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-400">Tramos fuera de ruta</h3>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {resumen.tramosFuera.map((t, i) => (
                        <li key={i} className="text-[12.5px] text-ink-200">
                          {formatDateTime(t.desde)} · {t.km} km · {t.minutos} min · hasta {metros(t.maxM)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-400">Peajes que cruzó</h3>
                  <p className="mt-1.5 text-[12.5px] text-ink-200">
                    {resumen.peajes?.reales?.length ? resumen.peajes.reales.join(" · ") : "Ninguno del catálogo."}
                  </p>
                  {resumen.peajes?.noPrevistos?.length > 0 && (
                    <p className="mt-1 text-[12px] text-warning-500">No previstos en el plan: {resumen.peajes.noPrevistos.join(" · ")}</p>
                  )}
                  {resumen.peajes?.sinCruzar?.length > 0 && (
                    <p className="mt-1 text-[12px] text-ink-400">Previstos y no cruzados: {resumen.peajes.sinCruzar.join(" · ")}</p>
                  )}
                </div>

                <p className="text-[11px] text-ink-500">
                  GPS de OneSystec · {resumen.puntos} puntos · {formatDateTime(resumen.desde)} a {formatDateTime(resumen.hasta)}. Un desvío pequeño es normal (atascos,
                  cierres): solo se destacan los grandes.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
