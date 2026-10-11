import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { parseApiError } from "../lib/api";
import { getAndroidUpdateRequest } from "../lib/appUpdate.api";

// Plugin propio de Android (ver ApkInstallerPlugin.java): descarga el APK y abre el instalador.
const ApkInstaller = registerPlugin("ApkInstaller");

const AppUpdateContext = createContext(null);

const CHECK_EVERY_MS = 30 * 60 * 1000;

// Actualizar desde la app solo existe en el APK de Android: en el navegador siempre se ve la ultima version y en iPhone las
// versiones de prueba se actualizan por TestFlight.
export const isAndroidApp = () => Capacitor.getPlatform() === "android";

// Estado de la actualizacion de la app:
//   status: idle | downloading | permission (falta autorizar "instalar apps desconocidas") | installing | error
export const AppUpdateProvider = ({ children }) => {
  const supported = isAndroidApp();
  const [installed, setInstalled] = useState(null);
  const [latest, setLatest] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const lastCheck = useRef(0);
  const installedRef = useRef(null);
  const statusRef = useRef("idle");
  statusRef.current = status;

  // Version instalada: versionName ("1.1") y versionCode (numero que sube en cada APK).
  useEffect(() => {
    if (!supported) return;
    CapacitorApp.getInfo()
      .then((info) => {
        const value = { versionName: info.version, versionCode: Number(info.build) };
        installedRef.current = value;
        setInstalled(value);
      })
      .catch(() => {});
  }, [supported]);

  const check = useCallback(async () => {
    if (!supported) return null;
    setChecking(true);
    setError("");
    try {
      const data = await getAndroidUpdateRequest();
      lastCheck.current = Date.now();
      setLatest(data);
      setChecked(true);
      return data;
    } catch (err) {
      setError(parseApiError(err).message);
      return null;
    } finally {
      setChecking(false);
    }
  }, [supported]);

  // Al abrir la app y al volver a ella (si pasaron 30 minutos desde la ultima vez). Es una sola consulta liviana.
  useEffect(() => {
    if (!supported) return undefined;
    check();
    const handle = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) return;
      // Si el usuario cancelo el instalador de Android, la app vuelve con el estado "installing": se limpia.
      if (statusRef.current === "installing") setStatus("idle");
      if (Date.now() - lastCheck.current > CHECK_EVERY_MS) check();
    });
    return () => {
      handle.then((h) => h.remove()).catch(() => {});
    };
  }, [supported, check]);

  const hasUpdate = Boolean(latest && installed && latest.versionCode > installed.versionCode);

  const install = useCallback(async () => {
    if (!supported || statusRef.current === "downloading") return;
    setError("");
    setProgress(null);
    setStatus("downloading");
    let listener = null;
    try {
      // La URL de descarga caduca: se pide una fresca justo antes de bajar.
      const fresh = await getAndroidUpdateRequest();
      setLatest(fresh);
      const current = installedRef.current;
      if (!fresh || (current && fresh.versionCode <= current.versionCode)) {
        setStatus("idle");
        return;
      }
      const { allowed } = await ApkInstaller.canInstall();
      if (!allowed) {
        setStatus("permission");
        return;
      }
      listener = await ApkInstaller.addListener("progress", (p) => setProgress(p));
      await ApkInstaller.downloadAndInstall({ url: fresh.url, sha256: fresh.sha256 });
      setStatus("installing");
    } catch (err) {
      if (err?.message === "NOT_ALLOWED") {
        setStatus("permission");
      } else {
        setError(err?.response ? parseApiError(err).message : (err?.message ?? "No se pudo actualizar."));
        setStatus("error");
      }
    } finally {
      listener?.remove();
    }
  }, [supported]);

  const openInstallSettings = useCallback(() => ApkInstaller.openInstallSettings().catch(() => {}), []);

  const value = useMemo(
    () => ({ supported, installed, latest, hasUpdate, checking, checked, status, progress, error, check, install, openInstallSettings }),
    [supported, installed, latest, hasUpdate, checking, checked, status, progress, error, check, install, openInstallSettings]
  );

  return <AppUpdateContext.Provider value={value}>{children}</AppUpdateContext.Provider>;
};

export const useAppUpdate = () => {
  const ctx = useContext(AppUpdateContext);
  if (!ctx) throw new Error("useAppUpdate debe usarse dentro de un AppUpdateProvider");
  return ctx;
};
