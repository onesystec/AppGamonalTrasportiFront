import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useNotifications } from "../../context/NotificationsContext";
import { Spinner } from "../ui/Spinner";

// Colores segun severidad: rojo = urgente (ETA por vencer), naranja = por vencer
// (documentos), amarillo = recordatorio (cumpleanios). "warning" queda como
// default para las alertas del chofer, que no traen severity propia.
// Exportados para que DailySummaryPage use la misma paleta que este dropdown.
export const SEVERITY_ITEM_CLASSES = {
  urgent: "border-danger-500/25 bg-danger-500/10 text-danger-500",
  warning: "border-status-rischedulato/25 bg-status-rischedulato/10 text-status-rischedulato",
  reminder: "border-yellow-500/25 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
};

export const SEVERITY_DOT_CLASSES = {
  urgent: "bg-danger-500",
  warning: "bg-status-rischedulato",
  reminder: "bg-yellow-500",
};

// Exportado: DailySummaryPage (pestania Diario) reusa el mismo icono para su propio
// boton de "eliminar" - misma lista de alertas que este dropdown.
export const CloseIcon = (props) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M5 5l10 10M15 5L5 15" />
  </svg>
);

const BellIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

// variant="sidebar": el boton vive dentro del sidebar/bottom-nav, que es navy
// fijo (no cambia con el tema), asi que no puede usar los tokens ink-*/line
// (pensados para el fondo de la app) o se volveria invisible en tema claro.
export const NotificationsBell = ({ variant = "default" }) => {
  const { alerts, loading, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const isSidebar = variant === "sidebar";

  // El punto del boton toma el color de la alerta mas grave presente (urgente >
  // por vencer > recordatorio), asi de un vistazo se sabe si algo es realmente urgente.
  const topSeverity = alerts.some((a) => a.severity === "urgent")
    ? "urgent"
    : alerts.some((a) => a.severity === "warning")
      ? "warning"
      : "reminder";

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        title="Notificaciones"
        className={clsx(
          "relative flex h-10 w-10 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-4",
          isSidebar
            ? clsx(
                "hover:bg-sidebar-accent focus-visible:ring-sidebar-active/30",
                open ? "text-sidebar-foreground" : "text-sidebar-foreground/75"
              )
            : clsx(
                "glass-surface-sm hover:bg-line/10 hover:text-ink-50 focus-visible:ring-line/20",
                open ? "text-ink-50" : "text-ink-300"
              )
        )}
      >
        <BellIcon className="h-[18px] w-[18px]" />
        {alerts.length > 0 && (
          <span
            className={clsx(
              "absolute right-1.5 top-1.5 h-2 w-2 rounded-full",
              SEVERITY_DOT_CLASSES[topSeverity]
            )}
          />
        )}
      </button>

      {open && (
        // bg-background ademas de glass-surface: el fondo "vidrio" (transparencia +
        // blur) que usa glass-surface se pensado para tarjetas dentro del flujo de la
        // pagina, no para un panel flotante encima de todo - en tema oscuro quedaba
        // demasiado transparente y no se leia bien contra lo que hay detras. Mismo
        // patron que ya usan los modales (EconomicBreakdownModal, etc.).
        <div className="absolute right-0 top-12 z-20 w-72 rounded-2xl glass-surface bg-background p-3 sm:w-80">
          <span className="block px-1 pb-2 text-[13px] font-medium text-ink-300">
            Notificaciones
          </span>

          {loading ? (
            <div className="flex justify-center py-4">
              <Spinner className="h-5 w-5 border-line/20 border-t-line" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="px-1 py-2 text-[13px] text-ink-400">Sin alertas pendientes.</p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {alerts.map((alert) => {
                const itemClassName = clsx(
                  "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[13px]",
                  SEVERITY_ITEM_CLASSES[alert.severity] ?? SEVERITY_ITEM_CLASSES.warning
                );
                return (
                  <li key={alert.id} className={itemClassName}>
                    {alert.link ? (
                      <Link to={alert.link} onClick={() => setOpen(false)} className="min-w-0 flex-1 hover:underline">
                        {alert.message}
                      </Link>
                    ) : (
                      <span className="min-w-0 flex-1">{alert.message}</span>
                    )}
                    {/* "Eliminar" no borra nada en el backend (la alerta se recalcula
                        sola) - queda descartada por dispositivo hasta que la misma
                        situacion empeore (ver isDismissed en NotificationsContext).
                        dismissible === false (ej. Area C): no tiene sentido "ocultarla"
                        a mano, tiene que resolverse de verdad (marcar pagado en la
                        seccion Area C de Finanzas) para que deje de aparecer. */}
                    {alert.dismissible !== false && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dismiss(alert);
                        }}
                        aria-label="Eliminar notificacion"
                        title="Eliminar notificacion"
                        className="shrink-0 rounded-full p-1 opacity-60 transition-opacity hover:bg-current/10 hover:opacity-100"
                      >
                        <CloseIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            to="/resumen"
            onClick={() => setOpen(false)}
            className="mt-3 block rounded-xl px-1 py-1 text-center text-[12px] font-medium text-accent-400 hover:text-accent-300"
          >
            Ver resumen diario completo &rarr;
          </Link>
        </div>
      )}
    </div>
  );
};
