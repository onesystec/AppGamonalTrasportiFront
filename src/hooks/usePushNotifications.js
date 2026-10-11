import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { registerPushTokenRequest, unregisterPushTokenRequest } from "../lib/users.api";

// Notificaciones push (Area C sin autorizacion, exceso de velocidad - ver
// pushNotification.service.js en el backend) al celular via Firebase Cloud Messaging.
// Solo tiene efecto dentro del APK (Capacitor); en la version web normal
// Capacitor.isNativePlatform() es false y no hace nada. El token del dispositivo se
// registra al iniciar sesion y se da de baja al cerrar sesion, para no seguir
// mandando avisos de este celular a la cuenta anterior.
export const usePushNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let registeredToken = null;

    const onRegistration = (token) => {
      if (cancelled) return;
      registeredToken = token.value;
      registerPushTokenRequest(token.value, Capacitor.getPlatform()).catch(() => {});
    };
    // Al tocar la notificacion (app cerrada, en segundo plano o abierta), la lleva directo a su pantalla:
    // Area C en Finanzas, el seguimiento del servicio, etc.; si no sabe cual, al Mapa.
    const onTap = (action) => {
      const type = action?.notification?.data?.type;
      if (type === "gps-respaldo") navigate("/");
      else if (type === "area-c") navigate("/finanzas/area-c");
      else if (type === "speeding") navigate("/");
      else if (type === "gps") navigate("/finanzas/paradas");
      else if (type === "permiso") navigate(user?.cargo === "CHOFER" ? "/calendario" : "/permisos");
      else if (type === "seguimiento") {
        const recordId = action?.notification?.data?.recordId;
        navigate(user?.cargo === "CHOFER" ? "/" : `/mapa/seguimiento${recordId ? `?servicio=${recordId}` : ""}`);
      } else if (type === "multa") navigate("/finanzas/multas");
      else if (type === "horas") navigate(user?.cargo === "CHOFER" ? "/mis-horas" : "/finanzas/horas");
      else navigate("/mapa");
    };

    PushNotifications.addListener("registration", onRegistration);
    PushNotifications.addListener("registrationError", () => {});
    PushNotifications.addListener("pushNotificationActionPerformed", onTap);

    (async () => {
      try {
        const { receive } = await PushNotifications.checkPermissions();
        let permission = receive;
        if (permission === "prompt" || permission === "prompt-with-rationale") {
          const result = await PushNotifications.requestPermissions();
          permission = result.receive;
        }
        if (permission === "granted" && !cancelled) {
          await PushNotifications.register();
        }
      } catch {
        // silencioso: si el registro nativo falla, la app sigue andando igual, solo
        // sin avisos push (misma campanita web de siempre)
      }
    })();

    return () => {
      cancelled = true;
      PushNotifications.removeAllListeners();
      if (registeredToken) unregisterPushTokenRequest(registeredToken).catch(() => {});
    };
    // navigate se omite a proposito: react-router-dom mantiene la misma referencia
    // entre renders, y solo nos interesa re-ejecutar esto cuando cambia el usuario
    // logueado (login/logout), no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
};
