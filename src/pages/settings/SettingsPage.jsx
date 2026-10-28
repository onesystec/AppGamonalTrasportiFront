import { Capacitor, registerPlugin } from "@capacitor/core";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AppearanceSection } from "../../components/profile/AppearanceSection";
import { GpsRespaldoBlock } from "../../components/profile/GpsRespaldoBlock";
import { LocationSharingBlock } from "../../components/profile/LocationSharingBlock";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { CheckCircleIcon, DownloadIcon, GlobeIcon, MapPinIcon, PaletteIcon, RefreshIcon, ShieldIcon } from "../../components/ui/icons";
import { useAppUpdate } from "../../context/AppUpdateContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n/index.jsx";
import { parseApiError } from "../../lib/api";
import { updateUserRequest } from "../../lib/users.api";
import { PHONE_GPS_ENABLED } from "../../lib/features";

const BackgroundGeolocation = registerPlugin("BackgroundGeolocation");

const Section = ({ id, icon: Icon, title, children }) => (
  <section id={id} className="glass-surface scroll-mt-24 rounded-2xl p-5">
    <h2 className="mb-4 flex items-center gap-2.5 border-b border-line/10 pb-3 text-[15px] font-semibold text-ink-50">
      <Icon className="h-5 w-5 text-ink-300" />
      {title}
    </h2>
    {children}
  </section>
);

const Row = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 py-2 text-[14px]">
    <span className="text-ink-300">{label}</span>
    <span className="min-w-0 truncate text-right font-medium text-ink-50">{value}</span>
  </div>
);

const megabytes = (bytes) => `${(bytes / 1048576).toFixed(1).replace(".", ",")} MB`;

const platformLabel = () => {
  const platform = Capacitor.getPlatform();
  if (platform === "android") return "App de Android";
  if (platform === "ios") return "App de iPhone";
  return "Navegador";
};

// Todo lo que muestra "Actualizar aplicacion": version instalada, si hay una nueva y el boton para instalarla.
const UpdateBlock = () => {
  const { supported, installed, latest, hasUpdate, checking, checked, status, progress, error, check, install, openInstallSettings } =
    useAppUpdate();

  if (!supported) {
    return (
      <p className="rounded-xl bg-line/5 px-4 py-3 text-[13px] text-ink-300">
        {Capacitor.getPlatform() === "ios"
          ? "En iPhone las versiones de prueba se actualizan desde TestFlight."
          : "Estás usando la versión web: siempre es la última, no hay nada que actualizar."}
      </p>
    );
  }

  const percent = progress?.total > 0 ? Math.min(100, Math.round((progress.received / progress.total) * 100)) : null;
  const busy = status === "downloading" || status === "installing";

  return (
    <div className="flex flex-col gap-3">
      <Alert>{error}</Alert>

      {hasUpdate ? (
        <div className="rounded-xl border border-brand/40 bg-brand/10 p-4">
          <p className="text-[14px] font-semibold text-ink-50">
            Versión {latest.versionName} disponible
            <span className="ml-2 text-[12px] font-normal text-ink-300">{latest.size ? megabytes(latest.size) : ""}</span>
          </p>
          {latest.notas && <p className="mt-1 whitespace-pre-line text-[13px] text-ink-200">{latest.notas}</p>}

          {status === "permission" && (
            <div className="mt-3 rounded-lg bg-warning-500/10 px-3 py-2.5 text-[13px] text-warning-500">
              Para instalar la actualización, Android necesita que permitas a Gamonal Driver instalar aplicaciones. Toca «Abrir permiso», activa
              la opción, vuelve a la app y toca «Actualizar ahora» otra vez. Solo se pide una vez.
              <Button variant="ghost" className="mt-2.5" onClick={openInstallSettings}>
                Abrir permiso
              </Button>
            </div>
          )}

          {status === "downloading" && (
            <div className="mt-3">
              <div className="h-2.5 overflow-hidden rounded-full bg-line/15">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${percent ?? 8}%` }} />
              </div>
              <p className="mt-1.5 text-[12px] text-ink-300">
                Descargando{percent != null ? ` ${percent}%` : "…"} {progress?.total ? `(${megabytes(progress.received)} de ${megabytes(progress.total)})` : ""}
              </p>
            </div>
          )}

          {status === "installing" && (
            <p className="mt-3 text-[13px] text-ink-200">Se abrió el instalador de Android: toca «Instalar» (o «Actualizar») para terminar.</p>
          )}

          <Button className="mt-3" onClick={install} loading={status === "downloading"} disabled={busy}>
            <DownloadIcon className="h-4.5 w-4.5" />
            {status === "downloading" ? "Descargando" : status === "installing" ? "Instalando" : "Actualizar ahora"}
          </Button>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl bg-line/5 px-4 py-3 text-[13px] text-ink-200">
          <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-success-500" />
          <span>
            {checked && !latest
              ? "Todavía no hay una versión nueva publicada."
              : checked
                ? `Tienes la última versión${installed ? ` (${installed.versionName})` : ""}.`
                : "Buscando actualizaciones…"}
          </span>
        </div>
      )}

      <Button variant="ghost" onClick={check} loading={checking} disabled={busy}>
        <RefreshIcon className="h-4.5 w-4.5" />
        Buscar actualizaciones
      </Button>
    </div>
  );
};

const IDIOMAS = [
  { value: "es", label: "Español" },
  { value: "it", label: "Italiano" },
];

// Idioma de la app para el personal de la oficina: se ve al instante y se guarda en la cuenta (vale en todos los dispositivos).
const IdiomaBlock = () => {
  const { realUser, setUser } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [error, setError] = useState("");

  const change = async (value) => {
    if (value === language) return;
    const previous = language;
    setError("");
    setLanguage(value);
    try {
      await updateUserRequest(realUser.id, { idioma: value });
      setUser((prev) => (prev ? { ...prev, idioma: value } : prev));
    } catch (err) {
      setLanguage(previous);
      setError(parseApiError(err).message);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Alert>{error}</Alert>
      <SegmentedControl options={IDIOMAS} value={language} onChange={change} className="self-start" />
      <p className="text-[12px] text-ink-400">
        Por ahora solo Disponibilitá está traducida al italiano; el resto de la oficina sigue en español. El idioma se guarda en tu cuenta.
      </p>
    </div>
  );
};

export const SettingsPage = () => {
  const { user, realUser } = useAuth();
  const { installed } = useAppUpdate();
  const location = useLocation();
  const [copied, setCopied] = useState(false);
  // Choferes y tambien Admin/Responsables pueden compartir el celular cuando hacen un servicio.
  const isChofer = ["CHOFER", "ADMIN", "OWNER"].includes(user?.cargo);
  const native = Capacitor.isNativePlatform();

  // /ajustes#actualizar (desde el aviso de version nueva) baja directo a esa seccion.
  useEffect(() => {
    if (!location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);

  const copyDiagnostic = async () => {
    const lines = [
      "Gamonal Driver 2.0 - diagnostico",
      `Version: ${installed ? `${installed.versionName} (${installed.versionCode})` : "web"}`,
      `Plataforma: ${platformLabel()}`,
      `Usuario: ${user?.cargo ?? "-"} ${user?.id ?? ""}`,
      `Servidor: ${import.meta.env.VITE_API_URL ?? "-"}`,
      `Dispositivo: ${navigator.userAgent}`,
      `Pantalla: ${window.innerWidth}x${window.innerHeight}`,
      `Fecha: ${new Date().toISOString()}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copia estos datos:", lines.join("\n"));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-[26px] font-semibold text-ink-50 sm:text-[30px]">Ajustes de la app</h1>
        <p className="mt-1 text-[14px] text-ink-300">Cómo se ve la app, tu ubicación y la versión instalada.</p>
      </div>

      <Section icon={PaletteIcon} title="Apariencia">
        <AppearanceSection />
      </Section>

      {(realUser?.cargo === "OWNER" || realUser?.cargo === "ADMIN") && (
        <Section icon={GlobeIcon} title="Idioma">
          <IdiomaBlock />
        </Section>
      )}

      {isChofer && (
        <Section icon={MapPinIcon} title="Ubicación">
          <div className="flex flex-col gap-4">
            <GpsRespaldoBlock />
            {PHONE_GPS_ENABLED && (
              <div className="border-t border-line/10 pt-4">
                <LocationSharingBlock />
              </div>
            )}
            {native && (
              <div className="border-t border-line/10 pt-4">
                <p className="mb-2 text-[12px] text-ink-400">
                  Si la ubicación no funciona con la pantalla apagada, abre los permisos del celular y elige «Permitir todo el tiempo».
                </p>
                <Button variant="ghost" onClick={() => BackgroundGeolocation.openSettings()}>
                  Abrir permisos de ubicación del celular
                </Button>
              </div>
            )}
          </div>
        </Section>
      )}

      <Section id="actualizar" icon={ShieldIcon} title="Acerca de la app">
        <div className="mb-3 divide-y divide-line/10">
          <Row label="Versión instalada" value={installed ? `${installed.versionName} (${installed.versionCode})` : "Versión web"} />
          <Row label="Instalada como" value={platformLabel()} />
        </div>
        <UpdateBlock />
        <div className={clsx("mt-4 border-t border-line/10 pt-4")}>
          <p className="mb-2 text-[12px] text-ink-400">Si algo falla, copia estos datos y mándaselos a quien te da soporte.</p>
          <Button variant="ghost" onClick={copyDiagnostic}>
            {copied ? "Copiado" : "Copiar datos de diagnóstico"}
          </Button>
        </div>
      </Section>
    </div>
  );
};
