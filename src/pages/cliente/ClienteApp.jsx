import clsx from "clsx";
import { lazy, Suspense, useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import logo from "../../assets/logo.webp";
import { PageLoader } from "../../components/ui/PageLoader";
import { BarsIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ClipboardListIcon, CloseIcon, FileTextIcon, MapPinIcon, MoonIcon, RouteIcon, SunIcon } from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useT } from "../../i18n/index.jsx";
import { isEmbedded } from "../../lib/embedded";
import { OneSystecMark } from "../../components/ui/OneSystecMark";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { haEntrado, marcarEntrado } from "../../lib/entrada";
import { AREA_LABEL_BY_KEY } from "../../lib/roles";

const ClienteSeguimientoPage = lazy(() => import("./ClienteSeguimientoPage").then((m) => ({ default: m.ClienteSeguimientoPage })));
const ClienteHistorialPage = lazy(() => import("./ClienteHistorialPage").then((m) => ({ default: m.ClienteHistorialPage })));
const ClienteDashboardPage = lazy(() => import("./ClienteDashboardPage").then((m) => ({ default: m.ClienteDashboardPage })));
const ClienteRegistroPage = lazy(() => import("./ClienteRegistroPage").then((m) => ({ default: m.ClienteRegistroPage })));

const ClienteDisponibilidadPage = lazy(() => import("./ClienteDisponibilidadPage").then((m) => ({ default: m.ClienteDisponibilidadPage })));
const ClienteEnVivoPage = lazy(() => import("./ClienteEnVivoPage").then((m) => ({ default: m.ClienteEnVivoPage })));

const itemClass = ({ isActive }) =>
  clsx(
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors",
    isActive ? "bg-line/15 text-ink-50" : "text-ink-300 hover:bg-line/10 hover:text-ink-50"
  );

// Vistas del usuario cliente segun las casillas que le activo el Admin: el mapa (En vivo y Seguimiento), el historial y el registro.
// "label" es la clave del texto (i18n).
const buildNav = (modulos) => {
  const verSeguimiento = modulos.includes("MAPA") || modulos.includes("LISTA");
  const mapa = [
    ...(modulos.includes("EN_VIVO") ? [{ to: "/cliente/en-vivo", label: "nav.live", icon: MapPinIcon }] : []),
    ...(verSeguimiento ? [{ to: "/cliente", label: "nav.tracking", icon: RouteIcon, end: true }] : []),
  ];
  // El Dashboard (si lo tiene, y necesita el Registro: usa sus datos) y el Registro van los primeros de la barra, sin grupo.
  const registro = [
    ...(modulos.includes("REGISTRO") && modulos.includes("DASHBOARD") ? [{ to: "/cliente/dashboard", label: "nav.dashboard", icon: BarsIcon }] : []),
    ...(modulos.includes("REGISTRO") ? [{ to: "/cliente/registro", label: "nav.register", icon: ClipboardListIcon }] : []),
  ];
  const otras = [
    ...(modulos.includes("DISPONIBILIDAD") ? [{ to: "/cliente/disponibilidad", label: "nav.availability", icon: CalendarIcon }] : []),
    // Registro e Historial son una sola vista (la hoja de servicios): con el Registro activo, el Historial se ve ahi mismo.
    ...(modulos.includes("HISTORIAL") && !modulos.includes("REGISTRO") ? [{ to: "/cliente/historial", label: "nav.history", icon: FileTextIcon }] : []),
  ];
  return { registro, mapa, otras };
};

// Estructura de la vista de un usuario cliente: barra de navegacion a la izquierda (reducible a una franja de iconos) con sus vistas, y a la derecha la
// vista elegida. En el celular, las vistas se abren tocando el logo de la cabecera. Solo su empresa, sus servicios y lo que el Admin le activo; sin el menu
// de chofer ni de oficina.
const COMPACTA_KEY = "gt-cliente-sidebar-compacta";

const SalirIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
    <path d="M16 8l4 4-4 4" />
    <path d="M20 12H9" />
  </svg>
);

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
  const { registro, mapa, otras } = buildNav(modulos);

  // La entrada al Registro (ClienteInicio) se hace una sola vez: en cuanto se esta en otra vista, "Seguimiento" abre el seguimiento. Al cerrar
  // sesion se reinicia.
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname !== "/" && pathname !== "/cliente") marcarEntrado(true);
  }, [pathname]);
  useEffect(() => () => marcarEntrado(false), []);

  // Barra lateral reducida (escritorio): se recuerda en este navegador.
  const [compacta, setCompacta] = useState(() => {
    try {
      return localStorage.getItem(COMPACTA_KEY) === "1";
    } catch {
      return false;
    }
  });
  const alternarCompacta = () =>
    setCompacta((prev) => {
      try {
        localStorage.setItem(COMPACTA_KEY, prev ? "0" : "1");
      } catch {
        // sin almacenamiento: solo vale para esta sesion
      }
      return !prev;
    });

  // Celular: menu de vistas que se abre al tocar el logo; se cierra al elegir una vista.
  const [menuAbierto, setMenuAbierto] = useState(false);
  useEffect(() => setMenuAbierto(false), [pathname]);
  // Con el menu abierto: Escape lo cierra y la pagina de atras no se desplaza.
  useEffect(() => {
    if (!menuAbierto) return undefined;
    const onKey = (e) => e.key === "Escape" && setMenuAbierto(false);
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [menuAbierto]);

  const ThemeIcon = theme === "dark" ? SunIcon : MoonIcon;

  const marca = (soloLogo = false, conFirma = false) => (
    <div className={clsx("flex items-center gap-3", soloLogo && "justify-center")}>
      {user?.imagenUrl ? (
        <img src={user.imagenUrl} alt={titulo} className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain p-1" />
      ) : (
        <img src={logo} alt="" className="h-10 w-10 shrink-0 rounded-full" />
      )}
      {!soloLogo && (
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold text-ink-50">{titulo || "ONE DRIVER Express"}</span>
          {subtitulo && <span className="block truncate text-[12px] text-ink-400">{subtitulo}</span>}
          {conFirma && <OneSystecMark variant="by" className="mt-0.5 flex" />}
        </div>
      )}
    </div>
  );

  const botonTema = (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? t("nav.themeLight") : t("nav.themeDark")}
      className="flex h-9 w-9 items-center justify-center rounded-full text-ink-300 hover:bg-line/10 hover:text-ink-50"
    >
      <ThemeIcon className="h-[18px] w-[18px]" />
    </button>
  );

  // Dentro de OneSystec el tema y la sesion se manejan desde OneSystec.
  const acciones = (soloIconos = false) =>
    isEmbedded ? null : (
      <>
        {botonTema}
        {soloIconos ? (
          <button type="button" onClick={logout} aria-label={t("nav.signOut")} title={t("nav.signOut")} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-300 hover:bg-line/10 hover:text-ink-50">
            <SalirIcon className="h-[18px] w-[18px]" />
          </button>
        ) : (
          <button type="button" onClick={logout} className="rounded-full px-3 py-2 text-[13px] font-medium text-ink-300 hover:bg-line/10 hover:text-ink-50">
            {t("nav.signOut")}
          </button>
        )}
      </>
    );

  const itemLaterales = (items, soloIconos) =>
    items.map(({ to, label, icon: Icon, end }) => (
      <NavLink key={to} to={to} end={end} title={soloIconos ? t(label) : undefined} aria-label={soloIconos ? t(label) : undefined} className={(state) => clsx(itemClass(state), soloIconos && "justify-center px-0")}>
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {!soloIconos && t(label)}
      </NavLink>
    ));

  const grupo = (titulo, items, soloIconos) =>
    items.length > 0 && (
      <div className="flex flex-col gap-1">
        {titulo && !soloIconos && <span className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{titulo}</span>}
        {itemLaterales(items, soloIconos)}
      </div>
    );

  const grupos = (soloIconos) => (
    <>
      {grupo(null, registro, soloIconos)}
      {grupo(t("nav.groupMap"), mapa, soloIconos)}
      {grupo(mapa.length > 0 ? t("nav.groupServices") : null, otras, soloIconos)}
    </>
  );

  return (
    <div className="min-h-dvh bg-background lg:flex">
      {/* Escritorio: barra lateral fija, reducible a iconos. */}
      <aside className={clsx("sticky top-0 hidden h-dvh shrink-0 flex-col gap-5 border-r border-line/10 bg-background py-4 transition-[width] duration-200 lg:flex", compacta ? "w-[76px] px-2" : "w-60 px-3")}>
        <div className={compacta ? undefined : "px-1"} title={compacta ? titulo : undefined}>
          {marca(compacta)}
        </div>
        <nav aria-label={t("nav.views")} className="flex flex-1 flex-col gap-4 overflow-y-auto">
          {grupos(compacta)}
        </nav>
        <div className={clsx("flex border-t border-line/10 pt-3", compacta ? "flex-col items-center gap-2" : "items-center justify-between")}>
          <div className={clsx("flex items-center", compacta ? "flex-col gap-2" : "justify-between gap-2")}>{acciones(compacta)}</div>
          <button
            type="button"
            onClick={alternarCompacta}
            aria-label={compacta ? t("nav.expand") : t("nav.collapse")}
            title={compacta ? t("nav.expand") : t("nav.collapse")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-300 hover:bg-line/10 hover:text-ink-50"
          >
            {compacta ? <ChevronRightIcon className="h-[18px] w-[18px]" /> : <ChevronLeftIcon className="h-[18px] w-[18px]" />}
          </button>
        </div>
        <div className={clsx("border-t border-line/10 pt-3", compacta ? "flex justify-center" : "px-1")}>
          <OneSystecMark variant="madeBy" logoOnly={compacta} className="flex" />
        </div>
      </aside>

      {/* Celular: el menu de vistas se despliega de izquierda a derecha sobre la pagina. */}
      <div className={clsx("fixed inset-0 z-50 lg:hidden", !menuAbierto && "pointer-events-none")} aria-hidden={!menuAbierto}>
        <button
          type="button"
          tabIndex={menuAbierto ? 0 : -1}
          aria-label={t("common.close")}
          onClick={() => setMenuAbierto(false)}
          className={clsx("absolute inset-0 bg-black/60 transition-opacity duration-200", menuAbierto ? "opacity-100" : "opacity-0")}
        />
        <aside
          className={clsx(
            "absolute inset-y-0 left-0 flex w-[78%] max-w-[300px] flex-col gap-5 border-r border-line/10 bg-background px-3 py-4 shadow-2xl transition-transform duration-200",
            menuAbierto ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-start gap-2 px-1">
            <div className="min-w-0 flex-1">{marca()}</div>
            <button type="button" onClick={() => setMenuAbierto(false)} aria-label={t("common.close")} className="rounded-lg p-1.5 text-ink-300 hover:bg-line/10 hover:text-ink-50">
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
          <nav aria-label={t("nav.views")} className="flex flex-1 flex-col gap-4 overflow-y-auto">
            {grupos(false)}
          </nav>
          <div className="border-t border-line/10 px-1 pt-3">
            <OneSystecMark variant="madeBy" className="flex" />
          </div>
        </aside>
      </div>

      <div className="min-w-0 flex-1">
        {/* Celular: la cabecera es el boton del menu (al tocar el logo se ven las vistas). */}
        <header className="sticky top-0 z-30 border-b border-line/10 bg-background/95 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-expanded={menuAbierto}
              aria-label={t("nav.views")}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl text-left"
            >
              <span className="min-w-0 flex-1">{marca(false, true)}</span>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-300" />
            </button>
            {acciones()}
          </div>
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

// Pantalla de inicio segun lo que tenga activo: al entrar, el Registro; despues seguimiento primero; si no, el mapa en vivo, el historial o el registro; si no, un aviso.
const ClienteInicio = () => {
  const t = useT();
  const { user } = useAuth();
  const modulos = user?.clienteModulos ?? [];
  if (modulos.includes("REGISTRO") && !haEntrado()) return <Navigate to={modulos.includes("DASHBOARD") ? "/cliente/dashboard" : "/cliente/registro"} replace />;
  if (modulos.includes("MAPA") || modulos.includes("LISTA")) return <ClienteSeguimientoPage />;
  if (modulos.includes("EN_VIVO")) return <Navigate to="/cliente/en-vivo" replace />;
  if (modulos.includes("DISPONIBILIDAD")) return <Navigate to="/cliente/disponibilidad" replace />;
  if (modulos.includes("REGISTRO")) return <Navigate to="/cliente/registro" replace />;
  if (modulos.includes("HISTORIAL")) return <Navigate to="/cliente/historial" replace />;
  return (
    <p className="px-1 py-10 text-center text-[14px] text-ink-300">
      {t("nav.noSections")}
    </p>
  );
};

// El Historial y el Registro son una sola vista: quien tiene el Registro, entra al Historial por el Registro.
const HistorialORegistro = () => {
  const { user } = useAuth();
  return user?.clienteModulos?.includes("REGISTRO") ? <Navigate to="/cliente/registro" replace /> : <ClienteHistorialPage />;
};

export const ClienteApp = () => (
  <Routes>
    <Route element={<ClienteShell />}>
      <Route path="/cliente" element={<ClienteInicio />} />
      <Route path="/cliente/en-vivo" element={<ClienteEnVivoPage />} />
      <Route path="/cliente/disponibilidad" element={<ClienteDisponibilidadPage />} />
      <Route path="/cliente/historial" element={<HistorialORegistro />} />
      <Route path="/cliente/dashboard" element={<ClienteDashboardPage />} />
      <Route path="/cliente/registro" element={<ClienteRegistroPage />} />
      <Route path="*" element={<Navigate to="/cliente" replace />} />
    </Route>
  </Routes>
);
