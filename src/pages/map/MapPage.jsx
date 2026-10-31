import {
  GoogleMap,
  InfoWindow,
  Marker,
  OverlayView,
  Polygon,
  Polyline,
  useJsApiLoader,
} from "@react-google-maps/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { MapSectionTabs } from "../../components/layout/MapSectionTabs";
import { Alert } from "../../components/ui/Alert";
import { GlassCard } from "../../components/ui/GlassCard";
import { ChevronLeftIcon, SearchIcon, TruckIcon } from "../../components/ui/icons";
import { Spinner } from "../../components/ui/Spinner";
import { TextField } from "../../components/ui/TextField";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { parseApiError } from "../../lib/api";
import { EN_PROCESO_STATUSES } from "../../lib/constants";
import { computeLocationPermissionAlerts, filterToPiazzaYDhlRoma } from "../../lib/dashboardStats";
import { PHONE_GPS_ENABLED } from "../../lib/features";
import { addMinutes } from "../../lib/format";
import MILANO_ZONES from "../../lib/geo/milanoZones.json";
import { HIDE_POI_STYLES, NIGHT_MODE_STYLES } from "../../lib/mapStyles";
import { startVisibleInterval } from "../../lib/polling";
import { PEAJE_COLOR_CERCA } from "../../lib/peajes";
import { PeajesLayer } from "../../components/mapa/PeajesLayer";
import { getRecordLiveEtaRequest, listPendingRecordsRequest } from "../../lib/records.api";
import { getEtaToDestinationRequest, listCurrentServicesRequest, listVehicleLivePositionsRequest, listVehiclesRequest } from "../../lib/vehicles.api";
import { getDriverReturnEtaRequest, listDriverLocationsRequest, listUsersRequest } from "../../lib/users.api";

// Modulo estable fuera del componente: si se recrea en cada render, useJsApiLoader
// recarga el script de Google Maps una y otra vez.
const GOOGLE_MAPS_LIBRARIES = [];

const MILAN_CENTER = { lat: 45.4642, lng: 9.19 };
// 30s: coincide con lo que la propia Velocity Fleet recomienda como cadencia para el
// GPS del vehiculo (ver KINESIS_LIVE_MAP_REFRESH_RATE en su doc de Device Positions) -
// llamar mas seguido que eso no aporta nada, solo consume mas cuota de su API. Se
// aplica igual a ubicaciones/registros/ETA para no tener 2 cadencias distintas en la
// misma pagina.
const REFRESH_INTERVAL_MS = 30000;
// El Mapa se usa para mirar sin tocar nada: se tolera mas inactividad que en la campanita
// antes de pausar el refresco (ver startVisibleInterval).
const MAP_IDLE_MS = 15 * 60 * 1000;

// Chofer con ubicacion fresca pero sin servicio "en camino" ahora mismo (volviendo de
// una entrega o esperando el proximo): mismo gris que el estado "En suspenso" en el
// resto de la app, para diferenciarlo del pin rojo por defecto de los que si reparten.
const IDLE_DRIVER_COLOR = "#8ea3c9";
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

// Ruta y pin del destino escrito a mano (buscador de targa, "ETA a un destino") -
// mismo azul que el resto de la app para lineas de ruta, para no sumar otro color mas.
const DESTINO_ROUTE_COLOR = "#3987e5";

// Colores del pin para un vehiculo con GPS de Velocity Fleet, segun movimiento/motor -
// pedido explicito: verde en movimiento, naranja parado con motor encendido, rojo
// parado y apagado. Umbral chico (no exactamente 0) para no marcar "en movimiento" un
// vehiculo parado por el ruido normal de un GPS quieto.
const VEHICLE_MOVING_SPEED_THRESHOLD = 1;
const VEHICLE_STATUS_COLOR = {
  moving: "#22e093",
  idlingOn: "#ff8a1a",
  idlingOff: "#ff3b57",
};
const isVehicleMoving = (vehiculoGps) =>
  vehiculoGps.speed != null && vehiculoGps.speed > VEHICLE_MOVING_SPEED_THRESHOLD;

const vehicleStatusColor = (vehiculoGps) => {
  if (isVehicleMoving(vehiculoGps)) return VEHICLE_STATUS_COLOR.moving;
  return vehiculoGps.ignition ? VEHICLE_STATUS_COLOR.idlingOn : VEHICLE_STATUS_COLOR.idlingOff;
};

// En movimiento y con rumbo (direction) conocido: flecha rotada senalando hacia donde
// va, mas realista que un circulo. Parado, o en movimiento sin rumbo (direction viene
// null en algunos dispositivos), se mantiene el circulo de siempre.
const vehicleIcon = (vehiculoGps) => {
  const moving = isVehicleMoving(vehiculoGps);
  if (moving && vehiculoGps.direction != null) {
    return {
      path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 5,
      rotation: vehiculoGps.direction,
      fillColor: VEHICLE_STATUS_COLOR.moving,
      fillOpacity: 0.9,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    };
  }
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: vehicleStatusColor(vehiculoGps),
    fillOpacity: 0.9,
    strokeColor: "#ffffff",
    strokeWeight: 2,
  };
};

// Perimetros oficiales de Area B y Area C (Comune di Milano, portal GIS
// gisportal.comune.milano.it - capas "Confine Area B" y "Confine Area C").
// Area B viene como MultiPolygon (el contorno grande mas varios enclaves chicos
// separados), por eso son varios "paths" en el mismo Polygon.
const AREA_C_COLOR = "#ff3b57";
const AREA_B_COLOR = "#a78bfa";
const AREA_C_PATH = MILANO_ZONES.areaC;
const AREA_B_PATHS = MILANO_ZONES.areaB;

const minutesAgo = (dateString) => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  return Math.max(0, Math.round(diffMs / 60000));
};

// Estado de cada vehiculo de la lista lateral: con GPS del vehiculo (Velocity Fleet) segun
// movimiento/motor; sin el, solo se conoce la ubicacion del celular del chofer.
const locStatus = (loc) => {
  if (!loc.vehiculoGps) return "noGps";
  if (isVehicleMoving(loc.vehiculoGps)) return "moving";
  return loc.vehiculoGps.ignition ? "idlingOn" : "idlingOff";
};
const STATUS_ORDER = { moving: 0, idlingOn: 1, idlingOff: 2, noGps: 3 };
const STATUS_META = {
  moving: { label: "En movimiento", chip: "En mov.", color: VEHICLE_STATUS_COLOR.moving },
  idlingOn: { label: "Parado · motor encendido", chip: "Encendido", color: VEHICLE_STATUS_COLOR.idlingOn },
  idlingOff: { label: "Parado · motor apagado", chip: "Apagado", color: VEHICLE_STATUS_COLOR.idlingOff },
  noGps: { label: "Ubicación del celular", chip: "Sin GPS", color: IDLE_DRIVER_COLOR },
};

// Una posicion mas vieja que esto se toma como GPS sin senal (el dispositivo dejo de reportar).
const GPS_SIN_SENAL_MIN = 24 * 60;
const GPS_OFF_COLOR = "#8a94a8";

// Distancia en km entre dos puntos { lat, lng } (aproximada, de sobra para saber si dos pines estan lejos).
const distanceKm = (a, b) => {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

// Id del marcador: uno por vehiculo con GPS y uno por celular (cuadradito). Es el que abre su InfoWindow.
const markerIdOf = (loc) => (loc.celular ? `phone-${loc.id}` : loc.id);

// Pin del celular de un chofer: un cuadradito, para diferenciarlo del pin redondo/flecha de los vehiculos.
const PHONE_PIN_COLOR = "#a78bfa";
const phoneIcon = () => ({
  path: "M -6 -6 L 6 -6 L 6 6 L -6 6 Z",
  scale: 1,
  fillColor: PHONE_PIN_COLOR,
  fillOpacity: 0.95,
  strokeColor: "#ffffff",
  strokeWeight: 2,
});

const haceTexto = (min) => {
  if (min < 60) return `${min} min`;
  if (min < 48 * 60) return `${Math.round(min / 60)} h`;
  return `${Math.round(min / 1440)} d`;
};

const VehicleListItem = ({ item, active, onSelect }) => {
  const meta = STATUS_META[item.status];
  const speed = item.loc?.vehiculoGps?.speed;
  // Sin ubicacion en el mapa: el vehiculo esta en la flota pero su GPS no reporta (apagado o sin instalar).
  const sinUbicacion = !item.loc;
  const gpsAviso = sinUbicacion ? "GPS desactivado" : item.sinSenalMin != null ? `Sin señal · hace ${haceTexto(item.sinSenalMin)}` : null;
  const dotColor = sinUbicacion ? GPS_OFF_COLOR : meta.color;
  return (
    <li>
      <button
        type="button"
        disabled={sinUbicacion}
        onClick={() => onSelect(item.loc)}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors enabled:hover:bg-line/10 ${
          active ? "bg-line/10 ring-1 ring-accent-500/40" : ""
        } ${sinUbicacion ? "cursor-default" : ""}`}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-[var(--glass-surface-bg)]"
          style={{ backgroundColor: dotColor, boxShadow: sinUbicacion ? "none" : `0 0 8px ${dotColor}` }}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className={`truncate text-[13px] font-semibold tracking-wide ${sinUbicacion ? "text-ink-200" : "text-ink-50"}`}>
              {item.targa ?? "Sin vehículo"}
            </span>
            {gpsAviso && (
              <span
                className="shrink-0 rounded-full border border-line/15 px-2 py-0.5 text-[10.5px] font-medium"
                style={{ color: GPS_OFF_COLOR }}
              >
                {gpsAviso}
              </span>
            )}
          </span>
          <span className="block truncate text-[12px] text-ink-300">
            {item.driver ? (item.servicioCodigo ? `${item.driver} · ${item.servicioCodigo}` : item.driver) : "Sin servicio"}
          </span>
          {item.varios && <span className="block truncate text-[11px] font-medium text-warning-500">Revisar: 2 servicios a la vez</span>}
          {item.movimientoSinServicio && (
            <span className="block truncate text-[11px] font-medium text-warning-500">En movimiento sin servicio</span>
          )}
          {!sinUbicacion && (
            <span className="block truncate text-[11px] font-medium" style={{ color: meta.color }}>
              {meta.label}
            </span>
          )}
        </span>
        {item.status === "moving" && speed != null && (
          <span className="shrink-0 text-[12px] font-semibold text-ink-100">
            {Math.round(speed)} {item.loc.vehiculoGps.speedUnit ?? ""}
          </span>
        )}
      </button>
    </li>
  );
};

export const MapPage = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  // Instancia nativa del mapa (ver onLoad/onUnmount mas abajo) - hace falta para
  // centrar/hacer zoom al elegir un resultado del buscador de targa.
  const [map, setMap] = useState(null);
  const [openInfoId, setOpenInfoId] = useState(null);
  const [showAreaC, setShowAreaC] = useState(true);
  const [showAreaB, setShowAreaB] = useState(true);
  const [showPeajes, setShowPeajes] = useState(true);
  // Lista lateral de vehiculos (encima del mapa, a la izquierda): filtro de texto por
  // targa/chofer, filtro por estado y si esta desplegada (en celular arranca cerrada).
  const [targaQuery, setTargaQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [areaFilter, setAreaFilter] = useState("todos");
  // Flota completa (fichas de Vehiculos): la lista muestra todos los vehiculos, tengan o no GPS activo.
  const [fleet, setFleet] = useState(null);
  const [listOpen, setListOpen] = useState(
    () => typeof window === "undefined" || window.matchMedia("(min-width: 640px)").matches
  );
  // ETA a un destino escrito a mano, para el marcador que tiene el InfoWindow abierto
  // (ver el formulario adentro del InfoWindow mas abajo). undefined = todavia no se
  // busco nada, null = se busco pero no se pudo calcular.
  const [destinoQuery, setDestinoQuery] = useState("");
  const [destinoEta, setDestinoEta] = useState(undefined);
  const [destinoLoading, setDestinoLoading] = useState(false);

  const [locations, setLocations] = useState(null);
  // GPS del vehiculo (Velocity Fleet) - solo trae los vehiculos que tienen el
  // dispositivo instalado. Ver enrichedLocations mas abajo: reemplaza la posicion del
  // celular del chofer por esta cuando esta disponible para su vehiculo asignado.
  const [vehiclePositions, setVehiclePositions] = useState(null);
  // De quien es cada vehiculo ahora: el servicio que tiene en este momento y su chofer (ver listCurrentServicesRequest).
  const [serviciosActuales, setServiciosActuales] = useState(null);
  const [records, setRecords] = useState(null);
  const [allDrivers, setAllDrivers] = useState(null);
  // ETA del marcador que tiene el InfoWindow abierto en el mapa (un servicio en camino,
  // o el regreso de un chofer libre) - se pide a demanda (ver el useEffect mas abajo),
  // no para todos los choferes en cada refresco de posiciones: recalcular la ruta de 30
  // choferes cada 30s aunque nadie los este mirando sale caro de mas.
  // undefined = todavia no se pidio nada, null = se pidio pero no hay ETA disponible.
  const [openMarkerEta, setOpenMarkerEta] = useState(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isPrivileged) return;

    let cancelled = false;
    const load = () => {
      // GPS del celular apagado (ver lib/features.js): no se piden ubicaciones de
      // celulares (una request menos cada 30s); el mapa sale solo del GPS del vehiculo.
      if (PHONE_GPS_ENABLED) {
        listDriverLocationsRequest()
          .then((data) => {
            if (!cancelled) setLocations(data);
          })
          .catch((err) => {
            if (!cancelled) setError(parseApiError(err).message);
          });
      } else {
        setLocations([]);
      }
      // Solo los servicios de hoy en curso (/records/pending), no el historial completo: el
      // mapa se refresca cada 30s y el historial pesa MBs.
      listPendingRecordsRequest()
        .then((data) => {
          // Acotado a Piazza + DHL Roma (ver filterToPiazzaYDhlRoma) - la lista de
          // "servicios en curso" no debe mostrar pendientes de DHL Milano/AB Service/
          // Extras Stefania, mismo criterio que el resto de la app.
          if (!cancelled) setRecords(filterToPiazzaYDhlRoma(data));
        })
        .catch((err) => {
          if (!cancelled) setError(parseApiError(err).message);
        });
      // Silencioso: el backend ya devuelve [] si Velocity Fleet no esta configurado o
      // no responde (ver velocityFleet.service.js) - no tiene sentido mostrar el error
      // banner de la pagina por una mejora best-effort, el mapa sigue andando igual con
      // la ubicacion del celular del chofer.
      listVehicleLivePositionsRequest()
        .then((data) => {
          if (!cancelled) setVehiclePositions(data);
        })
        .catch(() => {});
      // Silencioso tambien: sin esto el mapa solo muestra las targas, sin chofer.
      listCurrentServicesRequest()
        .then((data) => {
          if (!cancelled) setServiciosActuales(data);
        })
        .catch(() => {});
    };

    load();
    // Pausa sola mientras la pestania no esta visible (ver startVisibleInterval) - una
    // pestania del Mapa olvidada en segundo plano no tiene por que seguir pidiendo
    // ubicaciones/registros cada 20s para siempre.
    const stopPolling = startVisibleInterval(load, REFRESH_INTERVAL_MS, { idleMs: MAP_IDLE_MS });
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [isPrivileged]);

  // Lista completa de choferes (a diferencia de "locations", que solo trae a los que
  // estan compartiendo ubicacion ahora mismo) - para cruzar el vehiculo asignado de
  // cada uno con el GPS de Velocity Fleet (ver driverVehicleTarga/enrichedLocations mas
  // abajo) y para la auditoria de permisos de GPS. Se pide una sola vez, no hace falta
  // refrescarla cada 30s.
  useEffect(() => {
    if (!isPrivileged) return;
    let cancelled = false;
    listUsersRequest()
      .then((data) => {
        if (!cancelled) setAllDrivers(data);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [isPrivileged]);

  useEffect(() => {
    if (!isPrivileged) return;
    let cancelled = false;
    listVehiclesRequest()
      .then((data) => {
        if (!cancelled) setFleet(data);
      })
      .catch(() => {
        if (!cancelled) setFleet([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isPrivileged]);

  const normalizeTarga = (targa) => targa?.replace(/\s+/g, "").toUpperCase() ?? "";

  // De quien es cada vehiculo ahora, por targa.
  const currentServiceByTarga = useMemo(() => {
    const map = new Map();
    (serviciosActuales ?? []).forEach((s) => map.set(normalizeTarga(s.targa), s));
    return map;
  }, [serviciosActuales]);

  // Un pin por cada vehiculo con GPS (Velocity Fleet / OneSystec) y, si el celular de los choferes esta activo, un pin aparte por cada celular
  // (cuadradito). El chofer que se muestra en un vehiculo es el del SERVICIO que tiene ahora (desde 50 min antes del retiro hasta que termina la
  // vuelta), nunca el "vehiculo habitual" del chofer: el vehiculo puede cambiar en cualquier momento. Sin servicio, solo la targa.
  const enrichedLocations = useMemo(() => {
    if (!locations) return locations;

    const vehicleLocs = (vehiclePositions ?? []).map((vp) => {
      const normTarga = normalizeTarga(vp.targa);
      const actual = currentServiceByTarga.get(normTarga);
      const servicio = actual?.servicio
        ? ((records ?? []).find((r) => r.id === actual.servicio.id) ?? {
            id: actual.servicio.id,
            codigo: actual.servicio.codigo,
            destinazione: actual.servicio.destinazione,
            estado: actual.servicio.estado,
          })
        : null;
      return {
        id: `vehiculo-${normTarga}`,
        nombre: actual?.driver?.nombre ?? vp.targa,
        apellido: actual?.driver?.apellido ?? "",
        lat: vp.lat,
        lng: vp.lng,
        actualizada: vp.updatedAt,
        servicio,
        servicioActual: actual?.servicio ? { ...actual.servicio, tramo: actual.tramo, varios: actual.varios } : null,
        vehiculoGps: {
          targa: vp.targa,
          speed: vp.speed,
          speedUnit: vp.speedUnit,
          ignition: vp.ignition,
          direction: vp.direction,
        },
        sinChofer: !actual?.driver,
      };
    });

    // Celular lejos de su vehiculo: si el chofer de un servicio tiene el celular en el mapa y el vehiculo de ese servicio tambien, y estan a mas de
    // 3 km, se marca (los dos datos no concuerdan: puede haber un cruce).
    const phoneLocs = locations.map((loc) => {
      const vehicleLoc = loc.servicio ? vehicleLocs.find((v) => v.servicio?.id === loc.servicio.id) : null;
      const distanciaVehiculoKm = vehicleLoc ? distanceKm(loc, vehicleLoc) : null;
      if (vehicleLoc && distanciaVehiculoKm > 3) vehicleLoc.distanciaCelularKm = distanciaVehiculoKm;
      return { ...loc, celular: true, distanciaVehiculoKm };
    });

    return [...vehicleLocs, ...phoneLocs];
  }, [locations, vehiclePositions, currentServiceByTarga, records]);

  // Una fila por vehiculo en la lista lateral: toda la flota (fichas de Vehiculos). Los que tienen GPS salen
  // con su estado y se pueden ubicar en el mapa; los que no, al final y marcados "GPS desactivado". Sin GPS
  // ni ficha del celular, no hay pin. Los vehiculos que reportan pero no tienen ficha caen en "Sin asignar".
  const vehicleItems = useMemo(() => {
    // La lista solo muestra los vehiculos que el Admin dejo visibles en el Mapa (interruptor de cada vehiculo en Vehiculos).
    const allowedFleet = (fleet ?? []).filter((v) => v.mostrarEnMapa !== false);
    const fleetByTarga = new Map((fleet ?? []).map((v) => [normalizeTarga(v.targa), v]));
    const infoActual = (targa) => {
      const actual = targa ? currentServiceByTarga.get(normalizeTarga(targa)) : undefined;
      return {
        driver: actual?.driver ? `${actual.driver.nombre} ${actual.driver.apellido}`.trim() : null,
        servicioCodigo: actual?.servicio?.codigo ?? null,
        varios: Boolean(actual?.varios),
        tieneServicio: Boolean(actual?.servicio),
      };
    };

    const withLocation = (enrichedLocations ?? [])
      .filter((loc) => loc.vehiculoGps)
      .filter((loc) => {
        const f = fleetByTarga.get(normalizeTarga(loc.vehiculoGps.targa));
        return !f || f.mostrarEnMapa !== false;
      })
      .map((loc) => {
        const targa = loc.vehiculoGps.targa;
        const ficha = fleetByTarga.get(normalizeTarga(targa));
        const minutos = loc.actualizada ? minutesAgo(loc.actualizada) : null;
        const sinSenal = minutos != null && minutos >= GPS_SIN_SENAL_MIN;
        const actual = infoActual(targa);
        const status = locStatus(loc);
        return {
          loc,
          status,
          targa,
          driver: actual.driver,
          servicioCodigo: actual.servicioCodigo,
          varios: actual.varios,
          movimientoSinServicio: status === "moving" && !actual.tieneServicio,
          area: ficha?.area ?? "SIN_ASIGNAR",
          modelo: ficha?.modelo ?? null,
          sinSenalMin: sinSenal ? minutos : null,
          empresa: ficha?.empresa ?? "GAMONAL",
        };
      });

    const represented = new Set(withLocation.map((i) => normalizeTarga(i.targa)));
    const withoutGps = allowedFleet
      .filter((v) => !represented.has(normalizeTarga(v.targa)))
      .map((v) => {
        const actual = infoActual(v.targa);
        return {
          loc: null,
          status: "noGps",
          targa: v.targa,
          driver: actual.driver,
          servicioCodigo: actual.servicioCodigo,
          varios: actual.varios,
          movimientoSinServicio: false,
          area: v.area,
          modelo: v.modelo,
          sinSenalMin: null,
          empresa: v.empresa ?? "GAMONAL",
        };
      });

    return [...withLocation, ...withoutGps].sort(
      (a, b) =>
        (a.loc ? 0 : 1) - (b.loc ? 0 : 1) ||
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (a.targa ?? "~").localeCompare(b.targa ?? "~", "es")
    );
  }, [enrichedLocations, fleet, currentServiceByTarga]);

  // Pestanias de la lista: "General" (todos los vehiculos permitidos en el mapa), "Gamonal" (la flota de la empresa) y "Piazza" (los vehiculos que
  // aporte Piazza; mientras no haya ninguno, queda en 0).
  const areaTabs = useMemo(
    () => [
      { key: "todos", label: "General", count: vehicleItems.length },
      { key: "GAMONAL", label: "Gamonal", count: vehicleItems.filter((i) => i.empresa === "GAMONAL").length },
      { key: "PIAZZA", label: "Piazza", count: vehicleItems.filter((i) => i.empresa === "PIAZZA").length },
    ],
    [vehicleItems]
  );

  const itemsInArea = useMemo(
    () => (areaFilter === "todos" ? vehicleItems : vehicleItems.filter((i) => i.empresa === areaFilter)),
    [vehicleItems, areaFilter]
  );

  const statusCounts = useMemo(() => {
    const counts = { todos: itemsInArea.length, moving: 0, idlingOn: 0, idlingOff: 0, noGps: 0 };
    itemsInArea.forEach((item) => {
      counts[item.status] += 1;
    });
    return counts;
  }, [itemsInArea]);

  // Filtra por estado y por texto (targa sin espacios o nombre del chofer).
  const visibleItems = useMemo(() => {
    const query = targaQuery.trim();
    const normQuery = normalizeTarga(query);
    const lowerQuery = query.toLowerCase();
    return itemsInArea.filter((item) => {
      if (statusFilter !== "todos" && item.status !== statusFilter) return false;
      if (!query) return true;
      return (
        (item.targa && normalizeTarga(item.targa).includes(normQuery)) ||
        (item.driver && item.driver.toLowerCase().includes(lowerQuery))
      );
    });
  }, [itemsInArea, statusFilter, targaQuery]);

  // Centra/hace zoom sobre el vehiculo elegido en la lista y abre su InfoWindow - mismo
  // id que usan los Marker mas abajo (loc.servicio?.id ?? `idle-${loc.id}`). En celular
  // la lista se cierra para dejar ver el mapa.
  const selectVehicle = (loc) => {
    const markerId = markerIdOf(loc);
    setOpenInfoId(markerId);
    map?.panTo({ lat: loc.lat, lng: loc.lng });
    map?.setZoom(15);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches) setListOpen(false);
  };

  // Auditoria del mapa: choferes que no van a aparecer arriba (o que se van a "caer" del
  // mapa apenas salgan a repartir) porque el celular reporto el permiso de ubicacion en
  // segundo plano desactivado - la misma alerta que ya existe para la campanita/Resumen
  // diario, mostrada aca porque es exactamente donde importa notarla: junto a quienes SI
  // se estan viendo ahora mismo.
  const locationPermissionAlerts = useMemo(
    () => (PHONE_GPS_ENABLED ? computeLocationPermissionAlerts(allDrivers ?? [], records ?? []) : []),
    [allDrivers, records]
  );

  // Vehiculo/chofer del marcador que tiene el InfoWindow abierto ahora mismo (o
  // undefined si no hay ninguno abierto) - se usa para el formulario de "ETA a un
  // destino" que se muestra adentro del InfoWindow.
  const openLoc = useMemo(
    () => enrichedLocations?.find((loc) => markerIdOf(loc) === openInfoId),
    [enrichedLocations, openInfoId]
  );

  // ETA del marcador que tiene el InfoWindow abierto: la del servicio (en vivo) si tiene uno, o el tiempo de regreso a la base de un chofer libre
  // (solo celulares). Un vehiculo sin servicio no tiene ETA que calcular. Solo se pide mientras ese InfoWindow sigue abierto.
  // undefined = todavia no llego la primera respuesta ("Calculando..."), null = no hay ETA disponible.
  const etaRecordId = openLoc?.servicio?.id ?? null;
  const etaDriverId = !etaRecordId && openLoc?.celular ? openLoc.id : null;
  useEffect(() => {
    if (!openInfoId || openInfoId === "destination" || (!etaRecordId && !etaDriverId)) {
      setOpenMarkerEta(openInfoId && openInfoId !== "destination" ? null : undefined);
      return;
    }

    setOpenMarkerEta(undefined);
    let cancelled = false;
    const fetchEta = () => {
      const request = etaRecordId ? getRecordLiveEtaRequest(etaRecordId) : getDriverReturnEtaRequest(etaDriverId);
      request
        .then((eta) => {
          if (!cancelled) setOpenMarkerEta(eta ?? null);
        })
        .catch(() => {
          if (!cancelled) setOpenMarkerEta(null);
        });
    };

    fetchEta();
    const stopPolling = startVisibleInterval(fetchEta, REFRESH_INTERVAL_MS, { idleMs: MAP_IDLE_MS });
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [openInfoId, etaRecordId, etaDriverId]);

  // El formulario de destino es "a demanda" (el usuario escribe y confirma), no se
  // vuelve a pedir solo. Se limpia al cambiar de marcador (o cerrar el InfoWindow)
  // para no mostrar el resultado de un vehiculo distinto al que se esta mirando ahora.
  useEffect(() => {
    setDestinoQuery("");
    setDestinoEta(undefined);
    setDestinoLoading(false);
  }, [openInfoId]);

  const submitDestinoSearch = (e) => {
    e.preventDefault();
    const destino = destinoQuery.trim();
    if (!destino || !openLoc) return;
    setDestinoLoading(true);
    getEtaToDestinationRequest(openLoc.lat, openLoc.lng, destino)
      .then((eta) => setDestinoEta(eta ?? null))
      .catch(() => setDestinoEta(null))
      .finally(() => setDestinoLoading(false));
  };

  // Geometria de la ruta al destino escrito a mano (ver DESTINO_ROUTE_COLOR mas
  // abajo, se dibuja con <Polyline>) - viene directo en la respuesta del backend
  // (OSRM ya la calcula junto con distancia/duracion), no es una consulta extra.
  const destinoRoutePositions = useMemo(
    () => destinoEta?.geometria?.coordinates?.map(([lng, lat]) => ({ lat, lng })),
    [destinoEta]
  );

  // Centra el mapa en el primer chofer/vehiculo con ubicacion, pero UNA sola vez (la
  // primera vez que hay datos) - antes se recalculaba en cada refresco de
  // "locations"/"vehiclePositions" (cada 20s), y GoogleMap volvia a centrar el mapa
  // ahi solo -en Roma, si el primero de la lista quedaba ahi- peleandose con que el
  // usuario estuviera explorando otra parte del mapa a mano. Pedido explicito: no
  // reiniciar mas la vista sola.
  const hasAutoCenteredOnDriversRef = useRef(false);
  const [driversAutoCenter, setDriversAutoCenter] = useState(null);
  useEffect(() => {
    if (hasAutoCenteredOnDriversRef.current) return;
    if (!enrichedLocations?.length) return;
    setDriversAutoCenter({ lat: enrichedLocations[0].lat, lng: enrichedLocations[0].lng });
    hasAutoCenteredOnDriversRef.current = true;
  }, [enrichedLocations]);

  if (!isPrivileged) return <Navigate to="/" replace />;

  const center = driversAutoCenter ?? MILAN_CENTER;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink-50">Mapa</h1>
        </div>
        <MapSectionTabs />
      </div>

      <Alert>{error || (loadError ? "No se pudo cargar Google Maps." : "")}</Alert>

      {/* Auditoria de GPS: estos choferes no van a aparecer en el mapa de arriba (o se
          van a "caer" apenas salgan a repartir) aunque tengan un servicio activo. */}
      {locationPermissionAlerts.length > 0 && (
        <GlassCard className="border border-status-rischedulato/25 bg-status-rischedulato/5 !p-4">
          <h2 className="text-[14px] font-semibold text-ink-50">
            GPS apagado ({locationPermissionAlerts.length})
          </h2>
          <p className="mt-1 text-[12px] text-ink-300">
            No van a aparecer arriba (o se van a caer apenas salgan a repartir) hasta que activen
            "Permitir todo el tiempo" en el celular.
          </p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {locationPermissionAlerts.map((alert) => (
              <li key={alert.id}>
                <Link
                  to={alert.link}
                  className={`block rounded-lg px-3 py-2 text-[12.5px] transition-colors hover:brightness-110 ${
                    alert.severity === "urgent"
                      ? "bg-danger-500/10 text-danger-500"
                      : "bg-status-rischedulato/10 text-status-rischedulato"
                  }`}
                >
                  {alert.message}
                </Link>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      <div className="glass-surface relative overflow-hidden rounded-3xl">
        {isLoaded &&
          (listOpen ? (
            <aside className="glass-surface absolute bottom-9 left-3 top-3 z-10 flex w-[min(300px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl">
              <header className="flex items-center justify-between gap-2 border-b border-line/10 px-4 py-3">
                <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink-50">
                  <TruckIcon className="h-4 w-4 text-ink-300" />
                  Vehículos <span className="font-normal text-ink-400">({itemsInArea.length})</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setListOpen(false)}
                  aria-label="Ocultar la lista de vehículos"
                  title="Ocultar lista"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-line/10 hover:text-ink-50"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
              </header>

              <div className="flex flex-wrap gap-1.5 border-b border-line/10 px-3 py-2.5">
                {areaTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setAreaFilter(tab.key)}
                    aria-pressed={areaFilter === tab.key}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      areaFilter === tab.key
                        ? "border-accent-500/60 bg-accent-500/20 text-ink-50"
                        : "border-line/10 text-ink-300 hover:bg-line/10"
                    }`}
                  >
                    {tab.label} {tab.count}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2.5 border-b border-line/10 p-3">
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    type="search"
                    value={targaQuery}
                    onChange={(e) => setTargaQuery(e.target.value)}
                    placeholder="Buscar targa o chofer..."
                    aria-label="Buscar targa o chofer"
                    className="glass-input w-full rounded-lg py-2 pl-9 pr-3 text-[13px] text-ink-50"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "todos", label: "Todos", color: null },
                    ...["moving", "idlingOn", "idlingOff", "noGps"].map((key) => ({
                      key,
                      label: STATUS_META[key].chip,
                      color: STATUS_META[key].color,
                    })),
                  ].map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setStatusFilter(chip.key)}
                      aria-pressed={statusFilter === chip.key}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        statusFilter === chip.key
                          ? "border-accent-500/60 bg-accent-500/15 text-ink-50"
                          : "border-line/10 text-ink-300 hover:bg-line/10"
                      }`}
                    >
                      {chip.color && (
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: chip.color }} />
                      )}
                      {chip.label} {statusCounts[chip.key]}
                    </button>
                  ))}
                </div>
              </div>

              <ul className="flex-1 overflow-y-auto p-1.5">
                {enrichedLocations === null || fleet === null ? (
                  <li className="flex justify-center py-6">
                    <Spinner className="h-5 w-5 border-line/20 border-t-line" />
                  </li>
                ) : visibleItems.length === 0 ? (
                  <li className="px-3 py-6 text-center text-[13px] text-ink-400">
                    {itemsInArea.length === 0 ? "Ningún vehículo en esta área." : "Sin resultados."}
                  </li>
                ) : (
                  visibleItems.map((item) => (
                    <VehicleListItem
                      key={item.targa ?? item.loc?.id}
                      item={item}
                      active={!!item.loc && openInfoId === markerIdOf(item.loc)}
                      onSelect={selectVehicle}
                    />
                  ))
                )}
              </ul>

              <footer className="flex items-center gap-4 border-t border-line/10 px-4 py-2.5 text-[12px] text-ink-300">
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={showAreaC}
                    onChange={(e) => setShowAreaC(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#ff3b57]"
                  />
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: AREA_C_COLOR }} />
                  Área C
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={showAreaB}
                    onChange={(e) => setShowAreaB(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#a78bfa]"
                  />
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: AREA_B_COLOR }} />
                  Área B
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={showPeajes}
                    onChange={(e) => setShowPeajes(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#ff8a1a]"
                  />
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PEAJE_COLOR_CERCA }} />
                  Peajes
                </label>
              </footer>
            </aside>
          ) : (
            <button
              type="button"
              onClick={() => setListOpen(true)}
              className="glass-surface absolute left-3 top-3 z-10 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-medium text-ink-50 transition-colors hover:bg-line/10"
            >
              <TruckIcon className="h-4 w-4 text-ink-300" />
              Vehículos ({vehicleItems.length})
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
              center={center}
              zoom={12}
              onLoad={setMap}
              onUnmount={() => setMap(null)}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                styles: theme === "dark" ? [...NIGHT_MODE_STYLES, ...HIDE_POI_STYLES] : HIDE_POI_STYLES,
              }}
            >
              <PeajesLayer map={map} visible={showPeajes} />
              {showAreaC && (
                <Polygon
                  paths={AREA_C_PATH}
                  options={{
                    strokeColor: AREA_C_COLOR,
                    strokeWeight: 2,
                    fillColor: AREA_C_COLOR,
                    fillOpacity: 0.06,
                    clickable: false,
                    zIndex: 1,
                  }}
                />
              )}

              {showAreaB && (
                <Polygon
                  paths={AREA_B_PATHS}
                  options={{
                    strokeColor: AREA_B_COLOR,
                    strokeWeight: 2,
                    fillColor: AREA_B_COLOR,
                    fillOpacity: 0.05,
                    clickable: false,
                    zIndex: 0,
                  }}
                />
              )}

              {destinoRoutePositions?.length > 0 && (
                <>
                  <Polyline
                    path={destinoRoutePositions}
                    options={{ strokeColor: DESTINO_ROUTE_COLOR, strokeWeight: 4 }}
                  />
                  <Marker
                    position={destinoEta.destino}
                    icon={{
                      path: window.google.maps.SymbolPath.CIRCLE,
                      scale: 9,
                      fillColor: DESTINO_ROUTE_COLOR,
                      fillOpacity: 0.9,
                      strokeColor: "#ffffff",
                      strokeWeight: 2,
                    }}
                  />
                </>
              )}

              {/* Targa siempre visible arriba del punto (prendido, apagado o en
                  movimiento) - para saber que vehiculo es cada uno sin tener que
                  clickear el marcador uno por uno. Solo para los que tienen GPS de
                  vehiculo (no para un chofer sin vehiculo asignado, ahi no hay targa
                  que mostrar). Mismo click que el marcador: abre su InfoWindow. */}
              {enrichedLocations
                ?.filter((loc) => loc.vehiculoGps)
                .map((loc) => {
                  const markerId = markerIdOf(loc);
                  return (
                    <OverlayView
                      key={`label-${markerId}`}
                      position={{ lat: loc.lat, lng: loc.lng }}
                      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                      getPixelPositionOffset={(width, height) => ({ x: -width / 2, y: -height - 20 })}
                    >
                      {/* Colores fijos, sin clases de tema (ink, dark) - se ve como
                          una tarjeta clara siempre, independiente del tema de la app,
                          para que se lea bien sobre cualquier fondo del mapa. */}
                      <div
                        onClick={() => setOpenInfoId(markerId)}
                        className="w-fit cursor-pointer whitespace-nowrap rounded-md border border-gray-300 bg-white px-2 py-1 text-[12px] font-bold text-gray-900 shadow-md"
                      >
                        {loc.vehiculoGps.targa}
                      </div>
                    </OverlayView>
                  );
                })}

              {/* Celulares de los choferes: el cuadradito lleva el nombre de la persona (no es un vehiculo). */}
              {enrichedLocations
                ?.filter((loc) => loc.celular)
                .map((loc) => (
                  <OverlayView
                    key={`label-${markerIdOf(loc)}`}
                    position={{ lat: loc.lat, lng: loc.lng }}
                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                    getPixelPositionOffset={(width, height) => ({ x: -width / 2, y: -height - 14 })}
                  >
                    <div
                      onClick={() => setOpenInfoId(markerIdOf(loc))}
                      className="w-fit cursor-pointer whitespace-nowrap rounded-md border border-violet-300 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-900 shadow-md"
                    >
                      {loc.nombre} {loc.apellido}
                    </div>
                  </OverlayView>
                ))}

              {enrichedLocations?.map((loc) => {
                // key/estado por loc.servicio.id cuando hay servicio (un mismo chofer
                // puede tener varias entradas si tiene mas de un servicio "en camino"
                // a la vez, viajes compactados, todas con el mismo loc.id); si esta
                // libre (sin servicio) usa loc.id, que ahi si es unico por chofer.
                const markerId = markerIdOf(loc);
                return (
                  <Marker
                    key={markerId}
                    position={{ lat: loc.lat, lng: loc.lng }}
                    onClick={() => setOpenInfoId(markerId)}
                    icon={loc.celular ? phoneIcon() : vehicleIcon(loc.vehiculoGps)}
                  >
                    {openInfoId === markerId && (
                      <InfoWindow onCloseClick={() => setOpenInfoId(null)}>
                        <div className="text-[13px]">
                          {loc.celular ? (
                            <>
                              <strong>
                                {loc.nombre} {loc.apellido}
                              </strong>
                              <br />
                              Ubicación del celular
                              <br />
                            </>
                          ) : (
                            <>
                              <strong>{loc.vehiculoGps.targa}</strong>
                              <br />
                              {loc.sinChofer ? "Sin servicio ahora" : `Chofer del servicio: ${loc.nombre} ${loc.apellido}`}
                              <br />
                              {loc.vehiculoGps.speed != null ? `${Math.round(loc.vehiculoGps.speed)} ${loc.vehiculoGps.speedUnit ?? ""}` : ""}
                              {loc.vehiculoGps.ignition === false ? `${loc.vehiculoGps.speed != null ? " - " : ""}motor apagado` : ""}
                              {loc.vehiculoGps.speed != null || loc.vehiculoGps.ignition === false ? <br /> : null}
                              {loc.servicioActual?.tramo === "VUELTA" && (
                                <>
                                  Volviendo a la base
                                  <br />
                                </>
                              )}
                              {loc.servicioActual?.varios && (
                                <>
                                  <strong>⚠ Hay más de un servicio de este vehículo a esta hora: revisa en Registros.</strong>
                                  <br />
                                </>
                              )}
                              {loc.sinChofer && isVehicleMoving(loc.vehiculoGps) && (
                                <>
                                  <strong>⚠ En movimiento sin servicio asignado.</strong>
                                  <br />
                                </>
                              )}
                              {loc.distanciaCelularKm != null && (
                                <>
                                  <strong>⚠ El celular del chofer está a {loc.distanciaCelularKm.toFixed(1)} km del vehículo.</strong>
                                  <br />
                                </>
                              )}
                            </>
                          )}
                          {loc.servicio ? (
                            <>
                              {loc.servicio.codigo} - {loc.servicio.destinazione}
                              <br />
                              Actualizado hace {minutesAgo(loc.actualizada)} min
                              <br />
                              {openMarkerEta === undefined ? (
                                "Calculando ETA en vivo..."
                              ) : openMarkerEta ? (
                                <>
                                  <strong>En vivo:</strong> le faltan ~{Math.round(openMarkerEta.duracionMin)} min
                                  ({openMarkerEta.distanciaKm.toFixed(1)} km)
                                </>
                              ) : (
                                "ETA en vivo no disponible"
                              )}
                            </>
                          ) : !loc.celular ? (
                            <>
                              Actualizado hace {minutesAgo(loc.actualizada)} min
                            </>
                          ) : (
                            <>
                              Sin servicio activo - disponible
                              <br />
                              Actualizado hace {minutesAgo(loc.actualizada)} min
                              <br />
                              {openMarkerEta === undefined ? (
                                "Calculando tiempo de regreso..."
                              ) : openMarkerEta ? (
                                <>
                                  <strong>Volviendo a la base:</strong> ~{Math.round(openMarkerEta.duracionMin)}{" "}
                                  min ({openMarkerEta.distanciaKm.toFixed(1)} km)
                                </>
                              ) : (
                                "Tiempo de regreso no disponible"
                              )}
                            </>
                          )}

                          {/* ETA a un destino escrito a mano: cuanto tardaria este
                              vehiculo/chofer si saliera ahora hacia ahi. Colores fijos,
                              sin clases de tema (ink, dark): la burbuja de Google
                              siempre es clara, ver el override de .gm-style-iw en
                              index.css. */}
                          <form
                            onSubmit={submitDestinoSearch}
                            className="mt-2 flex gap-1.5 border-t border-gray-200 pt-2"
                          >
                            <input
                              type="text"
                              value={destinoQuery}
                              onChange={(e) => setDestinoQuery(e.target.value)}
                              placeholder="A donde llegaria (direccion o ciudad)..."
                              className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-[12px] text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                            />
                            <button
                              type="submit"
                              disabled={destinoLoading || !destinoQuery.trim()}
                              className="shrink-0 rounded-md bg-gray-900 px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-40"
                            >
                              ETA
                            </button>
                          </form>
                          {destinoLoading && (
                            <p className="mt-1.5 text-[12px] text-gray-500">Calculando...</p>
                          )}
                          {!destinoLoading && destinoEta === null && (
                            <p className="mt-1.5 text-[12px] text-gray-500">
                              No se pudo calcular la ruta a ese destino.
                            </p>
                          )}
                          {!destinoLoading && destinoEta && (
                            <p className="mt-1.5 text-[12px] text-gray-700">
                              {destinoEta.distanciaKm.toFixed(1)} km - {Math.round(destinoEta.duracionMin)} min -
                              llegaria aprox a las {addMinutes(new Date(), destinoEta.duracionMin)}
                            </p>
                          )}
                        </div>
                      </InfoWindow>
                    )}
                  </Marker>
                );
              })}
            </GoogleMap>
          )}
        </div>
      </div>
    </div>
  );
};
