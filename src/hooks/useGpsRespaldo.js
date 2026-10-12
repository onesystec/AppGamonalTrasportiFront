import { Capacitor, registerPlugin } from "@capacitor/core";
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getMyGpsRespaldoRequest, sendGpsRespaldoLocationRequest } from "../lib/gps.api";

const BackgroundGeolocation = registerPlugin("BackgroundGeolocation");

const CHECK_INTERVAL_MS = 60 * 1000;

// GPS de respaldo del celular. Solo hace algo si el chofer lo autorizo (Mi perfil). La app le pregunta al
// servidor cada minuto si tiene que enviar: el servidor responde que si unicamente cuando el GPS del
// vehiculo esta bloqueado o caido Y el chofer tiene un servicio en curso. Mientras no, no se lee ni se
// envia ninguna ubicacion. En cada punto el servidor vuelve a comprobarlo: si ya no corresponde, la app
// se detiene sola. En el APK sigue con la pantalla apagada; en el navegador solo con la pestania abierta.
export const useGpsRespaldo = () => {
  const { user } = useAuth();
  const permitido = ["CHOFER", "ADMIN", "OWNER"].includes(user?.cargo) && Boolean(user?.gpsRespaldoPermitido);

  useEffect(() => {
    if (!permitido) return undefined;

    let cancelled = false;
    let active = false;
    let watcherId = null;
    let lastLocation = null;

    const stopNative = () => {
      if (watcherId == null) return;
      BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {});
      watcherId = null;
    };

    const deactivate = () => {
      active = false;
      lastLocation = null;
      stopNative();
    };

    const send = (lat, lng, accuracy) => {
      sendGpsRespaldoLocationRequest(lat, lng, accuracy)
        .then((result) => {
          if (!cancelled && result && result.activo === false) deactivate();
        })
        .catch(() => {});
    };

    const startNative = async () => {
      if (watcherId != null) return;
      watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "El GPS del vehiculo no responde: Gamonal Driver 2.0 registra tu recorrido durante tu servicio.",
          backgroundTitle: "GPS de respaldo activo",
          requestPermissions: true,
          stale: false,
          distanceFilter: 20,
        },
        (location, error) => {
          if (error || !location || cancelled) return;
          lastLocation = { lat: location.latitude, lng: location.longitude, accuracy: location.accuracy };
          send(lastLocation.lat, lastLocation.lng, lastLocation.accuracy);
        }
      );
    };

    const sendOnceWeb = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (p) => send(p.coords.latitude, p.coords.longitude, p.coords.accuracy),
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    const tick = async () => {
      try {
        const status = await getMyGpsRespaldoRequest();
        if (cancelled) return;
        if (!status.activo) {
          if (active) deactivate();
          return;
        }
        active = true;
        if (Capacitor.isNativePlatform()) {
          await startNative();
          // El watcher solo avisa si el chofer se mueve: parado, se reenvia el ultimo punto para medir el tiempo.
          if (lastLocation) send(lastLocation.lat, lastLocation.lng, lastLocation.accuracy);
        } else {
          sendOnceWeb();
        }
      } catch {
        // silencioso: el respaldo nunca debe romper el resto de la app
      }
    };

    tick();
    const intervalId = setInterval(tick, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
      deactivate();
    };
  }, [permitido]);
};
