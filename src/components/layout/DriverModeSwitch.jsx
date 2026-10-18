import clsx from "clsx";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { TruckIcon } from "../ui/icons";

// Switch del Admin/Owner para ver la app como un chofer (y volver). Siempre arriba, a la izquierda de la campanita.
// Solo se cambia a mano; al cambiar de vista se vuelve al inicio de la vista nueva.
export const DriverModeSwitch = () => {
  const { canUseDriverMode, driverMode, setDriverMode } = useAuth();
  const navigate = useNavigate();
  if (!canUseDriverMode) return null;

  const toggle = () => {
    setDriverMode(!driverMode);
    navigate("/", { replace: true });
  };

  const label = driverMode ? "Modo chofer activo. Toca para volver a la vista de administrador" : "Ver la app como chofer";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={driverMode}
      aria-label={label}
      title={label}
      onClick={toggle}
      className={clsx(
        "flex h-10 shrink-0 items-center gap-2 rounded-full px-3 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-line/20",
        driverMode ? "bg-brand/15 text-brand ring-1 ring-brand/40" : "glass-surface-sm text-ink-300 hover:bg-line/10 hover:text-ink-50"
      )}
    >
      <TruckIcon className="h-[18px] w-[18px] shrink-0" />
      <span className="hidden text-[13px] font-semibold sm:inline">Modo chofer</span>
      <span
        aria-hidden="true"
        className={clsx("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", driverMode ? "bg-brand" : "bg-line/20")}
      >
        <span
          className={clsx(
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
            driverMode ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
};
