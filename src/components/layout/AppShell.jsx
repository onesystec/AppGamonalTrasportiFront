import clsx from "clsx";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.webp";
import { roleText } from "../../lib/roles";
import { setListSearch, useListSearch } from "../../lib/listSearchStore";
import { isEmbedded } from "../../lib/embedded";
import { useAuth } from "../../context/AuthContext";
import { AppUpdateProvider, useAppUpdate } from "../../context/AppUpdateContext";
import { NotificationsProvider } from "../../context/NotificationsContext";
import { useTheme } from "../../context/ThemeContext";
import { useGpsRespaldo } from "../../hooks/useGpsRespaldo";
import { useLocationSharing } from "../../hooks/useLocationSharing";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { Avatar } from "../ui/Avatar";
import { BriefcaseIcon, CalendarIcon, ChevronDownIcon, ClockIcon, FileTextIcon, SearchIcon, SettingsIcon, ShieldIcon, WalletIcon } from "../ui/icons";
import { MemorandumsPendientesBanner, usePendingMemorandums } from "../memorandums/MemorandumsPendientesBanner";
import { MobileNavDrawer } from "./MobileNavDrawer";
import { DriverModeSwitch } from "./DriverModeSwitch";
import { NotificationsBell } from "./NotificationsBell";
import { UpdateBanner } from "./UpdateBanner";

const UserIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
  </svg>
);

const LogoutIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const HomeIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9a1 1 0 0 0 1 1h4v-6h3v6h4a1 1 0 0 0 1-1v-9" />
  </svg>
);

const ChecklistIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path d="M8 10.5l1.8 1.8L13.5 8.5" />
    <path d="M8 16h8" />
  </svg>
);

const ListIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
);

const UsersIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.5 20c0-3.4 3-5 6.5-5s6.5 1.6 6.5 5" />
    <circle cx="17.5" cy="9" r="2.5" />
    <path d="M15.8 20c.1-2.6 1.6-4.2 3.7-4.6" />
  </svg>
);

const TruckIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M2 7h11v9H2z" />
    <path d="M13 10h4l3.5 3.5V16h-7.5" />
    <circle cx="6.5" cy="18" r="1.8" />
    <circle cx="17" cy="18" r="1.8" />
  </svg>
);

const SunIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const MoonIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

// Botón que alterna claro/oscuro; el icono mostrado es el modo al que se
// cambiaria al hacer click (convencion habitual: sol = "pasar a claro"). Con
// "label" se ve como una fila mas del menu (sidebar); sin el, como boton redondo.
const ThemeToggleButton = ({ className, iconClassName, label }) => {
  const { theme, toggleTheme } = useTheme();
  const Icon = theme === "dark" ? SunIcon : MoonIcon;
  const text = theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro";

  // Dentro de OneSystec el tema se elige alli.
  if (isEmbedded) return null;

  return (
    <button type="button" onClick={toggleTheme} aria-label={text} title={text} className={className}>
      <Icon className={iconClassName ?? "h-[18px] w-[18px]"} />
      {label && text}
    </button>
  );
};

const WrenchIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M14.7 6.3a4 4 0 0 0-5.4 4.9L3 17.5V21h3.5l6.3-6.3a4 4 0 0 0 4.9-5.4l-2.8 2.8-2.1-2.1 2.8-2.8z" />
  </svg>
);

const MapPinIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.3" />
  </svg>
);

const ChevronSideIcon = ({ left, ...props }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d={left ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
  </svg>
);

const PinIcon = ({ filled, ...props }) => (
  <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 4h6l-1 6 3 3H7l3-3-1-6z" />
    <path d="M12 16v5" />
  </svg>
);

// Menu fijado o no (cada navegador lo recuerda). Sin fijar se ve solo la franja de iconos.
const SIDEBAR_PIN_KEY = "gt_sidebar_pinned";
const readPinned = () => {
  try {
    return localStorage.getItem(SIDEBAR_PIN_KEY) === "1";
  } catch {
    return false;
  }
};
const savePinned = (value) => {
  try {
    localStorage.setItem(SIDEBAR_PIN_KEY, value ? "1" : "0");
  } catch {
    // Sin almacenamiento: solo dura esta sesion.
  }
};

// Clases de una fila del menu lateral; "compact" = franja de iconos (sin texto).
const sidebarRowClass = (active, compact) =>
  clsx(
    "relative flex items-center rounded-xl py-2.5 text-[14px] font-medium transition-colors",
    compact ? "justify-center px-0" : "gap-3 px-3",
    active
      ? clsx(
          "bg-sidebar-accent font-semibold text-white before:absolute before:inset-y-2 before:w-[3px] before:rounded-r-full before:bg-sidebar-active",
          compact ? "before:-left-2" : "before:-left-4"
        )
      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
  );

// Nav vertical fija a la izquierda para pantallas de desktop (sm y mas anchas).
// En celular se usa la BottomNavTab de mas abajo en su lugar.
// Seccion "Recursos Humanos": junta Busta paga y Memorandums (cada uno con su ruta de siempre), asi que se marca activa en cualquiera de las dos.
const RRHH_PATHS = ["/rrhh", "/busta-paga", "/memorandums"];
const inPaths = (pathname, paths) => paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const SidebarNavTab = ({ to, label, icon: Icon, match, compact }) => {
  const { pathname } = useLocation();
  return (
    <NavLink
      to={to}
      end={to === "/"}
      title={compact ? label : undefined}
      aria-label={compact ? label : undefined}
      className={({ isActive }) => sidebarRowClass(isActive || (match && inPaths(pathname, match)), compact)}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!compact && label}
    </NavLink>
  );
};

// Nav inferior fija para pantallas de celular: ocupa todo el ancho, siempre visible
// arriba del contenido de cada seccion. En desktop se usa la SidebarNavTab de la izquierda.
const BottomNavTab = ({ to, label, icon: Icon, match }) => {
  const { pathname } = useLocation();
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        clsx(
          "flex flex-1 flex-col items-center justify-center gap-1 px-0.5 py-3.5 text-center text-[11px] font-medium leading-tight transition-colors",
          isActive || (match && inPaths(pathname, match)) ? "text-sidebar-active" : "text-sidebar-foreground/60"
        )
      }
    >
      <Icon className="h-6 w-6" />
      {label}
    </NavLink>
  );
};

// Secciones que en mobile viven en el nav deslizable (MobileNavDrawer) en vez del
// nav inferior, para no saturarlo de iconos - se activa tocando el logo GT del
// header. En desktop siguen en el sidebar fijo de siempre, sin cambios.
const DRAWER_NAV_ITEMS = [
  { to: "/finanzas", label: "Finanzas Operativas", icon: WalletIcon },
  { to: "/trabajos-adicionales", label: "Trabajos adicionales", icon: BriefcaseIcon },
  { to: "/permisos", label: "Permisos", icon: CalendarIcon },
  { to: "/rrhh", label: "Recursos Humanos", icon: UsersIcon, match: RRHH_PATHS },
  { to: "/vencimientos", label: "Vencimientos", icon: ShieldIcon },
  { to: "/mapa", label: "Mapa", icon: MapPinIcon },
  { to: "/mecanica", label: "Mecánica", icon: WrenchIcon },
];

// Lo mismo para el chofer (y el Admin/Owner en su modo chofer): lo que no entra en su nav inferior.
const MEMORANDUMS_NAV_ITEM = { to: "/memorandums", label: "Memorándums", icon: FileTextIcon };
const RRHH_NAV_ITEM = { to: "/rrhh", label: "Recursos Humanos", icon: UsersIcon, match: RRHH_PATHS };
const CHOFER_DRAWER_NAV_ITEMS = [{ to: "/trabajos-adicionales", label: "Trabajos adicionales", icon: BriefcaseIcon }, MEMORANDUMS_NAV_ITEM];

// Placeholder de la barra superior en las paginas de lista donde filtra en vivo.
const LIST_SEARCH_PLACEHOLDERS = {
  "/vehiculos": "Buscar vehículo, matrícula, conductor o centro...",
  "/choferes": "Buscar chofer, correo, teléfono o centro...",
};

// Puntito que avisa que hay una version nueva de la app.
const UpdateDot = () => {
  const { hasUpdate } = useAppUpdate();
  return hasUpdate ? <span className="ml-auto h-2 w-2 rounded-full bg-sidebar-active" aria-label="Hay una versión nueva" /> : null;
};

const AppShellContent = () => {
  const { user, logout, canUseDriverMode, driverMode } = useAuth();
  const { theme, toggleTheme } = useTheme();
  // En modo chofer el Admin/Owner ve la vista de chofer, pero conserva arriba el switch para volver.
  const showDriverBar = canUseDriverMode && driverMode;
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  // Recursos Humanos: solo Choferes, Vehiculos y Busta paga.
  const isRrhh = user?.cargo === "RRHH";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Menu lateral (desktop): fijado (empuja el contenido) o desplegable encima del contenido.
  const [sidebarPinned, setSidebarPinned] = useState(readPinned);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarExpanded = sidebarPinned || sidebarOpen;
  const compact = !sidebarExpanded;
  const togglePinned = () => {
    const next = !sidebarPinned;
    setSidebarPinned(next);
    savePinned(next);
    setSidebarOpen(false);
  };
  const [searchText, setSearchText] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const listSearch = useListSearch();
  const pendingMemorandums = usePendingMemorandums();

  // Buscador contextual: dentro de Vehiculos y Choferes filtra la lista en vivo (comparte
  // el texto con la barra de esa pagina); en el resto de la app reutiliza el buscador de
  // Registros (codigo/cliente/chofer) y lleva a /records?q=... con el texto cargado.
  const listPlaceholder = LIST_SEARCH_PLACEHOLDERS[location.pathname];
  const onList = Boolean(listPlaceholder);
  const searchValue = onList ? listSearch : searchText;
  const handleSearchChange = (e) => {
    const value = e.target.value;
    if (onList) setListSearch(value);
    else setSearchText(value);
  };
  const handleSearch = (e) => {
    e.preventDefault();
    if (onList) return;
    const query = searchText.trim();
    if (query.length < 2) return;
    navigate(`/records?q=${encodeURIComponent(query)}`);
    setSearchText("");
  };

  // Al ir a otra seccion se cierra el menu desplegado (si no esta fijado).
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useLocationSharing();
  useGpsRespaldo();
  usePushNotifications();

  return (
    <NotificationsProvider>
    <div className="relative min-h-dvh w-full bg-background">
      {/* Topbar fija de desktop para OWNER/ADMIN: ocupa todo el ancho a la derecha del
          sidebar, siempre arriba de todo (z-40, por encima incluso de los paneles
          deslizantes de formularios en z-30) para que nada la tape nunca. Ademas de la
          campanita, es donde va cualquier otro boton global que se agregue a futuro. */}
      {isPrivileged && (
        <header className={clsx("fixed left-0 right-0 top-0 z-40 hidden h-16 items-center justify-between gap-4 border-b border-line/10 bg-background px-6 sm:flex", sidebarPinned ? "sm:left-60" : "sm:left-16")}>
          <form onSubmit={handleSearch} role="search" className="relative w-full max-w-md">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={searchValue}
              onChange={handleSearchChange}
              placeholder={listPlaceholder ?? "Buscar servicio, cliente o chofer..."}
              aria-label={listPlaceholder ?? "Buscar servicio, cliente o chofer"}
              className="glass-input w-full rounded-xl py-2.5 pl-11 pr-4 text-[14px] text-ink-50"
            />
          </form>

          <div className="flex items-center gap-3">
            <DriverModeSwitch />
            <NotificationsBell />
            <Link
              to="/profile"
              className="flex items-center gap-3 rounded-xl py-1 pl-1 pr-2 transition-colors hover:bg-line/10"
              title="Ver mi perfil"
            >
              <Avatar user={user} className="h-10 w-10 text-[13px]" />
              <span className="hidden text-left leading-tight lg:block">
                <span className="block text-[13px] font-semibold text-ink-50">
                  {user?.nombre} {user?.apellido}
                </span>
                <span className="block text-[12px] text-ink-400">{roleText(user)}</span>
              </span>
              <ChevronDownIcon className="hidden h-4 w-4 text-ink-400 lg:block" />
            </Link>
          </div>
        </header>
      )}

      {showDriverBar && (
        <header className={clsx("fixed left-0 right-0 top-0 z-40 hidden h-16 items-center justify-end gap-3 border-b border-line/10 bg-background px-6 sm:flex", sidebarPinned ? "sm:left-60" : "sm:left-16")}>
          <DriverModeSwitch />
        </header>
      )}

      <div className="relative z-10 sm:flex">
        {/* Sidebar fija a la izquierda en desktop; en celular se reemplaza por el
            header + nav inferior de abajo. Navy fijo (no cambia con el tema),
            igual que el sidebar del style pack. */}
        {/* Espacio que ocupa el menu en la pagina: ancho completo si esta fijado, franja de iconos si no. */}
        <div aria-hidden="true" className={clsx("hidden shrink-0 transition-[width] duration-200 sm:block", sidebarPinned ? "sm:w-60" : "sm:w-16")} />

        {/* Desplegado sin fijar: un clic fuera lo cierra. */}
        {sidebarOpen && !sidebarPinned && (
          <button
            type="button"
            aria-label="Ocultar menu"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 hidden cursor-default bg-black/20 sm:block"
          />
        )}

        <aside
          className={clsx(
            "group hidden sm:fixed sm:inset-y-0 sm:left-0 sm:z-50 sm:flex sm:h-dvh sm:flex-col sm:justify-between sm:border-r sm:border-sidebar-border sm:bg-sidebar sm:py-6 sm:transition-[width] sm:duration-200",
            sidebarExpanded ? "sm:w-60 sm:px-4" : "sm:w-16 sm:px-2",
            sidebarOpen && !sidebarPinned && "sm:shadow-2xl"
          )}
        >
          {/* Flecha para desplegar / ocultar el menu (aparece al pasar el mouse). Con el menu fijado no hace falta. */}
          {!sidebarPinned && (
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label={sidebarOpen ? "Ocultar menu" : "Desplegar menu"}
              title={sidebarOpen ? "Ocultar menu" : "Desplegar menu"}
              className={clsx(
                "absolute -right-3.5 top-20 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-md transition-opacity hover:text-sidebar-active focus:opacity-100",
                sidebarOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            >
              <ChevronSideIcon left={sidebarOpen} className="h-4 w-4" />
            </button>
          )}

          {/* Arriba: logo fijo y menu con scroll propio. Abajo (mas abajo): perfil, ajustes y cerrar sesion, siempre a la vista. */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className={clsx("flex shrink-0 items-center", compact ? "justify-center" : "gap-2 px-2")}>
              <Link to="/" className="flex min-w-0 items-center gap-3" title={compact ? "Gamonal Driver 2.0" : undefined}>
                <img src={logo} alt="Gamonal Driver 2.0" className="h-10 w-10 shrink-0 rounded-full" />
                {!compact && (
                  <span className="text-[16px] font-semibold text-sidebar-foreground">
                    Gamonal <span className="text-sidebar-active">Driver 2.0</span>
                  </span>
                )}
              </Link>
              {!compact && (
                <button
                  type="button"
                  onClick={togglePinned}
                  aria-pressed={sidebarPinned}
                  aria-label={sidebarPinned ? "Soltar menu" : "Fijar menu"}
                  title={sidebarPinned ? "Soltar menu (se oculta y deja mas espacio)" : "Fijar menu abierto"}
                  className={clsx(
                    "ml-auto rounded-lg p-1.5 transition-colors hover:bg-sidebar-accent",
                    sidebarPinned ? "text-sidebar-active" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                  )}
                >
                  <PinIcon filled={sidebarPinned} className="h-4 w-4" />
                </button>
              )}
            </div>

            <nav
              className={clsx(
                "mt-6 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-2 [scrollbar-width:thin]",
                compact ? "-mx-2 px-2" : "-mx-4 px-4"
              )}
            >
              {isPrivileged ? (
                <>
                  <SidebarNavTab to="/" label="Inicio" icon={HomeIcon} compact={compact} />
                  <SidebarNavTab to="/resumen" label="Resumen" icon={ChecklistIcon} compact={compact} />
                  <SidebarNavTab to="/records" label="Registros" icon={ListIcon} compact={compact} />
                  <SidebarNavTab to="/finanzas" label="Finanzas" icon={WalletIcon} compact={compact} />
                </>
              ) : isRrhh ? (
                <SidebarNavTab to="/rrhh" label="Recursos Humanos" icon={UsersIcon} match={RRHH_PATHS} compact={compact} />
              ) : (
                <>
                  <SidebarNavTab to="/" label="Hoy" icon={HomeIcon} compact={compact} />
                  <SidebarNavTab to="/mis-servicios" label="Mis servicios" icon={ListIcon} compact={compact} />
                  <SidebarNavTab to="/mis-horas" label="Mis horas" icon={ClockIcon} compact={compact} />
                  <SidebarNavTab to="/trabajos-adicionales" label="Trabajos adicionales" icon={BriefcaseIcon} compact={compact} />
                  <SidebarNavTab to="/calendario" label="Calendario" icon={CalendarIcon} compact={compact} />
                  <SidebarNavTab to="/finanzas" label="Mis cargos" icon={WalletIcon} compact={compact} />
                </>
              )}
              {(isPrivileged || isRrhh) && <SidebarNavTab to="/choferes" label="Choferes" icon={UsersIcon} compact={compact} />}
              {isPrivileged ? (
                <SidebarNavTab to="/rrhh" label="Recursos Humanos" icon={UsersIcon} match={RRHH_PATHS} compact={compact} />
              ) : (
                !isRrhh && <SidebarNavTab to="/memorandums" label="Memorándums" icon={FileTextIcon} compact={compact} />
              )}
              {isPrivileged && <SidebarNavTab to="/trabajos-adicionales" label="Trabajos adicionales" icon={BriefcaseIcon} compact={compact} />}
              {isPrivileged && <SidebarNavTab to="/permisos" label="Permisos" icon={CalendarIcon} compact={compact} />}
              {(isPrivileged || isRrhh) && <SidebarNavTab to="/vehiculos" label="Vehículos" icon={TruckIcon} compact={compact} />}
              {(isPrivileged || isRrhh) && <SidebarNavTab to="/vencimientos" label="Vencimientos" icon={ShieldIcon} compact={compact} />}
              {user?.cargo === "OWNER" && <SidebarNavTab to="/acceso-clientes" label="Acceso clientes" icon={UsersIcon} compact={compact} />}
              {isPrivileged && <SidebarNavTab to="/mapa" label="Mapa" icon={MapPinIcon} compact={compact} />}
              {isPrivileged && <SidebarNavTab to="/mecanica" label="Mecánica" icon={WrenchIcon} compact={compact} />}
            </nav>
          </div>

          <div className="flex shrink-0 flex-col gap-1 border-t border-sidebar-border pt-3">
            <NavLink
              to="/profile"
              title={compact ? "Mi perfil" : undefined}
              aria-label={compact ? "Mi perfil" : undefined}
              className={({ isActive }) => sidebarRowClass(isActive, compact)}
            >
              <UserIcon className="h-5 w-5 shrink-0" />
              {!compact && "Mi perfil"}
            </NavLink>

            {user?.cargo === "CHOFER" && !compact && (
              <div className="px-3 py-1">
                <NotificationsBell variant="sidebar" />
              </div>
            )}

            <NavLink
              to="/ajustes"
              title={compact ? "Ajustes de la app" : undefined}
              aria-label={compact ? "Ajustes de la app" : undefined}
              className={({ isActive }) => sidebarRowClass(isActive, compact)}
            >
              <SettingsIcon className="h-5 w-5 shrink-0" />
              {!compact && "Ajustes de la app"}
              {!compact && <UpdateDot />}
            </NavLink>

            <ThemeToggleButton
              label={!compact}
              className={clsx(
                "flex items-center rounded-xl py-2.5 text-left text-[14px] font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                compact ? "justify-center px-0" : "gap-3 px-3"
              )}
              iconClassName="h-5 w-5 shrink-0"
            />

            {!isEmbedded && (
              <button
                type="button"
                onClick={logout}
                title={compact ? "Cerrar sesión" : undefined}
                aria-label={compact ? "Cerrar sesión" : undefined}
                className={clsx(
                  "flex items-center rounded-xl py-2.5 text-left text-[14px] font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  compact ? "justify-center px-0" : "gap-3 px-3"
                )}
              >
                <LogoutIcon className="h-5 w-5 shrink-0" />
                {!compact && "Cerrar sesión"}
              </button>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between gap-4 px-4 py-6 sm:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Abrir menu"
              title="Abrir menu"
              className="flex items-center gap-3"
            >
              <img
                src={logo}
                alt="Gamonal Driver 2.0"
                className={clsx("h-10 w-10 shrink-0", isPrivileged ? "rounded-xl" : "rounded-full")}
              />
              {!isPrivileged && (
                <span className="text-[20px] font-semibold text-ink-50">
                  Gamonal <span className="text-brand">Driver 2.0</span>
                </span>
              )}
            </button>

            <div className="flex items-center gap-2">
              <DriverModeSwitch />
              <NavLink
                to="/profile"
                aria-label="Ver mi perfil"
                title="Ver mi perfil"
                className={({ isActive }) =>
                  clsx(
                    "flex h-10 w-10 items-center justify-center rounded-full glass-surface-sm transition-colors hover:bg-line/10 hover:text-ink-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-line/20",
                    isActive ? "text-ink-50" : "text-ink-300"
                  )
                }
              >
                <UserIcon className="h-[18px] w-[18px]" />
              </NavLink>

              {(user?.cargo === "CHOFER" || isPrivileged) && <NotificationsBell />}
            </div>
          </header>

          {/* sm:pt-24 en vez de sm:pt-10 cuando es OWNER/ADMIN: deja espacio para que la
              topbar fija (h-16 + borde) nunca tape el contenido de la pagina. */}
          <main
            className={clsx(
              "px-4 pb-28 sm:px-6 sm:pb-10",
              isPrivileged || showDriverBar ? "sm:pt-24" : "sm:pt-10"
            )}
          >
            <UpdateBanner />
            <MemorandumsPendientesBanner count={pendingMemorandums} />
            <Outlet />
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex w-full items-stretch border-t border-sidebar-border bg-sidebar/95 backdrop-blur-2xl pb-[env(safe-area-inset-bottom)] sm:hidden">
        {isPrivileged ? (
          <>
            <BottomNavTab to="/" label="Inicio" icon={HomeIcon} />
            <BottomNavTab to="/resumen" label="Resumen" icon={ChecklistIcon} />
            <BottomNavTab to="/records" label="Registros" icon={ListIcon} />
          </>
        ) : isRrhh ? (
          <>
            <BottomNavTab to="/rrhh" label="Recursos Humanos" icon={UsersIcon} match={RRHH_PATHS} />
            <BottomNavTab to="/profile" label="Perfil" icon={UserIcon} />
          </>
        ) : (
          <>
            <BottomNavTab to="/" label="Hoy" icon={HomeIcon} />
            <BottomNavTab to="/mis-horas" label="Mis horas" icon={ClockIcon} />
            <BottomNavTab to="/calendario" label="Calendario" icon={CalendarIcon} />
            <BottomNavTab to="/finanzas" label="Mis cargos" icon={WalletIcon} />
            <BottomNavTab to="/mis-servicios" label="Mis servicios" icon={ListIcon} />
          </>
        )}
        {(isPrivileged || isRrhh) && <BottomNavTab to="/choferes" label="Choferes" icon={UsersIcon} />}
        {(isPrivileged || isRrhh) && <BottomNavTab to="/vehiculos" label="Vehículos" icon={TruckIcon} />}
        {isRrhh && <BottomNavTab to="/vencimientos" label="Vencimientos" icon={ShieldIcon} />}
      </nav>

      <MobileNavDrawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        items={isPrivileged ? (user?.cargo === "OWNER" ? [...DRAWER_NAV_ITEMS, { to: "/acceso-clientes", label: "Acceso clientes", icon: UsersIcon }] : DRAWER_NAV_ITEMS) : isRrhh ? [RRHH_NAV_ITEM] : CHOFER_DRAWER_NAV_ITEMS}
        theme={theme}
        updateDot={<UpdateDot />}
        onToggleTheme={toggleTheme}
        onLogout={logout}
      />
    </div>
    </NotificationsProvider>
  );
};

export const AppShell = () => (
  <AppUpdateProvider>
    <AppShellContent />
  </AppUpdateProvider>
);
