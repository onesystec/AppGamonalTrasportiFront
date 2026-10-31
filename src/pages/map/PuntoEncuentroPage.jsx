import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { MapSectionTabs } from "../../components/layout/MapSectionTabs";
import { Alert } from "../../components/ui/Alert";
import { copyText } from "../../components/ui/CopyButton";
import { CheckIcon, ChevronLeftIcon, CopyIcon, MapPinIcon } from "../../components/ui/icons";
import { Spinner } from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { parseApiError } from "../../lib/api";
import { HIDE_POI_STYLES, NIGHT_MODE_STYLES } from "../../lib/mapStyles";
import { horaRoma, minutosTexto } from "../../lib/seguimiento";
import {
  findMeetingPointRequest,
  getMeetingRoutesRequest,
  getMeetingSuggestionsRequest,
  listCurrentServicesRequest,
  listVehicleLivePositionsRequest,
} from "../../lib/vehicles.api";

// Mismo arreglo vacio que el resto de pantallas del mapa: el script de Google Maps se carga una sola vez.
const GOOGLE_MAPS_LIBRARIES = [];
const MILAN_CENTER = { lat: 45.4642, lng: 9.19 };
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

const COLOR_A = "#3987e5";
const COLOR_B = "#ff8a1a";
const COLOR_PUNTO = "#22e093";

const normalizeTarga = (targa) => targa?.replace(/\s+/g, "").toUpperCase() ?? "";

const EMPTY_ORIGEN = { modo: "vehiculo", targa: "", direccion: "" };

const minutos = (min) => minutosTexto(Math.round(min));

// Cuanto se desvian los dos del "mismo tiempo": verde hasta 5 min, ambar hasta 15, rojo si pasa.
const diffColor = (min) => (min <= 5 ? "#22e093" : min <= 15 ? "#ffb020" : "#ff3b57");

const pinIcon = (color, scale = 11) => ({
  path: window.google.maps.SymbolPath.CIRCLE,
  scale,
  fillColor: color,
  fillOpacity: 1,
  strokeColor: "#ffffff",
  strokeWeight: 2,
  labelOrigin: new window.google.maps.Point(0, 0),
});

// Un extremo (A o B): se elige un vehiculo con GPS o se escribe una direccion.
const OrigenField = ({ letra, color, value, onChange, vehiculos }) => (
  <div className="rounded-xl border border-line/10 p-3">
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-50">
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {letra}
        </span>
        Punto {letra}
      </span>
      <div className="flex gap-1">
        {[
          { key: "vehiculo", label: "Vehículo" },
          { key: "direccion", label: "Dirección" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange({ ...value, modo: tab.key })}
            aria-pressed={value.modo === tab.key}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
              value.modo === tab.key
                ? "border-accent-500/60 bg-accent-500/20 text-ink-50"
                : "border-line/10 text-ink-300 hover:bg-line/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>

    {value.modo === "vehiculo" ? (
      <select
        value={value.targa}
        onChange={(e) => onChange({ ...value, targa: e.target.value })}
        aria-label={`Vehículo del punto ${letra}`}
        className="glass-input mt-2 w-full rounded-lg px-3 py-2 text-[13px] text-ink-50"
      >
        <option value="">{vehiculos === null ? "Cargando vehículos…" : "Elige un vehículo"}</option>
        {(vehiculos ?? []).map((v) => (
          <option key={v.targa} value={v.targa}>
            {v.targa}
            {v.chofer ? ` · ${v.chofer}` : ""}
          </option>
        ))}
      </select>
    ) : (
      <input
        type="text"
        value={value.direccion}
        onChange={(e) => onChange({ ...value, direccion: e.target.value })}
        placeholder="Dirección, ciudad o lugar (ej. Firenze)"
        aria-label={`Dirección del punto ${letra}`}
        className="glass-input mt-2 w-full rounded-lg px-3 py-2 text-[13px] text-ink-50"
      />
    )}
  </div>
);

// Una opcion de encuentro: que tiempo tarda cada uno y a que hora llegaria.
const EncuentroItem = ({ item, active, onSelect, since }) => {
  const llega = (min) => horaRoma(since + min * 60000);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;
  // idle | ok | error
  const [copiado, setCopiado] = useState("idle");
  // Nombre + enlace de Google Maps: pegado en WhatsApp se abre directo para navegar hasta ahi.
  const copiar = async () => {
    setCopiado((await copyText(`${item.nombre}\n${mapsUrl}`)) ? "ok" : "error");
    setTimeout(() => setCopiado("idle"), 1800);
  };
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-line/10 ${
          active ? "border-accent-500/60 bg-accent-500/10" : "border-line/10"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_PUNTO }} />
            <span className="truncate text-[13px] font-semibold text-ink-50">{item.nombre}</span>
          </span>
          <span
            className="shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold"
            style={{ borderColor: `${diffColor(item.diffMin)}88`, color: diffColor(item.diffMin) }}
            title="Diferencia entre lo que tarda uno y otro"
          >
            {item.diffMin < 1 ? "Mismo tiempo" : `Δ ${minutos(item.diffMin)}`}
          </span>
        </div>
        <p className="mt-0.5 text-[11.5px] text-ink-400">{item.tipoLabel}</p>
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 text-[12px] text-ink-300">
          <span>
            <span className="font-bold" style={{ color: COLOR_A }}>A</span>{" "}
            <span className="font-semibold text-ink-50">{minutos(item.minA)}</span> · {Math.round(item.kmA)} km
            <br />
            <span className="text-ink-400">llega {llega(item.minA)}</span>
          </span>
          <span>
            <span className="font-bold" style={{ color: COLOR_B }}>B</span>{" "}
            <span className="font-semibold text-ink-50">{minutos(item.minB)}</span> · {Math.round(item.kmB)} km
            <br />
            <span className="text-ink-400">llega {llega(item.minB)}</span>
          </span>
        </div>
      </button>
      <div className="mt-1 flex items-center gap-3 px-3">
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-accent-400 hover:text-accent-300">
          Ver en Google Maps
        </a>
        <button
          type="button"
          onClick={copiar}
          title="Copia el nombre y el enlace de Google Maps, listo para pegar en WhatsApp"
          className={`inline-flex items-center gap-1 text-[11px] font-medium transition-colors ${
            copiado === "ok" ? "text-success-500" : copiado === "error" ? "text-danger-500" : "text-accent-400 hover:text-accent-300"
          }`}
        >
          {copiado === "ok" ? <CheckIcon className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />}
          {copiado === "ok" ? "¡Copiado!" : copiado === "error" ? "No se pudo copiar" : "Copiar"}
        </button>
      </div>
    </li>
  );
};

export const PuntoEncuentroPage = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  const [map, setMap] = useState(null);
  const [positions, setPositions] = useState(null);
  const [serviciosActuales, setServiciosActuales] = useState([]);
  const [origenA, setOrigenA] = useState(EMPTY_ORIGEN);
  const [origenB, setOrigenB] = useState(EMPTY_ORIGEN);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [searchedAt, setSearchedAt] = useState(0);
  const [selectedKey, setSelectedKey] = useState(null);
  const [rutas, setRutas] = useState(null);
  // Los sitios sugeridos llegan despues del punto ideal (dependen de Overpass): null = buscando, [] = sin sitios.
  const [sugerencias, setSugerencias] = useState(null);
  const [aviso, setAviso] = useState(null);
  const searchIdRef = useRef(0);
  const pickedRef = useRef(false);
  // El panel se puede ocultar solo en pantalla grande. En el celular manda "sheet": "full" = el formulario y las sugerencias ocupan todo (el mapa
  // queda detras), "peek" = al elegir una sugerencia el panel baja y deja solo esa opcion abajo, con el mapa y el punto de encuentro arriba.
  const [listOpen, setListOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches);
  const [sheet, setSheet] = useState("full");

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!isPrivileged) return;
    listVehicleLivePositionsRequest()
      .then(setPositions)
      .catch((err) => {
        setPositions([]);
        setError(parseApiError(err).message);
      });
    listCurrentServicesRequest()
      .then(setServiciosActuales)
      .catch(() => {});
  }, [isPrivileged]);

  // Vehiculos con GPS, con el chofer del servicio que tienen ahora (si lo hay).
  const vehiculos = useMemo(() => {
    if (positions === null) return null;
    const choferPorTarga = new Map();
    serviciosActuales.forEach((s) => {
      if (s.driver) choferPorTarga.set(normalizeTarga(s.targa), `${s.driver.nombre} ${s.driver.apellido ?? ""}`.trim());
    });
    return positions
      .map((p) => ({ targa: p.targa, lat: p.lat, lng: p.lng, chofer: choferPorTarga.get(normalizeTarga(p.targa)) ?? "" }))
      .sort((x, y) => x.targa.localeCompare(y.targa));
  }, [positions, serviciosActuales]);

  const isReady = (o) => (o.modo === "vehiculo" ? Boolean(o.targa) : o.direccion.trim().length >= 2);
  const canSearch = isReady(origenA) && isReady(origenB) && !loading;

  const toPoint = (o, list) => {
    if (o.modo === "direccion") return { direccion: o.direccion.trim() };
    const v = list.find((p) => p.targa === o.targa);
    return v ? { lat: v.lat, lng: v.lng, label: v.targa } : null;
  };

  const search = async () => {
    const searchId = ++searchIdRef.current;
    pickedRef.current = false;
    setSheet("full");
    setLoading(true);
    setError("");
    setResult(null);
    setRutas(null);
    setSugerencias(null);
    setAviso(null);
    setSelectedKey(null);
    try {
      // La posicion se vuelve a pedir al buscar: los vehiculos se mueven y el punto depende de donde estan ahora.
      const fresh = (await listVehicleLivePositionsRequest().catch(() => null)) ?? positions ?? [];
      setPositions(fresh);
      const a = toPoint(origenA, fresh);
      const b = toPoint(origenB, fresh);
      if (!a || !b) throw new Error("Uno de los vehículos ya no reporta su posición GPS.");
      const data = await findMeetingPointRequest(a, b);
      if (searchId !== searchIdRef.current) return;
      setResult(data);
      setSearchedAt(Date.now());
      setSelectedKey("ideal");
      setLoading(false);

      // Los sitios para parar llegan despues: el punto ideal ya se ve mientras tanto.
      const extra = await getMeetingSuggestionsRequest(data.a, data.b).catch(() => ({
        sugerencias: [],
        aviso: "No se pudieron cargar los sitios para parar. Se muestra solo el punto exacto de la ruta.",
      }));
      if (searchId !== searchIdRef.current) return;
      setSugerencias(extra.sugerencias);
      setAviso(extra.aviso);
      // Si todavia no tocaron nada, se pasa al mejor sitio sugerido.
      if (!pickedRef.current && extra.sugerencias.length) setSelectedKey(0);
    } catch (err) {
      if (searchId !== searchIdRef.current) return;
      setError(err?.response ? parseApiError(err).message : (err?.message ?? "No se pudo calcular el punto de encuentro."));
    } finally {
      if (searchId === searchIdRef.current) setLoading(false);
    }
  };

  const select = (key) => {
    pickedRef.current = true;
    setSelectedKey(key);
    if (isMobile) setSheet("peek");
  };

  const items = useMemo(() => {
    if (!result) return [];
    const ideal = {
      key: "ideal",
      ...result.ideal,
      nombre: "Punto exacto en la ruta",
      tipoLabel: "Mitad del tiempo de viaje (puede ser en plena autopista, sin sitio donde parar)",
      diffMin: Math.abs(result.ideal.minA - result.ideal.minB),
    };
    return [...(sugerencias ?? []).map((s, i) => ({ key: i, ...s })), ideal];
  }, [result, sugerencias]);
  const selected = items.find((i) => i.key === selectedKey) ?? null;

  // Las rutas hasta el punto elegido.
  useEffect(() => {
    if (!result || !selected) {
      setRutas(null);
      return undefined;
    }
    let cancelled = false;
    setRutas(null);
    getMeetingRoutesRequest(result.a, result.b, { lat: selected.lat, lng: selected.lng })
      .then((r) => {
        if (!cancelled) setRutas(r);
      })
      .catch(() => {
        if (!cancelled) setRutas({ rutaA: null, rutaB: null });
      });
    return () => {
      cancelled = true;
    };
  }, [result, selected?.lat, selected?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const pathOf = (ruta) => (ruta?.geometria?.coordinates ?? []).map(([lng, lat]) => ({ lat, lng }));
  const pathA = useMemo(() => pathOf(rutas?.rutaA), [rutas]);
  const pathB = useMemo(() => pathOf(rutas?.rutaB), [rutas]);

  // Encuadra los dos vehiculos y el punto elegido (sin quedar debajo del panel de la izquierda).
  useEffect(() => {
    if (!map || !result || !selected) return;
    const bounds = new window.google.maps.LatLngBounds();
    [result.a, result.b, selected].forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    [...pathA, ...pathB].forEach((p) => bounds.extend(p));
    if (isMobile) {
      // Con la opcion elegida abajo (la tarjeta ocupa unos 250 px) el mapa se encuadra en lo que queda libre arriba.
      map.fitBounds(bounds, { top: 50, right: 40, bottom: sheet === "peek" ? 270 : 50, left: 40 });
      return;
    }
    const panelVisible = listOpen && typeof window !== "undefined" && window.innerWidth >= 640;
    map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: panelVisible ? 380 : 60 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, result, selected?.key, pathA, pathB, sheet]);

  // Antes de buscar, se marca donde esta cada vehiculo elegido.
  const previews = useMemo(() => {
    if (result) return [];
    return [
      { letra: "A", color: COLOR_A, o: origenA },
      { letra: "B", color: COLOR_B, o: origenB },
    ]
      .map(({ letra, color, o }) => {
        const v = o.modo === "vehiculo" ? (vehiculos ?? []).find((x) => x.targa === o.targa) : null;
        return v ? { letra, color, lat: v.lat, lng: v.lng } : null;
      })
      .filter(Boolean);
  }, [result, origenA, origenB, vehiculos]);

  if (!isPrivileged) return <Navigate to="/" replace />;

  const labelDe = (o, point) => (o.modo === "vehiculo" ? o.targa : (point?.label ?? o.direccion));
  const peek = isMobile && sheet === "peek" && Boolean(selected);
  const asideClass = !isMobile
    ? "absolute bottom-3 left-3 top-3 w-[min(340px,calc(100%-1.5rem))] overflow-hidden"
    : peek
      ? "absolute inset-x-2 bottom-2"
      : "absolute inset-0 overflow-y-auto rounded-3xl";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink-50">Punto de encuentro</h1>
        </div>
        <MapSectionTabs />
      </div>

      <Alert>{loadError ? "No se pudo cargar Google Maps." : ""}</Alert>

      <div className="glass-surface relative overflow-hidden rounded-3xl">
        {listOpen ? (
            <aside className={`glass-surface z-10 flex flex-col rounded-2xl ${asideClass}`}>
              {peek ? (
                <div className="flex items-center justify-between gap-2 px-3 pt-3">
                  <p className="min-w-0 truncate text-[12px] text-ink-300">
                    <span className="font-bold" style={{ color: COLOR_A }}>A</span> {labelDe(origenA, result.a)}
                    {" → "}
                    <span className="font-bold" style={{ color: COLOR_B }}>B</span> {labelDe(origenB, result.b)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSheet("full")}
                    className="shrink-0 rounded-full border border-accent-500/60 bg-accent-500/15 px-3 py-1 text-[11.5px] font-semibold text-ink-50 transition-colors hover:bg-accent-500/25"
                  >
                    Ver sugerencias
                  </button>
                </div>
              ) : (
              <>
              <header className="flex items-center justify-between gap-2 border-b border-line/10 px-4 py-3">
                <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink-50">
                  <MapPinIcon className="h-4 w-4 text-ink-300" />
                  Buscar punto de encuentro
                </h2>
                <button
                  type="button"
                  onClick={() => setListOpen(false)}
                  aria-label="Ocultar el panel"
                  title="Ocultar panel"
                  className="hidden h-7 w-7 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-line/10 hover:text-ink-50 sm:flex"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
              </header>

              <div className="flex flex-col gap-2.5 border-b border-line/10 p-3">
                <OrigenField letra="A" color={COLOR_A} value={origenA} onChange={setOrigenA} vehiculos={vehiculos} />
                <OrigenField letra="B" color={COLOR_B} value={origenB} onChange={setOrigenB} vehiculos={vehiculos} />
                <button
                  type="button"
                  onClick={search}
                  disabled={!canSearch}
                  className="flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading && <Spinner className="h-4 w-4 border-white/30 border-t-white" />}
                  {loading ? "Calculando…" : result ? "Recalcular con las posiciones de ahora" : "Buscar punto de encuentro"}
                </button>
                {error && <p className="text-[12px] text-[#ff3b57]">{error}</p>}
              </div>

              <div className="sm:flex-1 sm:overflow-y-auto">
                {result && (
                  <>
                    <div className="border-b border-line/10 px-4 py-2.5 text-[12px] text-ink-300">
                      <p>
                        <span className="font-bold" style={{ color: COLOR_A }}>A</span> {labelDe(origenA, result.a)}
                        {" → "}
                        <span className="font-bold" style={{ color: COLOR_B }}>B</span> {labelDe(origenB, result.b)}
                      </p>
                      <p className="mt-0.5 text-ink-400">
                        Ruta directa: {Math.round(result.ruta.distanciaKm)} km · {minutos(result.ruta.duracionMin)}
                      </p>
                      {aviso && <p className="mt-1.5 text-[#ffb020]">{aviso}</p>}
                      {sugerencias === null && (
                        <p className="mt-1.5 flex items-center gap-2 text-ink-400">
                          <Spinner className="h-3.5 w-3.5 border-line/20 border-t-line" />
                          Buscando áreas de servicio y parkings cerca…
                        </p>
                      )}
                    </div>
                    <ul className="flex flex-col gap-2 p-2">
                      {items.map((item) => (
                        <EncuentroItem
                          key={item.key}
                          item={item}
                          since={searchedAt}
                          active={item.key === selectedKey}
                          onSelect={() => select(item.key)}
                        />
                      ))}
                    </ul>
                  </>
                )}
                {!result && !loading && (
                  <p className="px-4 py-6 text-center text-[12.5px] text-ink-400">
                    Elige los dos extremos (un vehículo del mapa o una dirección escrita) y te sugiero dónde encontrarse.
                  </p>
                )}
              </div>
              </>
              )}

              {peek && (
                <ul className="p-2">
                  <EncuentroItem item={selected} since={searchedAt} active onSelect={() => {}} />
                </ul>
              )}

              <footer className="border-t border-line/10 px-4 py-2 text-[10.5px] text-ink-400">
                Áreas de servicio, de descanso y parkings de camiones: © colaboradores de{" "}
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-ink-200">
                  OpenStreetMap
                </a>
                . Tiempos sin tráfico.
              </footer>
            </aside>
          ) : (
            <button
              type="button"
              onClick={() => setListOpen(true)}
              className="glass-surface absolute left-3 top-3 z-10 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-medium text-ink-50 transition-colors hover:bg-line/10"
            >
              <MapPinIcon className="h-4 w-4 text-ink-300" />
              Punto de encuentro
            </button>
          )}

        <div className="h-[calc(100dvh-17rem)] min-h-[480px] w-full lg:h-[calc(100dvh-12.5rem)]">
          {!isLoaded ? (
            <div className="flex h-full items-center justify-center">
              <Spinner className="h-6 w-6 border-line/20 border-t-line" />
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={MILAN_CENTER}
              zoom={6}
              onLoad={setMap}
              onUnmount={() => setMap(null)}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                styles: theme === "dark" ? [...NIGHT_MODE_STYLES, ...HIDE_POI_STYLES] : HIDE_POI_STYLES,
              }}
            >
              {previews.map((p) => (
                <Marker
                  key={p.letra}
                  position={{ lat: p.lat, lng: p.lng }}
                  icon={pinIcon(p.color)}
                  label={{ text: p.letra, color: "#fff", fontSize: "12px", fontWeight: "700" }}
                />
              ))}

              {pathA.length > 1 && <Polyline path={pathA} options={{ strokeColor: COLOR_A, strokeOpacity: 0.9, strokeWeight: 5 }} />}
              {pathB.length > 1 && <Polyline path={pathB} options={{ strokeColor: COLOR_B, strokeOpacity: 0.9, strokeWeight: 5 }} />}

              {result && (
                <>
                  <Marker
                    position={{ lat: result.a.lat, lng: result.a.lng }}
                    icon={pinIcon(COLOR_A)}
                    label={{ text: "A", color: "#fff", fontSize: "12px", fontWeight: "700" }}
                    title={labelDe(origenA, result.a)}
                    zIndex={20}
                  />
                  <Marker
                    position={{ lat: result.b.lat, lng: result.b.lng }}
                    icon={pinIcon(COLOR_B)}
                    label={{ text: "B", color: "#fff", fontSize: "12px", fontWeight: "700" }}
                    title={labelDe(origenB, result.b)}
                    zIndex={20}
                  />
                  {items.map((item) => (
                    <Marker
                      key={item.key}
                      position={{ lat: item.lat, lng: item.lng }}
                      icon={pinIcon(item.key === selectedKey ? COLOR_PUNTO : "#6b7a99", item.key === selectedKey ? 13 : 6)}
                      label={
                        item.key === selectedKey
                          ? { text: "P", color: "#06210f", fontSize: "12px", fontWeight: "800" }
                          : undefined
                      }
                      title={item.nombre}
                      onClick={() => select(item.key)}
                      zIndex={item.key === selectedKey ? 30 : 10}
                    />
                  ))}
                </>
              )}
            </GoogleMap>
          )}
        </div>
      </div>
    </div>
  );
};
