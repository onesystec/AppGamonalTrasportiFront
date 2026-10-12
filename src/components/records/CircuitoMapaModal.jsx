import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Alert } from "../ui/Alert";
import { Spinner } from "../ui/Spinner";
import { parseApiError } from "../../lib/api";
import { formatKmValue } from "../../lib/compactado";
import { getCircuitoMapaRequest } from "../../lib/records.api";
import { PEAJE_COLOR_EN_RUTA, RUTA_COLOR, RUTA_COLOR_SIN_PEAJE, nearestIndex, peajeTitulo } from "../../lib/peajes";
import { PeajesLayer } from "../mapa/PeajesLayer";

// Mismo arreglo vacio que MapPage: el script de Google Maps se carga una sola vez.
const GOOGLE_MAPS_LIBRARIES = [];
const LINE_COLOR = RUTA_COLOR;
const TIPO_LABEL = { SALIDA: "Salida", RETIRO: "Retiro", PASO: "Paso", PARADA: "Parada", REGRESO: "Regreso" };

const letter = (index) => String.fromCharCode(65 + index);

// Dibujo sin mapa (si Google Maps no esta disponible): el recorrido proyectado en un cuadro, con los puntos en orden.
const EsquemaRuta = ({ puntos, coords }) => {
  const all = coords?.length ? coords : puntos;
  const lats = all.map((p) => p.lat);
  const lngs = all.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const w = 320;
  const h = 220;
  const pad = 18;
  const sx = (lng) => pad + ((lng - minLng) / (maxLng - minLng || 1)) * (w - 2 * pad);
  const sy = (lat) => h - pad - ((lat - minLat) / (maxLat - minLat || 1)) * (h - 2 * pad);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full rounded-xl bg-line/[0.05]">
      {coords?.length > 1 && (
        <polyline fill="none" stroke={LINE_COLOR} strokeWidth="2" points={coords.map((p) => `${sx(p.lng)},${sy(p.lat)}`).join(" ")} />
      )}
      {puntos.map((p, i) => (
        <g key={`${p.tipo}-${i}`}>
          <circle cx={sx(p.lng)} cy={sy(p.lat)} r="8" fill={LINE_COLOR} />
          <text x={sx(p.lng)} y={sy(p.lat) + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
            {letter(i)}
          </text>
        </g>
      ))}
    </svg>
  );
};

// El circuito de un servicio o viaje en el mapa: lugar de espera -> retiro -> paradas -> lugar de espera, con los km de cada
// tramo al lado. Sirve para comprobar que la ruta que usa el sistema para validar los km es la correcta.
export const CircuitoMapaModal = ({ recordId, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [map, setMap] = useState(null);
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  useEffect(() => {
    let cancelled = false;
    getCircuitoMapaRequest(recordId)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(parseApiError(err).message));
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Ida y vuelta, cada una con su ruta: verde si el chofer declaro que no uso peaje (y la ruta realmente los evita), azul si no; el
  // tramo donde cruza un peaje se pinta de magenta. Si no vienen separadas (servidor viejo) se usa la ruta completa de antes.
  const rutas = useMemo(
    () =>
      (data?.rutas ?? [])
        .map((r) => {
          const path = r.geometria?.coordinates?.map(([lng, lat]) => ({ lat, lng })) ?? [];
          const cruces = r.peajes.map((p) => {
            const i = nearestIndex(path, p);
            return { peaje: p, tramo: path.slice(Math.max(0, i - 10), i + 11) };
          });
          return { ...r, path, cruces };
        })
        .filter((r) => r.path.length > 1),
    [data]
  );
  const path = useMemo(
    () => (rutas.length ? rutas.flatMap((r) => r.path) : (data?.geometria?.coordinates?.map(([lng, lat]) => ({ lat, lng })) ?? [])),
    [data, rutas]
  );
  const idsEnRuta = useMemo(() => new Set(rutas.flatMap((r) => r.peajes.map((p) => p.id))), [rutas]);

  useEffect(() => {
    if (!map || !data?.puntos?.length || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    (path.length ? path : data.puntos).forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, 40);
  }, [map, data, path]);

  const circuito = data?.circuito;
  const showMap = isLoaded && !loadError;

  // En el body: dentro de un panel lateral (con transform) el "fixed" queda recortado al panel y el mapa sale chico.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-backdrop backdrop-blur-sm" />
      <div className="glass-surface relative z-10 flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-3 border-b border-line/10 px-5 pb-3 pt-5">
          <div>
            <h2 className="text-[18px] font-semibold text-ink-50">Circuito en el mapa</h2>
            <p className="mt-0.5 text-[12px] text-ink-300">
              Lugar de espera &rarr; retiro &rarr; paradas &rarr; lugar de espera. Esta es la ruta con la que se validan los km.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
            Cerrar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Alert>{error}</Alert>
          {!data && !error && (
            <p className="flex items-center gap-2 text-[13px] text-ink-300">
              <Spinner className="h-4 w-4" /> Calculando el circuito…
            </p>
          )}
          {data && !circuito && (
            <p className="text-[13px] text-ink-300">Este servicio no tiene un circuito calculable (revisa que sus paradas esten ubicadas en el mapa).</p>
          )}
          {data && circuito && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="h-[320px] overflow-hidden rounded-xl lg:col-span-3 lg:h-[420px]">
                {showMap ? (
                  <GoogleMap
                    mapContainerStyle={{ width: "100%", height: "100%" }}
                    center={{ lat: data.puntos[0].lat, lng: data.puntos[0].lng }}
                    zoom={11}
                    onLoad={setMap}
                    onUnmount={() => setMap(null)}
                    options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
                  >
                    {rutas.length === 0 && path.length > 1 && (
                      <Polyline path={path} options={{ strokeColor: LINE_COLOR, strokeWeight: 4, strokeOpacity: 0.85 }} />
                    )}
                    {rutas.map((r) => (
                      <Polyline
                        key={r.tipo}
                        path={r.path}
                        options={{
                          strokeColor: r.sinPeaje && r.evitado ? RUTA_COLOR_SIN_PEAJE : LINE_COLOR,
                          strokeWeight: r.tipo === "IDA" ? 5 : 4,
                          strokeOpacity: 0.85,
                        }}
                      />
                    ))}
                    {rutas.flatMap((r) =>
                      r.cruces.map((c) => (
                        <Polyline
                          key={`${r.tipo}-tramo-${c.peaje.id}`}
                          path={c.tramo}
                          options={{ strokeColor: PEAJE_COLOR_EN_RUTA, strokeWeight: 8, strokeOpacity: 0.95, zIndex: 3 }}
                        />
                      ))
                    )}
                    <PeajesLayer map={map} omitir={idsEnRuta} />
                    {rutas.flatMap((r) =>
                      r.peajes.map((p) => (
                        <Marker
                          key={`${r.tipo}-peaje-${p.id}`}
                          position={{ lat: p.lat, lng: p.lng }}
                          title={`Peaje en la ruta (${r.tipo === "IDA" ? "ida" : "vuelta"}): ${peajeTitulo(p)}`}
                          zIndex={9}
                          icon={{
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: 9,
                            fillColor: PEAJE_COLOR_EN_RUTA,
                            fillOpacity: 1,
                            strokeColor: "#ffffff",
                            strokeWeight: 2.5,
                          }}
                        />
                      ))
                    )}
                    {data.puntos.map((p, i) => (
                      <Marker
                        key={`${p.tipo}-${i}`}
                        position={{ lat: p.lat, lng: p.lng }}
                        label={{ text: letter(i), color: "#ffffff", fontWeight: "700" }}
                        title={`${TIPO_LABEL[p.tipo]}: ${p.nombre}`}
                      />
                    ))}
                  </GoogleMap>
                ) : (
                  <EsquemaRuta puntos={data.puntos} coords={path} />
                )}
              </div>

              <div className="lg:col-span-2">
                <ol className="flex flex-col gap-1.5">
                  {data.puntos.map((p, i) => (
                    <li key={`${p.tipo}-${i}`} className="flex items-start gap-2.5 text-[13px]">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-500 text-[11px] font-bold text-white">
                        {letter(i)}
                      </span>
                      <span className="min-w-0 text-ink-100">
                        <b className="text-ink-50">{TIPO_LABEL[p.tipo]}:</b> {p.nombre}
                      </span>
                    </li>
                  ))}
                </ol>

                {rutas.length > 0 && (
                  <>
                    <h3 className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-ink-400">Peajes</h3>
                    <ul className="mt-1.5 flex flex-col gap-1.5">
                      {rutas.map((r) => (
                        <li key={r.tipo} className="rounded-lg bg-line/[0.05] px-3 py-1.5 text-[12px] text-ink-200">
                          <b className="text-ink-50">{r.tipo === "IDA" ? "Ida" : "Vuelta"}:</b>{" "}
                          {r.sinPeaje ? (
                            r.evitado ? (
                              <span style={{ color: RUTA_COLOR_SIN_PEAJE }}>sin peaje (declarado por el chofer, ruta calculada sin autopistas de pago)</span>
                            ) : (
                              <span className="text-warning-500">
                                el chofer declaró que no usó peaje, pero no se pudo calcular una ruta que los evite: se muestra la normal
                              </span>
                            )
                          ) : r.pagos?.length ? (
                            <span style={{ color: PEAJE_COLOR_EN_RUTA }}>
                              {r.pagos.length} {r.pagos.length === 1 ? "pago" : "pagos"} de peaje (estimado):{" "}
                              {r.pagos.map((pago) => (pago.hasta ? `${pago.desde} → ${pago.hasta}` : pago.desde)).join(" · ")}
                              {r.pagos.some((pago) => pago.tipo === "BARRERA_UNICA") && (
                                <span className="text-warning-500"> · caseta sin pareja: revisar (barrera única o falta la otra en el catálogo)</span>
                              )}
                            </span>
                          ) : (
                            "no pasa por peajes del catálogo"
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-400">
                      <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PEAJE_COLOR_EN_RUTA }} /> caseta en la ruta (entrada + salida = 1 pago)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#ff8a1a" }} /> otros peajes cerca
                      </span>
                    </p>
                  </>
                )}

                <h3 className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-ink-400">Km por tramo</h3>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {circuito.tramos?.map((t, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 rounded-lg bg-line/[0.05] px-3 py-1.5 text-[12px]">
                      <span className="min-w-0 text-ink-200">
                        <b className="text-ink-50">
                          {letter(i)} &rarr; {letter(i + 1)}
                        </b>{" "}
                        {t.desde} &rarr; {t.hasta}
                      </span>
                      <span className="shrink-0 font-semibold text-ink-50">{formatKmValue(t.km)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 flex items-baseline justify-between rounded-lg bg-accent-500/10 px-3 py-2 text-[13px]">
                  <span className="text-ink-200">Circuito completo</span>
                  <b className="text-ink-50">{formatKmValue(circuito.km)}</b>
                </p>
                {loadError && (
                  <p className="mt-2 text-[11px] text-ink-400">No se pudo cargar Google Maps: se muestra el recorrido en un esquema.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
