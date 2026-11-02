import { Capacitor, registerPlugin } from "@capacitor/core";
import { useState } from "react";
import { Alert } from "../ui/Alert";
import { Switch } from "../ui/Switch";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { updateUserRequest } from "../../lib/users.api";

const BackgroundGeolocation = registerPlugin("BackgroundGeolocation");

// Pide el permiso de ubicacion correspondiente a la plataforma. En el APK dispara el
// flujo nativo (y si solo se otorgo "mientras se usa la app", manda a Configuracion
// para elegir "Permitir todo el tiempo"). En el navegador solo existe el permiso
// estandar del sitio, no hay un equivalente a "siempre".
export const requestLocationPermission = () =>
  new Promise((resolve) => {
    if (Capacitor.isNativePlatform()) {
      let watcherId;
      BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "ONE DRIVER Express puede compartir tu ubicacion durante tu horario laboral.",
          backgroundTitle: "Compartir ubicacion",
          requestPermissions: true,
          stale: true,
        },
        (location, error) => {
          if (error) {
            if (error.code === "NOT_AUTHORIZED") {
              BackgroundGeolocation.openSettings();
            }
            resolve();
            return;
          }
          if (watcherId != null) {
            BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {});
          }
          resolve();
        }
      ).then((id) => {
        watcherId = id;
      });
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => resolve(),
        () => resolve(),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      resolve();
    }
  });

// Solo se monta con PHONE_GPS_ENABLED (apagado por defecto, ver lib/features.js).
export const LocationSharingBlock = () => {
  const { user, setUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleToggle = async (checked) => {
    setSaving(true);
    setError("");
    try {
      if (checked) {
        await requestLocationPermission();
      }
      const updated = await updateUserRequest(user.id, { compartirUbicacion: checked });
      setUser(updated);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Alert>{error}</Alert>

      {user?.ubicacionPermisoDenegado && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-danger-500/25 bg-danger-500/10 px-4 py-3 text-[13px] text-danger-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            El permiso de ubicacion no esta en "Permitir todo el tiempo": el GPS deja de
            compartirse apenas apagas la pantalla o salis de la app.
          </span>
          {Capacitor.isNativePlatform() && (
            <button
              type="button"
              onClick={() => BackgroundGeolocation.openSettings()}
              className="shrink-0 rounded-lg border border-danger-500/40 px-3 py-1.5 text-[13px] font-medium hover:bg-danger-500/15"
            >
              Abrir configuracion
            </button>
          )}
        </div>
      )}

      <Switch
        id="compartir-ubicacion"
        label="Compartir ubicacion GPS"
        description="De lunes a sabado de 7:00 a 19:00 tu ubicacion se comparte automaticamente durante un servicio en camino. Fuera de ese horario, activa este switch si te sale un servicio."
        checked={Boolean(user?.compartirUbicacion)}
        disabled={saving}
        onChange={handleToggle}
      />
    </div>
  );
};
