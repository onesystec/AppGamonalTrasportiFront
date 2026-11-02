import { Capacitor, registerPlugin } from "@capacitor/core";
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { PHONE_GPS_ENABLED } from "../lib/features";
import { cancelIdle, scheduleIdle } from "../lib/idle";
import { reportLocationPermissionRequest, updateMyLocationRequest } from "../lib/users.api";

// Solo existe implementacion nativa (Android/iOS); en el navegador normal no se usa.
const BackgroundGeolocation = registerPlugin("BackgroundGeolocation");

const CHECK_INTERVAL_MS = 20000;

// Horario laboral segun contrato: lunes a sabado de 7:00 a 19:00 (hora local).
const isWithinWorkSchedule = () => {
  const now = new Date();
  const day = now.getDay(); // 0=domingo ... 6=sabado
  const hour = now.getHours();
  const isWorkDay = day >= 1 && day <= 6;
  const isWorkHour = hour >= 7 && hour < 19;
  return isWorkDay && isWorkHour;
};

// Comparte la ubicacion del chofer durante todo su horario laboral (lunes a sabado,
// 7:00 a 19:00), o si tiene activado manualmente el switch "Compartir ubicacion GPS"
// de su perfil (para cuando le sale un servicio fuera de horario). No depende de tener
// un servicio "En camino" activo: asi tambien se lo ve en el mapa volviendo de una
// entrega o esperando el proximo pedido, para poder mandarle el mas cercano.
// Dentro del APK (Capacitor) usa el plugin nativo de background geolocation, que sigue
// funcionando con la app minimizada o la pantalla bloqueada (muestra una notificacion
// persistente, obligatoria en Android). En la version web normal solo funciona
// mientras la pestania esta abierta y visible.
export const useLocationSharing = () => {
  const { user, setUser } = useAuth();

  useEffect(() => {
    // GPS del celular apagado (ver lib/features.js): no se pide permiso ni se envia nada.
    if (!PHONE_GPS_ENABLED || user?.cargo !== "CHOFER") return;

    let cancelled = false;
    let watcherId = null;
    // Arranca con lo que ya sabiamos del usuario (por si el permiso quedo denegado en
    // una sesion anterior) y solo reporta al backend/UI cuando el estado realmente
    // cambia, para no mandar el mismo valor en cada tick de 20s.
    let lastReportedDenied = Boolean(user?.ubicacionPermisoDenegado);
    // Ultima posicion nativa conocida (aunque sea vieja): el watcher de mas abajo usa
    // distanceFilter, asi que no dispara si el chofer esta parado repartiendo. El tick
    // de 20s la reenvia igual como heartbeat para que el mapa no lo de por "no
    // disponible" a los 5 min solo por no haberse movido (ver LOCATION_FRESH_MINUTES
    // en el backend). El backend descarta el punto de historial si es el mismo lugar,
    // asi que este heartbeat no ensucia la ruta del dia.
    let lastNativeLocation = null;

    const reportPermission = (denegado) => {
      if (denegado === lastReportedDenied) return;
      lastReportedDenied = denegado;
      setUser((prev) => (prev ? { ...prev, ubicacionPermisoDenegado: denegado } : prev));
      reportLocationPermissionRequest(denegado).catch(() => {});
    };

    const startNativeTracking = async () => {
      if (watcherId != null) return;
      watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage:
            "ONE DRIVER Express esta compartiendo tu ubicacion durante tu horario laboral.",
          backgroundTitle: "Compartiendo ubicacion",
          requestPermissions: true,
          stale: false,
          distanceFilter: 30,
        },
        (location, error) => {
          if (error) {
            // NOT_AUTHORIZED: el permiso de ubicacion no esta en "Permitir todo el
            // tiempo" (o fue revocado). Antes esto se ignoraba en silencio - ahora
            // se avisa en Mi perfil y a OWNER/ADMIN por notificacion.
            if (error.code === "NOT_AUTHORIZED") reportPermission(true);
            return;
          }
          if (!location) return;
          reportPermission(false);
          lastNativeLocation = { lat: location.latitude, lng: location.longitude, accuracy: location.accuracy };
          updateMyLocationRequest(location.latitude, location.longitude, location.accuracy).catch(() => {});
        }
      );
    };

    const stopNativeTracking = () => {
      if (watcherId == null) return;
      BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {});
      watcherId = null;
    };

    const sendLocationOnceWeb = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateMyLocationRequest(
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy
          ).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    const tick = async () => {
      try {
        const canShare = isWithinWorkSchedule() || user?.compartirUbicacion;
        if (cancelled) return;

        if (Capacitor.isNativePlatform()) {
          if (canShare) {
            await startNativeTracking();
            // Heartbeat: el watcher de arriba solo dispara si el chofer se movio
            // distanceFilter metros, asi que si esta quieto reenviamos la ultima
            // posicion conocida para que el mapa lo siga viendo "fresco".
            if (lastNativeLocation) {
              updateMyLocationRequest(
                lastNativeLocation.lat,
                lastNativeLocation.lng,
                lastNativeLocation.accuracy
              ).catch(() => {});
            }
          } else {
            stopNativeTracking();
          }
        } else if (canShare) {
          sendLocationOnceWeb();
        }
      } catch {
        // silencioso: la ubicacion nunca debe romper el resto de la app
      }
    };

    // Primer tick diferido a cuando el navegador este libre: reporta ubicacion via
    // geolocation/API y compite por conexion/CPU con lo que si bloquea el primer
    // pintado (los datos propios del Dashboard del chofer) - no hace falta que sea
    // lo primero en salir.
    const idleId = scheduleIdle(tick);
    const intervalId = setInterval(tick, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      cancelIdle(idleId);
      clearInterval(intervalId);
      stopNativeTracking();
    };
    // user.ubicacionPermisoDenegado y setUser se omiten a proposito: el propio efecto
    // actualiza ese campo via setUser, y si estuviera en las deps se reiniciaria el
    // watcher (recreando el permiso nativo) cada vez que cambia, en vez de una vez
    // por sesion segun cargo/compartirUbicacion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.cargo, user?.compartirUbicacion]);
};
