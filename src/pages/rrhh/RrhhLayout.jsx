import clsx from "clsx";
import { NavLink, Navigate, Outlet } from "react-router-dom";
import { UsersIcon } from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";

const tabClass = ({ isActive }) =>
  clsx(
    "whitespace-nowrap border-b-2 px-3.5 py-3 text-[14px] font-medium transition-colors",
    isActive ? "border-accent-400 text-ink-50" : "border-transparent text-ink-300 hover:text-ink-50"
  );

// "Recursos Humanos": junta Busta paga y Memorandums como pestañas (igual que Finanzas). Las rutas de cada una siguen siendo
// /busta-paga y /memorandums (enlaces viejos, notificaciones y APK siguen funcionando); aqui solo se pone el titulo y las pestañas.
// Quien no es Admin, Responsable ni Recursos Humanos (el chofer) solo ve sus memorandums, sin esta cabecera.
export const RrhhLayout = () => {
  const { user } = useAuth();
  const cargo = user?.cargo;
  const enRrhh = cargo === "OWNER" || cargo === "ADMIN" || cargo === "RRHH";
  if (!enRrhh) return <Outlet />;
  const verBustaPaga = cargo === "OWNER" || cargo === "RRHH";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30">
          <UsersIcon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-[26px] font-semibold leading-tight text-ink-50">Recursos Humanos</h1>
          <p className="mt-0.5 text-[14px] text-ink-300">
            {verBustaPaga ? "La busta paga y los memorándums del equipo, en un solo lugar." : "Los memorándums de la empresa."}
          </p>
        </div>
      </div>

      <nav aria-label="Secciones de recursos humanos" className="-mx-4 flex overflow-x-auto border-b border-line/15 px-4 sm:mx-0 sm:px-0">
        {verBustaPaga && (
          <NavLink to="/busta-paga" className={tabClass}>
            Busta paga
          </NavLink>
        )}
        <NavLink to="/memorandums" className={tabClass}>
          Memorándums
        </NavLink>
      </nav>

      <Outlet />
    </div>
  );
};

// /rrhh: abre la primera pestaña de cada rol.
export const RrhhIndex = () => {
  const { user } = useAuth();
  return <Navigate to={user?.cargo === "OWNER" || user?.cargo === "RRHH" ? "/busta-paga" : "/memorandums"} replace />;
};
