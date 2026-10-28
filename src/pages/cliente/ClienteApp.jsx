import clsx from "clsx";
import { lazy, Suspense } from "react";
import { NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import logo from "../../assets/logo.webp";
import { PageLoader } from "../../components/ui/PageLoader";
import { CalendarIcon, ClipboardListIcon, FileTextIcon, MapPinIcon, MoonIcon, RouteIcon, SunIcon } from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useT } from "../../i18n/index.jsx";
import { isEmbedded } from "../../lib/embedded";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { AREA_LABEL_BY_KEY } from "../../lib/roles";

const ClienteSeguimientoPage = lazy(() => import("./ClienteSeguimientoPage").then((m) => ({ default: m.ClienteSeguimientoPage })));
const ClienteHistorialPage = lazy(() => import("./ClienteHistorialPage").then((m) => ({ default: m.ClienteHistorialPage })));
const ClienteRegistroPage = lazy(() => import("./ClienteRegistroPage").then((m) => ({ default: m.ClienteRegistroPage })));

const ClienteDisponibilidadPage = lazy(() => import("./ClienteDisponibilidadPage").then((m) => ({ default: m.ClienteDisponibilidadPage })));
const ClienteEnVivoPage = lazy(() => import("./ClienteEnVivoPage").then((m) => ({ default: m.ClienteEnVivoPage })));

const itemClass = ({ isActive }) =>
  clsx(
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors",
    isActive ? "bg-line/15 text-ink-50" : "text-ink-300 hover:bg-line/10 hover:text-ink-50"
  );

const mobileTabClass = ({ isActive }) =>
  clsx(
    "shrink-0 rounded-full px-4 py-2 text-[14px] font-medium transition-colors",
    isActive ? "bg-line/15 text-ink-50" : "text-ink-300 hover:text-ink-50"
  );

// Vistas del usuario cliente segun las casillas que le activo el Admin: el mapa (En vivo y Seguimiento), el historial y el registro.
// "label" es la clave del texto (i18n).
const buildNav = (modulos) => {
  const verSeguimiento = modulos.includes("MAPA") || modulos.includes("LISTA");
  const mapa = [
    ...(modulos.includes("EN_VIVO") ? [{ to: "/cliente/en-vivo", label: "nav.live", icon: MapPinIcon }] : []),
    ...(verSeguimiento ? [{ to: "/cliente", label: "nav.tracking", icon: RouteIcon, end: true }] : []),
  ];
  const otras = [
    ...(modulos.includes("DISPONIBILIDAD") ? [{ to: "/cliente/disponibilidad", label: "nav.availability", icon: CalendarIcon }] : []),
    ...(modulos.includes("HISTORIAL") ? [{ to: "/cliente/historial", label: "nav.history", icon: FileTextIcon }] : []),
    ...(modulos.includes("REGISTRO") ? [{ to: "/cliente/registro", label: "nav.register", icon: ClipboardListIcon }] : []),
  ];
  return { mapa, otras };
};

// Estructura de la vista de un usuario cliente: barra de navegacion a la izquierda (arriba, en el celular) con sus vistas, y a la derecha la
// vista elegida. Solo su empresa, sus servicios y lo que el Admin le activo; sin el menu de chofer ni de oficina.
const ClienteShell = () => {
  const t = useT();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  usePushNotifications();

  const modulos = user?.clienteModulos ?? [];
  // Cabecera: el logo de su empresa y su nombre. El nombre es el de la empresa cliente o, si no tiene, el del propio usuario; debajo, las
  // spedizioni que sigue o la persona.
  const nombrePersona = `${user?.nombre ?? ""} ${user?.apellido ?? ""}`.trim();
  const spedizioni = (user?.clienteAreas ?? []).map((key) => AREA_LABEL_BY_KEY[key] ?? key).join(" · ");
  const titulo = user?.cliente?.nombre ?? nombrePersona;
  const subtitulo = user?.cliente?.nombre ? nombrePersona : spedizioni;
  const { mapa, otras } = buildNav(modulos);
  const todas = [...mapa, ...otras];
  const ThemeIcon = theme === "dark" ? SunIcon : MoonIcon;

  const marca = (
    <div className="flex items-center gap-3">
      {user?.imagenUrl ? (
        <img src={user.imagenUrl} alt={titulo} className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain p-1" />
      ) : (
        <img src={logo} alt="" className="h-10 w-10 shrink-0 rounded-full" />
      )}
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold text-ink-50">{titulo || "Gamonal Driver"}</span>
        {subtitulo && <span className="block truncate text-[12px] text-ink-400">{subtitulo}</span>}
      </div>
    </div>
  );

  const acciones = (
    <>
      {/* Dentro de OneSystec el tema se elige alli. */}
      {!isEmbedded && (
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? t("nav.themeLight") : t("nav.themeDark")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-300 hover:bg-line/10 hover:text-ink-50"
        >
          <ThemeIcon className="h-[18px] w-[18px]" />
        </button>
      )}
      {/* Dentro de OneSystec la sesion se cierra desde OneSystec, no desde aqui. */}
      {!isEmbedded && (
        <button type="button" onClick={logout} className="rounded-full px-3 py-2 text-[13px] font-medium text-ink-300 hover:bg-line/10 hover:text-ink-50">
          {t("nav.signOut")}
        </button>
      )}
    </>
  );

  return (
    <div className="min-h-dvh bg-background lg:flex">
      {/* Escritorio: barra lateral fija. */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-5 border-r border-line/10 bg-background px-3 py-4 lg:flex">
        <div className="px-1">{marca}</div>
        <nav aria-label={t("nav.views")} className="flex flex-1 flex-col gap-4 overflow-y-auto">
          {mapa.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{t("nav.groupMap")}</span>
              {mapa.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={itemClass}>
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {t(label)}
                </NavLink>
              ))}
            </div>
          )}
          {otras.length > 0 && (
            <div className="flex flex-col gap-1">
              {mapa.length > 0 && <span className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{t("nav.groupServices")}</span>}
              {otras.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className={itemClass}>
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {t(label)}
                </NavLink>
              ))}
            </div>
          )}
        </nav>
        <div className="flex items-center justify-between border-t border-line/10 pt-3">{acciones}</div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Celular: cabecera con las vistas en una fila. */}
        <header className="sticky top-0 z-30 border-b border-line/10 bg-background/95 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3 px-4 pb-1 pt-3">
            <div className="min-w-0 flex-1">{marca}</div>
            {acciones}
          </div>
          {todas.length > 0 && (
            <nav aria-label={t("nav.views")} className="flex gap-1 overflow-x-auto px-3 pb-2">
              {todas.map(({ to, label, end }) => (
                <NavLink key={to} to={to} end={end} className={mobileTabClass}>
                  {t(label)}
                </NavLink>
              ))}
            </nav>
          )}
        </header>
        <main className="w-full px-4 py-4 lg:px-6">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

// Pantalla de inicio segun lo que tenga activo: seguimiento primero; si no, el mapa en vivo, el historial o el registro; si no, un aviso.
const ClienteInicio = () => {
  const t = useT();
  const { user } = useAuth();
  const modulos = user?.clienteModulos ?? [];
  if (modulos.includes("MAPA") || modulos.includes("LISTA")) return <ClienteSeguimientoPage />;
  if (modulos.includes("EN_VIVO")) return <Navigate to="/cliente/en-vivo" replace />;
  if (modulos.includes("DISPONIBILIDAD")) return <Navigate to="/cliente/disponibilidad" replace />;
  if (modulos.includes("HISTORIAL")) return <Navigate to="/cliente/historial" replace />;
  if (modulos.includes("REGISTRO")) return <Navigate to="/cliente/registro" replace />;
  return (
    <p className="px-1 py-10 text-center text-[14px] text-ink-300">
      {t("nav.noSections")}
    </p>
  );
};

export const ClienteApp = () => (
  <Routes>
    <Route element={<ClienteShell />}>
      <Route path="/cliente" element={<ClienteInicio />} />
      <Route path="/cliente/en-vivo" element={<ClienteEnVivoPage />} />
      <Route path="/cliente/disponibilidad" element={<ClienteDisponibilidadPage />} />
      <Route path="/cliente/historial" element={<ClienteHistorialPage />} />
      <Route path="/cliente/registro" element={<ClienteRegistroPage />} />
      <Route path="*" element={<Navigate to="/cliente" replace />} />
    </Route>
  </Routes>
);
