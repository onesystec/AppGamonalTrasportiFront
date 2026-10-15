import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { TruckArt } from "../../components/chofer/illustrations";
import { FuelIcon, ReceiptIcon, WalletIcon } from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { listHorasPendientesRequest } from "../../lib/horas.api";

const tabClass = ({ isActive }) =>
  clsx(
    "whitespace-nowrap border-b-2 px-3.5 py-3 text-[14px] font-medium transition-colors",
    isActive
      ? "border-accent-400 text-ink-50"
      : "border-transparent text-ink-300 hover:text-ink-50"
  );

// Contenedor de "Finanzas Operativas": titulo, pestañas y, debajo, la pestaña activa.
// Las rutas viven bajo /finanzas (ver App.jsx); los detalles y altas de cada modulo se
// abren encima de la pestaña como panel lateral.
const choferTabClass = ({ isActive }) =>
  clsx(
    "relative flex flex-1 items-center justify-center gap-1 whitespace-nowrap px-1.5 py-3.5 text-[12px] font-medium transition-colors sm:gap-2 sm:px-3.5 sm:text-[13px] min-w-0",
    isActive
      ? "text-ink-50 after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:bg-brand"
      : "text-ink-300 hover:text-ink-50"
  );

// Cabecera y pestañas de "Mis cargos" (chofer): tarjeta con ilustracion y pestañas con icono.
const ChoferHeader = () => (
  <div className="flex flex-col gap-4">
    <section className="glass-surface relative overflow-hidden rounded-3xl p-4 sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 top-0 h-36 w-72 text-accent-400 opacity-[0.3] [mask-image:linear-gradient(to_left,black_35%,transparent)] sm:opacity-40"
      >
        <TruckArt className="h-full w-full" />
      </div>
      <div className="relative flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30">
          <WalletIcon className="h-7 w-7" />
        </span>
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-ink-50">Mis cargos</h1>
          <p className="mt-0.5 max-w-sm text-[14px] text-ink-200">
            Consulta tus cargas de combustible y tus avisos de mancato pagamento.
          </p>
        </div>
      </div>
    </section>

    <nav
      aria-label="Secciones de mis cargos"
      className="glass-surface-sm flex overflow-x-auto rounded-2xl"
    >
      <NavLink to="/finanzas/combustible" className={choferTabClass}>
        <FuelIcon className="h-[18px] w-[18px]" />
        Combustible
      </NavLink>
      <NavLink to="/finanzas/mancato" className={choferTabClass}>
        <ReceiptIcon className="h-[18px] w-[18px]" />
        <span className="sm:hidden">Mancato</span>
        <span className="hidden sm:inline">Mancato Pagamento</span>
      </NavLink>
    </nav>
  </div>
);

export const FinanzasLayout = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  // Horas esperando aprobacion: se muestra como contador en la pestaña "Horas".
  const [pendingCount, setPendingCount] = useState(0);
  const refreshPendingCount = useCallback(() => {
    if (!isPrivileged) return;
    listHorasPendientesRequest("PENDIENTE")
      .then((items) => setPendingCount(items.length))
      .catch(() => {});
  }, [isPrivileged]);
  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  if (!isPrivileged) {
    return (
      <div className="flex flex-col gap-5">
        <ChoferHeader />
        <Outlet context={{ refreshPendingCount }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30">
          <WalletIcon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-[26px] font-semibold leading-tight text-ink-50">
            {isPrivileged ? "Finanzas Operativas" : "Mis cargos"}
          </h1>
          <p className="mt-0.5 text-[14px] text-ink-300">
            {isPrivileged
              ? "Lo que se debe, lo que se gasta y lo que se paga a los choferes, en un solo lugar."
              : "Tu mancato pagamento y tus cargas de combustible."}
          </p>
        </div>
      </div>

      <nav
        aria-label="Secciones de finanzas"
        className="-mx-4 flex overflow-x-auto border-b border-line/15 px-4 sm:mx-0 sm:px-0"
      >
        <NavLink to="/finanzas" end className={tabClass}>
          Resumen
        </NavLink>
        {isPrivileged && (
          <NavLink to="/finanzas/horas" className={tabClass}>
            Horas
            {pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-warning-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-warning-500">
                {pendingCount}
              </span>
            )}
          </NavLink>
        )}
        {isPrivileged && (
          <NavLink to="/finanzas/pagos" className={tabClass}>
            Pago a choferes
          </NavLink>
        )}
        {isPrivileged && (
          <NavLink to="/finanzas/paradas" className={tabClass}>
            Paradas
          </NavLink>
        )}
        {isPrivileged && (
          <NavLink to="/finanzas/gastos" className={tabClass}>
            Gastos de servicios
          </NavLink>
        )}
        <NavLink to="/finanzas/combustible" className={tabClass}>
          Combustible
        </NavLink>
        <NavLink to="/finanzas/mancato" className={tabClass}>
          Mancato Pagamento
        </NavLink>
        {isPrivileged && (
          <NavLink to="/finanzas/solicitos" className={tabClass}>
            Solicitos
          </NavLink>
        )}
        <NavLink to="/finanzas/multas" className={tabClass}>
          Multas
        </NavLink>
        {isPrivileged && (
          <NavLink to="/finanzas/area-c" className={tabClass}>
            Área C
          </NavLink>
        )}
      </nav>

      <Outlet context={{ refreshPendingCount }} />
    </div>
  );
};
