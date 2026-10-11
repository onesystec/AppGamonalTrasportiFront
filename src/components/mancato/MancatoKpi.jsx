import clsx from "clsx";
import { ArrowDownIcon, ArrowUpIcon } from "../ui/icons";

// Tarjeta de indicador (icono a la izquierda, etiqueta, valor grande y una linea de
// detalle). En Mancato Pagamento mas deuda es malo: si `deltaPct` sube se pinta en rojo y
// si baja en verde (al reves que en el dashboard de facturacion).
export const MancatoKpi = ({ icon: Icon, label, value, detail, deltaPct, deltaLabel, color }) => (
  <div className="glass-surface @container flex items-center gap-4 rounded-2xl p-3.5 sm:p-5">
    <span
      className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl @[24rem]:flex"
      style={{ color, backgroundColor: `${color}26`, boxShadow: `inset 0 0 0 1px ${color}40` }}
    >
      <Icon className="h-6 w-6" />
    </span>
    <div className="min-w-0 flex-1">
      <span className="block truncate text-[13px] font-medium text-ink-300">{label}</span>
      <span className="mt-0.5 block text-[clamp(17px,11cqw,26px)] font-semibold leading-tight text-ink-50">
        {value}
      </span>
      {deltaPct != null ? (
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px]">
          <span
            className={clsx(
              "flex items-center gap-0.5 font-semibold",
              deltaPct > 0 ? "text-danger-500" : "text-success-500"
            )}
          >
            {deltaPct > 0 ? <ArrowUpIcon className="h-3.5 w-3.5" /> : <ArrowDownIcon className="h-3.5 w-3.5" />}
            {deltaPct > 0 ? "+" : ""}
            {deltaPct.toFixed(1)}%
          </span>
          <span className="text-ink-400">{deltaLabel}</span>
        </span>
      ) : (
        <span className="mt-0.5 block text-[12px] text-ink-400">{detail}</span>
      )}
    </div>
  </div>
);
