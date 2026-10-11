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
import { EN_PROCESO_STATUSES, VEHICLE_AREA_OPTIONS } from "../../lib/constants";
import { computeLocationPermissionAlerts, filterToPiazzaYDhlRoma } from "../../lib/dashboardStats";
import { PHONE_GPS_ENABLED } from "../../lib/features";
import { addMinutes } from "../../lib/format";
import MILANO_ZONES from "../../lib/geo/milanoZones.json";
import { HIDE_POI_STYLES, NIGHT_MODE_STYLES } from "../../lib/mapStyles";
import { startVisibleInterval } from "../../lib/polling";
import { PEAJE_COLOR_CERCA } from "../../lib/peajes";
import { PeajesLayer } from "../../components/mapa/PeajesLayer";
import { getRecordLiveEtaRequest, listPendingRecordsRequest } from "../../lib/records.api";
import { getEtaToDestinationRequest, listVehicleLivePositionsRequest, listVehiclesRequest } from "../../lib/vehicles.api";
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
            {item.driver ?? (sinUbicacion ? item.modelo ?? "Sin chofer asignado" : "Sin chofer asignado")}
          </span>
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

  // Vehiculo asignado (targa) de cada chofer, para cruzar con vehiclePositions -
  // viene de allDrivers (lista completa), no de "locations", que no trae ese dato.
  const driverVehicleTarga = useMemo(() => {
    const map = new Map();
    (allDrivers ?? []).forEach((d) => {
      if (d.vehiculoAsignado?.targa) map.set(d.id, d.vehiculoAsignado.targa);
    });
    return map;
  }, [allDrivers]);

  const vehiclePositionByTarga = useMemo(() => {
    const map = new Map();
    (vehiclePositions ?? []).forEach((p) => map.set(normalizeTarga(p.targa), p));
    return map;
  }, [vehiclePositions]);

  // Reemplaza la posicion del celular del chofer por la del GPS de su vehiculo
  // asignado (Velocity Fleet) cuando esa unidad lo tiene instalado - pedido
  // explicito: mas preciso, viene del vehiculo y no del telefono. Los vehiculos sin
  // ese GPS (no todos lo tienen todavia) siguen mostrando la ubicacion del celular,
  // sin excepcion - nunca se cae el pin por no tener el dispositivo instalado.
  //
  // Ademas: un vehiculo con GPS de Velocity Fleet tiene que aparecer aunque el
  // celular del chofer NO este compartiendo ubicacion en este momento (celular
  // apagado, permiso denegado, o simplemente todavia no arranco a compartir) - sin
  // esto, un vehiculo con GPS real quedaba sin pin solo porque no habia una entrada
  // de "locations" (celular) previa a la cual reemplazarle la posicion.
  const enrichedLocations = useMemo(() => {
    if (!locations) return locations;

    const driverIdsWithPhoneLocation = new Set(locations.map((loc) => loc.id));
    // Targas ya usadas (por un chofer con celular o sin el, mas abajo) - lo que quede
    // sin marcar al final son vehiculos con GPS que hoy no tienen a nadie asignado,
    // y aun asi tienen que verse: el pedido es ver los vehiculos, no solo los que
    // tienen chofer puesto en este momento.
    const usedTargas = new Set();

    const merged = locations.map((loc) => {
      const targa = driverVehicleTarga.get(loc.id);
      const normTarga = targa ? normalizeTarga(targa) : null;
      const vehiclePosition = normTarga ? vehiclePositionByTarga.get(normTarga) : undefined;
      if (!vehiclePosition) return loc;
      usedTargas.add(normTarga);
      return {
        ...loc,
        lat: vehiclePosition.lat,
        lng: vehiclePosition.lng,
        actualizada: vehiclePosition.updatedAt ?? loc.actualizada,
        vehiculoGps: {
          targa,
          speed: vehiclePosition.speed,
          speedUnit: vehiclePosition.speedUnit,
          ignition: vehiclePosition.ignition,
          direction: vehiclePosition.direction,
        },
      };
    });

    (allDrivers ?? []).forEach((d) => {
      if (driverIdsWithPhoneLocation.has(d.id)) return; // ya cubierto arriba
      const targa = d.vehiculoAsignado?.targa;
      const normTarga = targa ? normalizeTarga(targa) : null;
      if (!normTarga || usedTargas.has(normTarga)) return;
      const vehiclePosition = vehiclePositionByTarga.get(normTarga);
      if (!vehiclePosition) return;
      usedTargas.add(normTarga);

      // El servicio activo del chofer (si tiene) no viene con el GPS del vehiculo -
      // se busca en "records" para que el pin/lista se comporten igual que uno con
      // ubicacion de celular (icono, aparecer en Pendientes, etc.).
      const servicio =
        (records ?? []).find((r) => r.driver?.id === d.id && EN_PROCESO_STATUSES.includes(r.estado)) ?? null;

      merged.push({
        id: d.id,
        nombre: d.nombre,
        apellido: d.apellido,
        lat: vehiclePosition.lat,
        lng: vehiclePosition.lng,
        actualizada: vehiclePosition.updatedAt,
        servicio,
        vehiculoGps: {
          targa,
          speed: vehiclePosition.speed,
          speedUnit: vehiclePosition.speedUnit,
          ignition: vehiclePosition.ignition,
          direction: vehiclePosition.direction,
        },
      });
    });

    // Vehiculos con GPS que no tienen chofer asignado ahora mismo (o cuyo chofer
    // asignado no matcheo arriba por algun motivo) - se muestran igual, solo con la
    // targa como "nombre" (no hay chofer que mostrar).
    (vehiclePositions ?? []).forEach((vp) => {
      const normTarga = normalizeTarga(vp.targa);
      if (usedTargas.has(normTarga)) return;
      usedTargas.add(normTarga);

      merged.push({
        id: `vehiculo-${normTarga}`,
        nombre: vp.targa,
        apellido: "",
        lat: vp.lat,
        lng: vp.lng,
        actualizada: vp.updatedAt,
        servicio: null,
        vehiculoGps: {
          targa: vp.targa,
          speed: vp.speed,
          speedUnit: vp.speedUnit,
          ignition: vp.ignition,
          direction: vp.direction,
        },
        sinChofer: true,
      });
    });

    return merged;
  }, [locations, allDrivers, records, vehiclePositions, driverVehicleTarga, vehiclePositionByTarga]);

  // Una fila por vehiculo en la lista lateral: toda la flota (fichas de Vehiculos). Los que tienen GPS salen
  // con su estado y se pueden ubicar en el mapa; los que no, al final y marcados "GPS desactivado". Sin GPS
  // ni ficha del celular, no hay pin. Los vehiculos que reportan pero no tienen ficha caen en "Sin asignar".
  const vehicleItems = useMemo(() => {
    const fleetByTarga = new Map((fleet ?? []).map((v) => [normalizeTarga(v.targa), v]));
    const unique = new Map();
    (enrichedLocations ?? []).forEach((loc) => {
      const key = loc.vehiculoGps?.targa ? normalizeTarga(loc.vehiculoGps.targa) : `driver-${loc.id}`;
      if (!unique.has(key)) unique.set(key, loc);
    });

    const withLocation = [...unique.values()].map((loc) => {
      const targa = loc.vehiculoGps?.targa ?? driverVehicleTarga.get(loc.id) ?? null;
      const ficha = targa ? fleetByTarga.get(normalizeTarga(targa)) : undefined;
      const minutos = loc.vehiculoGps && loc.actualizada ? minutesAgo(loc.actualizada) : null;
      const sinSenal = minutos != null && minutos >= GPS_SIN_SENAL_MIN;
      return {
        loc,
        status: locStatus(loc),
        targa,
        driver: loc.sinChofer
          ? ficha?.conductores?.length
            ? ficha.conductores.map((c) => c.nombre).join(", ")
            : null
          : `${loc.nombre} ${loc.apellido}`.trim(),
        area: ficha?.area ?? "SIN_ASIGNAR",
        modelo: ficha?.modelo ?? null,
        sinSenalMin: sinSenal ? minutos : null,
      };
    });

    const represented = new Set(withLocation.filter((i) => i.targa).map((i) => normalizeTarga(i.targa)));
    const withoutGps = (fleet ?? [])
      .filter((v) => !represented.has(normalizeTarga(v.targa)))
      .map((v) => ({
        loc: null,
        status: "noGps",
        targa: v.targa,
        driver: v.conductores?.length ? v.conductores.map((c) => c.nombre).join(", ") : null,
        area: v.area,
        modelo: v.modelo,
        sinSenalMin: null,
      }));

    return [...withLocation, ...withoutGps].sort(
      (a, b) =>
        (a.loc ? 0 : 1) - (b.loc ? 0 : 1) ||
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (a.targa ?? "~").localeCompare(b.targa ?? "~", "es")
    );
  }, [enrichedLocations, driverVehicleTarga, fleet]);

  // Pestanias por area: "General" (todos) + cada area con vehiculos ("Sin asignar" solo si hay).
  const areaTabs = useMemo(() => {
    const counts = new Map();
    vehicleItems.forEach((i) => counts.set(i.area, (counts.get(i.area) ?? 0) + 1));
    return [
      { key: "todos", label: "General", count: vehicleItems.length },
      ...VEHICLE_AREA_OPTIONS.filter((o) => o.value !== "SIN_ASIGNAR" || counts.has("SIN_ASIGNAR")).map((o) => ({
        key: o.value,
        label: o.label,
        count: counts.get(o.value) ?? 0,
      })),
    ];
  }, [vehicleItems]);

  const itemsInArea = useMemo(
    () => (areaFilter === "todos" ? vehicleItems : vehicleItems.filter((i) => i.area === areaFilter)),
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
    const markerId = loc.servicio?.id ?? `idle-${loc.id}`;
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

  // ETA del marcador que tiene el InfoWindow abierto en el mapa (puede
  // ser un servicio en camino o un chofer libre volviendo a la base) - solo se pide
  // mientras ese InfoWindow sigue abierto. undefined = todavia no llego la primera
  // respuesta ("Calculando..."), null = ya se pidio pero no hay ETA disponible.
  useEffect(() => {
    if (!openInfoId || openInfoId === "destination") {
      setOpenMarkerEta(undefined);
      return;
    }

    const isIdleDriver = openInfoId.startsWith("idle-");
    // Un vehiculo sin chofer asignado (ver sinChofer/vehiculoPositions mas arriba) usa
    // "vehiculo-{targa}" como id, no un id de usuario real - no hay "chofer volviendo a
    // la base" que calcular ahi. Antes esto igual disparaba getDriverReturnEtaRequest
    // con ese id sintetico, que el backend rechazaba con 400 cada vez que se abria ese
    // InfoWindow.
    if (isIdleDriver && openInfoId.slice("idle-".length).startsWith("vehiculo-")) {
      setOpenMarkerEta(null);
      return;
    }

    setOpenMarkerEta(undefined);
    let cancelled = false;
    const fetchEta = () => {
      const request = isIdleDriver
        ? getDriverReturnEtaRequest(openInfoId.slice("idle-".length))
        : getRecordLiveEtaRequest(openInfoId);
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
  }, [openInfoId]);

  // Vehiculo/chofer del marcador que tiene el InfoWindow abierto ahora mismo (o
  // undefined si no hay ninguno abierto) - se usa para el formulario de "ETA a un
  // destino" que se muestra adentro del InfoWindow.
  const openLoc = useMemo(
    () => enrichedLocations?.find((loc) => (loc.servicio?.id ?? `idle-${loc.id}`) === openInfoId),
    [enrichedLocations, openInfoId]
  );

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
          <p className="mt-1 text-[14px] text-ink-300">
            {PHONE_GPS_ENABLED ? "Choferes y vehículos con ubicación en vivo." : "Vehículos con ubicación en vivo (GPS del vehículo)."}
          </p>
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
                      active={!!item.loc && openInfoId === (item.loc.servicio?.id ?? `idle-${item.loc.id}`)}
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
        <div className="h-[calc(100dvh-17rem)] min-h-[480px] w-full lg:h-[calc(100dvh-14rem)]">
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
                  const markerId = loc.servicio?.id ?? `idle-${loc.id}`;
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

              {enrichedLocations?.map((loc) => {
                // key/estado por loc.servicio.id cuando hay servicio (un mismo chofer
                // puede tener varias entradas si tiene mas de un servicio "en camino"
                // a la vez, viajes compactados, todas con el mismo loc.id); si esta
                // libre (sin servicio) usa loc.id, que ahi si es unico por chofer.
                const markerId = loc.servicio?.id ?? `idle-${loc.id}`;
                return (
                  <Marker
                    key={markerId}
                    position={{ lat: loc.lat, lng: loc.lng }}
                    onClick={() => setOpenInfoId(markerId)}
                    icon={
                      loc.vehiculoGps
                        ? vehicleIcon(loc.vehiculoGps)
                        : loc.servicio
                          ? undefined
                          : {
                              path: window.google.maps.SymbolPath.CIRCLE,
                              scale: 8,
                              fillColor: IDLE_DRIVER_COLOR,
                              fillOpacity: 0.9,
                              strokeColor: "#ffffff",
                              strokeWeight: 2,
                            }
                    }
                  >
                    {openInfoId === markerId && (
                      <InfoWindow onCloseClick={() => setOpenInfoId(null)}>
                        <div className="text-[13px]">
                          <strong>
                            {loc.nombre} {loc.apellido}
                          </strong>
                          <br />
                          {loc.vehiculoGps && (
                            <>
                              GPS del vehiculo {loc.vehiculoGps.targa}
                              {loc.vehiculoGps.speed != null
                                ? ` - ${Math.round(loc.vehiculoGps.speed)} ${loc.vehiculoGps.speedUnit ?? ""}`
                                : ""}
                              {loc.vehiculoGps.ignition === false ? " (motor apagado)" : ""}
                              <br />
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
                          ) : loc.sinChofer ? (
                            <>
                              Sin chofer asignado
                              <br />
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
