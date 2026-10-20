import clsx from "clsx";
import { ArrowDownIcon, ArrowUpIcon, BulbIcon, ReceiptIcon, TrendIcon } from "../ui/icons";
import { PanelShell } from "../ui/PanelShell";
import { formatCurrency } from "../../lib/format";
import { MancatoDebtChart } from "./MancatoDebtChart";

// Colores de las barras, de mayor a menor deuda: rojo (lo mas grave), naranja, azul y gris.
const BAR_COLORS = ["#ff3b57", "#ff8a1a", "#2f8dff", "#8ea3c9", "#8ea3c9"];

const AVATAR_COLORS = ["#ff3b57", "#ff8a1a", "#2f8dff", "#a78bfa", "#22d3ee"];

const initials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const hashColor = (name) =>
  AVATAR_COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];

// Deuda por chofer (OWNER/ADMIN) o por estado (chofer): nombre, cantidad, importe y una
// barra proporcional al mayor.
export const DebtSummary = ({
  rows,
  total,
  unit = ["aviso", "avisos"],
  title = "Resumen de deudas",
  totalLabel = "Total por pagar",
  emptyText = "No hay deuda abierta.",
  icon = ReceiptIcon,
}) => {
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <PanelShell
      icon={icon}
      title={title}
      aside={
        <span className="text-right text-[11px] text-ink-400">
          {totalLabel}
          <span className="block text-[15px] font-semibold text-ink-50">{formatCurrency(total)}</span>
        </span>
      }
    >
      {rows.length === 0 ? (
        <p className="py-4 text-[13px] text-ink-400">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row, index) => (
            <li key={row.key} className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                style={{
                  backgroundColor: row.color ?? (row.isOtros ? "#64748b" : hashColor(row.label)),
                  color: row.fg,
                }}
              >
                {row.isOtros ? "…" : initials(row.label)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[14px] font-medium text-ink-50">{row.label}</span>
                  <span className="shrink-0 text-[14px] font-semibold text-ink-50">
                    {formatCurrency(row.total)}
                  </span>
                </div>
                <span className="block text-[12px] text-ink-400">
                  {row.count} {row.count === 1 ? unit[0] : unit[1]}
                </span>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(4, (row.total / max) * 100)}%`,
                      backgroundColor: row.color ?? BAR_COLORS[index] ?? BAR_COLORS.at(-1),
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
};

export const Evolution = ({
  serie,
  deltaPct,
  title = "Evolucion de la deuda",
  valueLabel = "Por pagar",
  note = "Deuda sin pagar al cierre de cada mes. La variacion compara el mes en curso con el anterior.",
}) => (
  <PanelShell
    icon={TrendIcon}
    title={title}
    aside={
      deltaPct != null && (
        <span
          className={clsx(
            "flex items-center gap-1 text-[12px] font-semibold",
            deltaPct > 0 ? "text-danger-500" : "text-success-500"
          )}
        >
          {deltaPct > 0 ? <ArrowUpIcon className="h-3.5 w-3.5" /> : <ArrowDownIcon className="h-3.5 w-3.5" />}
          {Math.abs(deltaPct).toFixed(0)}%
        </span>
      )
    }
  >
    <div className="h-[170px]">
      <MancatoDebtChart data={serie} valueLabel={valueLabel} />
    </div>
    <p className="mt-2 text-[11px] text-ink-400">{note}</p>
  </PanelShell>
);

// Mensaje y accion segun lo mas urgente que haya.
const buildRecommendation = (r) => {
  if (r.vencidosMasDe30Dias > 0) {
    return {
      text: `Tienes ${r.vencidosMasDe30Dias} ${r.vencidosMasDe30Dias === 1 ? "aviso vencido" : "avisos vencidos"} hace mas de 30 dias.`,
      detail: "Regularizalos cuanto antes y sube el comprobante para dejar el control al dia.",
      filter: "VENCIDO",
    };
  }
  if (r.vencidos > 0) {
    return {
      text: `Tienes ${r.vencidos} ${r.vencidos === 1 ? "aviso vencido" : "avisos vencidos"} por ${formatCurrency(r.totalVencido)}.`,
      detail: "Pagalos y sube el comprobante para dejarlos al dia.",
      filter: "VENCIDO",
    };
  }
  if (r.porVencer3Dias > 0) {
    return {
      text: `${r.porVencer3Dias} ${r.porVencer3Dias === 1 ? "aviso vence" : "avisos vencen"} en los proximos 3 dias.`,
      detail: "Pagalos a tiempo para que no pasen a vencidos.",
      filter: "PENDIENTE",
    };
  }
  return {
    text: "Todo al dia.",
    detail: "No hay avisos vencidos ni por vencer en los proximos 3 dias.",
    filter: null,
  };
};

const Recommendation = ({ data, onSeeDetails }) => {
  const rec = buildRecommendation(data);
  const urgent = rec.filter != null;
  return (
    <section
      className={clsx(
        "rounded-2xl border p-5",
        urgent ? "border-warning-500/50 bg-warning-500/[0.06]" : "border-success-500/30 bg-success-500/[0.05]"
      )}
    >
      <div className="flex items-start gap-3">
        <BulbIcon className={clsx("mt-0.5 h-5 w-5 shrink-0", urgent ? "text-warning-500" : "text-success-500")} />
        <div className="min-w-0">
          <h2 className={clsx("text-[15px] font-semibold", urgent ? "text-warning-500" : "text-success-500")}>
            Recomendacion
          </h2>
          <p className="mt-1 text-[14px] font-medium text-ink-50">{rec.text}</p>
          <p className="mt-1 text-[13px] text-ink-300">{rec.detail}</p>
        </div>
      </div>
      {urgent && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => onSeeDetails(rec.filter)}
            className="rounded-full glass-input px-4 py-1.5 text-[13px] font-medium text-ink-50 hover:bg-line/10"
          >
            Ver detalles &rarr;
          </button>
        </div>
      )}
    </section>
  );
};

// Columna derecha de Mancato Pagamento: deuda por chofer, evolucion y recomendacion.
export const MancatoSidebar = ({ stats, summary, isPrivileged, onSeeDetails, className }) => {
  if (!stats) return null;

  // OWNER/ADMIN ven la deuda abierta por chofer; el chofer la ve por estado.
  const rows = isPrivileged
    ? stats.porChofer.map((c) => ({
        key: c.driverId ?? "otros",
        label: c.nombre,
        count: c.count,
        total: c.total,
        isOtros: !c.driverId,
      }))
    : [
        { key: "VENCIDO", label: "Vencidos", color: "#ff3b57", ...summary?.VENCIDO },
        { key: "PENDIENTE", label: "Pendientes", color: "#ff8a1a", ...summary?.PENDIENTE },
      ].filter((r) => r.count > 0);

  return (
    <aside className={clsx("flex flex-col gap-5", className)}>
      <DebtSummary rows={rows} total={stats.totalPorPagar} />
      <Evolution serie={stats.serie} deltaPct={stats.serieDeltaPct} />
      <Recommendation data={stats.recomendacion} onSeeDetails={onSeeDetails} />
    </aside>
  );
};
