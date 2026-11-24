import { canConfigureFinance, canManageFinance } from "../../lib/financeAccess";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { CostosChart } from "../../components/finanzas/CostosChart";
import { MonthSelector } from "../../components/finanzas/MonthSelector";
import { MancatoKpi } from "../../components/mancato/MancatoKpi";
import { DebtSummary } from "../../components/mancato/MancatoSidebar";
import { Alert } from "../../components/ui/Alert";
import { PageLoader } from "../../components/ui/PageLoader";
import { PanelShell } from "../../components/ui/PanelShell";
import {
  AlertTriangleIcon,
  BarsIcon,
  ChevronRightIcon,
  EuroIcon,
  FuelIcon,
  GavelIcon,
  ReceiptIcon,
  TruckIcon,
  UsersIcon,
} from "../../components/ui/icons";
import { TarifasKmCard } from "../../components/finanzas/TarifasKmCard";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { COSTO_COLORS, currentMonth, monthName } from "../../lib/finanzas";
import { getFinanzasResumenRequest } from "../../lib/finanzas.api";
import { formatCurrency } from "../../lib/format";

const TONE = {
  danger: { dot: "bg-danger-500 shadow-[0_0_6px_var(--danger-500)]", edge: "border-l-danger-500" },
  warning: { dot: "bg-warning-500 shadow-[0_0_6px_var(--warning-500)]", edge: "border-l-warning-500" },
  // Informativo y sin urgencia (p. ej. cargas de combustible esperando su servicio).
  info: { dot: "bg-accent-400", edge: "border-l-accent-400" },
};

// KPI que lleva a la pestaña correspondiente.
const KpiLink = ({ to, children }) => (
  <Link to={to} className="block rounded-2xl transition-transform hover:-translate-y-0.5">
    {children}
  </Link>
);

const SectionTitle = ({ children, hint }) => (
  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
    <h2 className="text-[15px] font-semibold text-ink-50">{children}</h2>
    {hint && <span className="text-[12px] text-ink-400">{hint}</span>}
  </div>
);

const ResumenOficinaPage = () => {
  const { user } = useAuth();
  const isPrivileged = canManageFinance(user);
  const mancatoRefresh = useDataRefresh("mancato").version;
  const multasRefresh = useDataRefresh("multas").version;
  const combustibleRefresh = useDataRefresh("combustible").version;

  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getFinanzasResumenRequest(month)
      .then((resumen) => {
        if (!cancelled) {
          setData(resumen);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [month, mancatoRefresh, multasRefresh, combustibleRefresh]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <PageLoader />;

  const { pendiente, mes, serie, atencion } = data;
  const costoTotal = mes.pagoChoferes.total + (mes.gastosServicios?.total ?? 0) + mes.combustible.total;
  const pendienteTotal = pendiente.mancato.total + pendiente.multas.total;

  return (
    <div className="flex flex-col gap-6">
      {/* Pendiente de pago: es el estado de hoy, no depende del mes elegido. */}
      <section className="flex flex-col gap-3">
        <SectionTitle hint="Estado de hoy">Pendiente de pago</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <KpiLink to="/finanzas/mancato">
            <MancatoKpi
              icon={ReceiptIcon}
              label="Mancato por pagar"
              value={formatCurrency(pendiente.mancato.total)}
              detail={
                pendiente.mancato.vencidos > 0
                  ? `${pendiente.mancato.vencidos} vencidos`
                  : `${pendiente.mancato.abiertos} abiertos`
              }
              color="#ff3b57"
            />
          </KpiLink>
          <KpiLink to="/finanzas/multas">
            <MancatoKpi
              icon={GavelIcon}
              label="Multas por pagar"
              value={formatCurrency(pendiente.multas.total)}
              detail={
                pendiente.multas.vencidas > 0
                  ? `${pendiente.multas.vencidas} vencidas`
                  : `${pendiente.multas.abiertas} abiertas`
              }
              color="#ff8a1a"
            />
          </KpiLink>
          <KpiLink to="/finanzas/multas">
            <MancatoKpi
              icon={UsersIcon}
              label={isPrivileged ? "Multas a descontar" : "Se te va a descontar"}
              value={formatCurrency(pendiente.multas.aDescontar.total)}
              detail={`${pendiente.multas.aDescontar.count} ${pendiente.multas.aDescontar.count === 1 ? "multa" : "multas"}`}
              color="#a78bfa"
            />
          </KpiLink>
          <MancatoKpi
            icon={EuroIcon}
            label="Total pendiente"
            value={formatCurrency(pendienteTotal)}
            detail="Mancato + multas"
            color="#2f8dff"
          />
        </div>
      </section>

      {/* Costo del mes: lo que se gasto y se pago en el mes elegido. */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle hint={data.esMesActual ? "Lo que va del mes" : undefined}>
            Costo de {monthName(month)}
          </SectionTitle>
          <MonthSelector month={month} onChange={setMonth} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <KpiLink to={isPrivileged ? "/finanzas/pagos" : "/mis-horas"}>
            <MancatoKpi
              icon={UsersIcon}
              label={isPrivileged ? "Pago a choferes" : "Mi pago del mes"}
              value={formatCurrency(mes.pagoChoferes.total)}
              deltaPct={mes.pagoChoferes.deltaPct}
              deltaLabel="vs. mes anterior"
              detail={`${mes.pagoChoferes.servicios} ${mes.pagoChoferes.servicios === 1 ? "servicio" : "servicios"}`}
              color={COSTO_COLORS.pagoChoferes}
            />
          </KpiLink>
          {mes.gastosServicios && (
            <KpiLink to="/finanzas/gastos">
              <MancatoKpi
                icon={TruckIcon}
                label="Gastos de servicios"
                value={formatCurrency(mes.gastosServicios.total)}
                deltaPct={mes.gastosServicios.deltaPct}
                deltaLabel="vs. mes anterior"
                detail={`${mes.gastosServicios.servicios} servicios con gastos`}
                color={COSTO_COLORS.gastosServicios}
              />
            </KpiLink>
          )}
          <KpiLink to="/finanzas/combustible">
            <MancatoKpi
              icon={FuelIcon}
              label="Combustible"
              value={formatCurrency(mes.combustible.total)}
              deltaPct={mes.combustible.deltaPct}
              deltaLabel="vs. mes anterior"
              detail={`${mes.combustible.cargas} ${mes.combustible.cargas === 1 ? "carga" : "cargas"}${
                mes.combustible.estimado > 0 ? ` + ${formatCurrency(mes.combustible.estimado)} estimado` : ""
              }`}
              color={COSTO_COLORS.combustible}
            />
          </KpiLink>
          <MancatoKpi
            icon={EuroIcon}
            label="Costo total del mes"
            value={formatCurrency(costoTotal)}
            detail={isPrivileged ? "Pagos + gastos + combustible" : "Tu pago + tu combustible"}
            color="#2f8dff"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <PanelShell icon={BarsIcon} title="Costo de los ultimos 6 meses">
            <div className="h-[260px]">
              <CostosChart data={serie} />
            </div>
            <p className="mt-2 text-[11px] text-ink-400">
              El pendiente de pago (mancato y multas) no entra en este grafico: es deuda abierta, no un
              gasto del mes.
            </p>
          </PanelShell>

          {mes.gastosServicios && mes.gastosServicios.porConcepto.length > 0 && (
            <DebtSummary
              icon={TruckIcon}
              title="Gastos de servicios por concepto"
              rows={mes.gastosServicios.porConcepto.map((c) => ({
                key: c.key,
                label: c.label,
                color: c.color,
                fg: "#ffffff",
                count: c.count,
                total: c.total,
              }))}
              total={mes.gastosServicios.total}
              unit={["servicio", "servicios"]}
              totalLabel={`Total ${data.mesLabel}`}
              emptyText="Sin gastos en este mes."
            />
          )}
        </div>

        <PanelShell icon={AlertTriangleIcon} title="Atencion requerida" className="h-fit">
          {atencion.length === 0 ? (
            <p className="py-2 text-[13px] text-ink-400">Todo al dia: no hay nada vencido ni por vencer.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {atencion.map((item) => (
                <li key={item.title}>
                  <Link
                    to={item.to}
                    className={clsx(
                      "flex items-center gap-3 rounded-xl border-l-4 bg-line/[0.05] px-4 py-3 transition-colors hover:bg-line/10",
                      TONE[item.tone].edge
                    )}
                  >
                    <span className={clsx("h-2 w-2 shrink-0 rounded-full", TONE[item.tone].dot)} />
                    <span className="min-w-0 flex-1 text-[13px] font-medium text-ink-50">{item.title}</span>
                    {item.total != null && (
                      <span className="shrink-0 text-[13px] font-semibold text-ink-50">
                        {formatCurrency(item.total)}
                      </span>
                    )}
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PanelShell>
      </div>

      <TarifasKmCard canEdit={canConfigureFinance(user)} />
    </div>
  );
};

// El chofer ve su propio resumen (sin el costo para la empresa); la oficina, el de Finanzas.
export const FinanzasResumenPage = () => {
  const { user } = useAuth();
  const isPrivileged = canManageFinance(user);
  // El chofer no tiene "Resumen" en Mis cargos: entra directo a Combustible (y sin importes de pago).
  return isPrivileged ? <ResumenOficinaPage /> : <Navigate to="/finanzas/combustible" replace />;
};
