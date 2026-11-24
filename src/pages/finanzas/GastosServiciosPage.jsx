import { FinanceRecordLink } from "../../components/finanzas/FinanceRecordLink";
import { canManageFinance } from "../../lib/financeAccess";
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { MonthSelector } from "../../components/finanzas/MonthSelector";
import { MancatoKpi } from "../../components/mancato/MancatoKpi";
import { DebtSummary } from "../../components/mancato/MancatoSidebar";
import { Alert } from "../../components/ui/Alert";
import { PageLoader } from "../../components/ui/PageLoader";
import { AlertTriangleIcon, EuroIcon, FileTextIcon, TruckIcon } from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { COSTO_COLORS, currentMonth, monthName } from "../../lib/finanzas";
import { getGastosServiciosRequest } from "../../lib/finanzas.api";
import { formatCurrency, formatDate } from "../../lib/format";

export const GastosServiciosPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isPrivileged = canManageFinance(user);

  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isPrivileged) return undefined;
    let cancelled = false;
    setData(null);
    getGastosServiciosRequest(month)
      .then((gastos) => {
        if (!cancelled) {
          setData(gastos);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [month, isPrivileged]);

  // Son datos economicos del servicio: el chofer no los ve (igual que en Registros).
  if (!isPrivileged) return <Navigate to="/finanzas" replace />;

  const principal = data?.porConcepto[0];
  const conceptoLabel = (key) => data.porConcepto.find((c) => c.key === key)?.label ?? key;
  const conceptoColor = (key) => data.porConcepto.find((c) => c.key === key)?.color ?? "#8ea3c9";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[14px] text-ink-300">
          Peajes, Area C, traforos, vignetta, hotel y otros gastos cargados en los servicios del mes.
        </p>
        <MonthSelector month={month} onChange={setMonth} />
      </div>

      <Alert>{error}</Alert>
      {!data && !error && <PageLoader />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
            <MancatoKpi
              icon={EuroIcon}
              label={`Gastos de ${monthName(month)}`}
              value={formatCurrency(data.total)}
              detail="Suma de todos los conceptos"
              color={COSTO_COLORS.gastosServicios}
            />
            <MancatoKpi
              icon={FileTextIcon}
              label="Servicios con gastos"
              value={data.servicios}
              detail="Con algun gasto cargado"
              color="#2f8dff"
            />
            <MancatoKpi
              icon={TruckIcon}
              label="Concepto principal"
              value={principal?.label ?? "-"}
              detail={principal ? formatCurrency(principal.total) : "Sin gastos este mes"}
              color="#a78bfa"
            />
          </div>

          {data.combustibleRevisar.length > 0 && (
            <section className="rounded-2xl border border-warning-500/40 bg-warning-500/[0.05] p-4 sm:p-5">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-warning-500">
                <AlertTriangleIcon className="h-4 w-4" />
                Combustible a auditar ({data.combustibleRevisar.length})
              </h2>
              <p className="mt-1 text-[12px] text-ink-300">
                En estos servicios el combustible cargado a mano es casi el doble (o mas) de lo que suman los
                comprobantes. Se cuentan los comprobantes; revisa si falta subir alguno o si el valor a mano
                esta inflado. Ultimos 6 meses.
              </p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {data.combustibleRevisar.map((item) => (
                  <li key={item.id}>
                    <FinanceRecordLink
                      to={`/records/${item.id}`}
                      state={{ backgroundLocation: location }}
                      className="flex flex-wrap items-center gap-x-4 gap-y-0.5 rounded-lg bg-line/[0.06] px-3 py-2 text-[13px] transition-colors hover:bg-line/10"
                    >
                      <span className="font-medium text-ink-50">{item.codigo}</span>
                      <span className="text-ink-400">{formatDate(item.fecha)}</span>
                      <span className="min-w-0 truncate text-ink-300">
                        {[item.cliente, item.driver].filter(Boolean).join(" - ")}
                      </span>
                      <span className="ml-auto flex items-center gap-3">
                        <span className="text-ink-300">
                          A mano <b className="text-warning-500">{formatCurrency(item.manual)}</b>
                        </span>
                        <span className="text-ink-300">
                          Comprobantes{" "}
                          <b className="text-ink-50">
                            {formatCurrency(item.comprobantes)} ({item.cargas})
                          </b>
                        </span>
                      </span>
                    </FinanceRecordLink>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="glass-surface min-w-0 rounded-2xl p-2 sm:p-3">
              {data.items.length === 0 ? (
                <p className="px-3 py-6 text-[14px] text-ink-400">No hay gastos cargados en este mes.</p>
              ) : (
                <>
                  <div className="hidden gap-3 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-400 lg:grid lg:grid-cols-[90px_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.3fr)_90px]">
                    <span>Fecha</span>
                    <span>Servicio</span>
                    <span>Chofer</span>
                    <span>Conceptos</span>
                    <span className="text-right">Total</span>
                  </div>
                  {data.items.map((item) => (
                    <FinanceRecordLink
                      key={item.id}
                      to={`/records/${item.id}`}
                      state={{ backgroundLocation: location }}
                      className="grid grid-cols-1 gap-1.5 rounded-lg px-4 py-2.5 transition-colors hover:bg-line/[0.07] lg:grid-cols-[90px_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.3fr)_90px] lg:items-center lg:gap-3 lg:border-b lg:border-b-line/10"
                    >
                      <span className="text-[13px] text-ink-50">{formatDate(item.fecha)}</span>
                      <div className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink-50">{item.codigo}</span>
                        <span className="block truncate text-[12px] text-ink-400">
                          {[item.cliente, item.destinazione].filter(Boolean).join(" - ")}
                        </span>
                      </div>
                      <span className="min-w-0 truncate text-[13px] text-ink-300">{item.driver ?? "-"}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(item.conceptos).map(([key, amount]) => (
                          <span
                            key={key}
                            className="inline-flex items-center gap-1.5 rounded-full bg-line/10 px-2 py-0.5 text-[11px] text-ink-200"
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: conceptoColor(key) }} />
                            {conceptoLabel(key)} {formatCurrency(amount)}
                          </span>
                        ))}
                      </div>
                      <span className="text-[14px] font-semibold text-ink-50 lg:text-right">
                        {formatCurrency(item.total)}
                      </span>
                    </FinanceRecordLink>
                  ))}
                </>
              )}
            </section>

            <DebtSummary
              icon={TruckIcon}
              title="Por concepto"
              rows={data.porConcepto.map((c) => ({
                key: c.key,
                label: c.label,
                color: c.color,
                fg: "#ffffff",
                count: c.count,
                total: c.total,
              }))}
              total={data.total}
              unit={["servicio", "servicios"]}
              totalLabel={`Total ${data.mesLabel}`}
              emptyText="Sin gastos en este mes."
            />
          </div>

          <p className="px-1 text-[12px] text-ink-400">
            No incluye el cobro por espera (es lo que se le cobra al cliente) ni el combustible del servicio:
            el combustible se toma de la pestaña Combustible, con sus comprobantes, para no contarlo dos veces.
          </p>
        </>
      )}
    </div>
  );
};
