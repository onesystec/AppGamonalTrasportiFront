import clsx from "clsx";
import { lazy, Suspense } from "react";
import { NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import logo from "../../assets/logo.webp";
import { PageLoader } from "../../components/ui/PageLoader";
import { MoonIcon, SunIcon } from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { AREA_LABEL_BY_KEY } from "../../lib/roles";

const ClienteSeguimientoPage = lazy(() => import("./ClienteSeguimientoPage").then((m) => ({ default: m.ClienteSeguimientoPage })));
const ClienteHistorialPage = lazy(() => import("./ClienteHistorialPage").then((m) => ({ default: m.ClienteHistorialPage })));

const tabClass = ({ isActive }) =>
  clsx(
    "rounded-full px-4 py-2 text-[14px] font-medium transition-colors",
    isActive ? "bg-line/15 text-ink-50" : "text-ink-300 hover:text-ink-50"
  );

// Estructura de la vista de un usuario cliente: solo su empresa, sus servicios y lo que el Admin le activo. Sin el menu de chofer
// ni de oficina.
const ClienteShell = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  usePushNotifications();

  const modulos = user?.clienteModulos ?? [];
  // Titulo de la cabecera: su empresa o, si solo tiene spedizioni, sus nombres.
  const titulo = user?.cliente?.nombre ?? (user?.clienteAreas ?? []).map((key) => AREA_LABEL_BY_KEY[key] ?? key).join(" · ");
  const verSeguimiento = modulos.includes("MAPA") || modulos.includes("LISTA");
  const verHistorial = modulos.includes("HISTORIAL");
  const ThemeIcon = theme === "dark" ? SunIcon : MoonIcon;

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-line/10 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <img src={logo} alt="" className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 basis-40">
            <span className="block truncate text-[15px] font-semibold text-ink-50">{titulo || "Gamonal Driver"}</span>
            <span className="block truncate text-[12px] text-ink-400">
              {user?.nombre} {user?.apellido}
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {verSeguimiento && (
              <NavLink to="/cliente" end className={tabClass}>
                Seguimiento
              </NavLink>
            )}
            {verHistorial && (
              <NavLink to="/cliente/historial" className={tabClass}>
                Historial
              </NavLink>
            )}
          </nav>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-300 hover:bg-line/10 hover:text-ink-50"
          >
            <ThemeIcon className="h-[18px] w-[18px]" />
          </button>
          <button type="button" onClick={logout} className="rounded-full px-3 py-2 text-[13px] font-medium text-ink-300 hover:bg-line/10 hover:text-ink-50">
            Cerrar sesion
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
};

// Pantalla de inicio segun lo que tenga activo: seguimiento primero; si no, el historial; si no, un aviso.
const ClienteInicio = () => {
  const { user } = useAuth();
  const modulos = user?.clienteModulos ?? [];
  if (modulos.includes("MAPA") || modulos.includes("LISTA")) return <ClienteSeguimientoPage />;
  if (modulos.includes("HISTORIAL")) return <Navigate to="/cliente/historial" replace />;
  return (
    <p className="px-1 py-10 text-center text-[14px] text-ink-300">
      Tu usuario todavia no tiene secciones activadas. Pidele a Gamonal Trasporti que te las active.
    </p>
  );
};

export const ClienteApp = () => (
  <Routes>
    <Route element={<ClienteShell />}>
      <Route path="/cliente" element={<ClienteInicio />} />
      <Route path="/cliente/historial" element={<ClienteHistorialPage />} />
      <Route path="*" element={<Navigate to="/cliente" replace />} />
    </Route>
  </Routes>
);
