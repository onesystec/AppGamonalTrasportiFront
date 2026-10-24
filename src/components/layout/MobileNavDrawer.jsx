import clsx from "clsx";
import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import logo from "../../assets/logo.webp";
import { isEmbedded } from "../../lib/embedded";
import { SettingsIcon } from "../ui/icons";

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

// Nav deslizable de mobile, activado tocando el logo GT del header (ver AppShell):
// agrupa las secciones que no entran comodas en el nav inferior (Mapa, Mecanica),
// mas cambiar de tema y cerrar sesion al pie. Solo existe en mobile (sm:hidden) -
// en desktop esas secciones ya estan en el sidebar fijo de siempre.
export const MobileNavDrawer = ({ open, onClose, items, theme, updateDot, onToggleTheme, onLogout }) => {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex sm:hidden">
      <button
        type="button"
        aria-label="Cerrar menu"
        onClick={onClose}
        className="absolute inset-0 bg-backdrop backdrop-blur-sm"
      />

      <div className="relative z-10 flex h-dvh w-72 max-w-[80vw] animate-slide-in-left flex-col justify-between border-r border-sidebar-border bg-sidebar px-4 py-6">
        <div>
          <div className="flex items-center gap-3 px-2">
            <img src={logo} alt="Gamonal Driver 2.0" className="h-10 w-10 shrink-0 rounded-full" />
            <span className="text-[16px] font-semibold text-sidebar-foreground">
              Gamonal <span className="text-sidebar-active">Driver 2.0</span>
            </span>
          </div>

          <nav className="mt-8 flex flex-col gap-1">
            {items.map(({ to, label, icon: Icon, match }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors",
                    isActive || match?.some((p) => pathname === p || pathname.startsWith(`${p}/`))
                      ? "bg-sidebar-accent font-semibold text-white"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-1 border-t border-sidebar-border pt-3">
          <NavLink
            to="/ajustes"
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent font-semibold text-white"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )
            }
          >
            <SettingsIcon className="h-5 w-5 shrink-0" />
            Ajustes de la app
            {updateDot}
          </NavLink>

          {!isEmbedded && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              {theme === "dark" ? (
                <SunIcon className="h-5 w-5 shrink-0" />
              ) : (
                <MoonIcon className="h-5 w-5 shrink-0" />
              )}
              {theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            </button>
          )}

          {!isEmbedded && (
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LogoutIcon className="h-5 w-5 shrink-0" />
              Cerrar sesión
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
