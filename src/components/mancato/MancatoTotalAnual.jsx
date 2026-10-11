import { formatCurrency } from "../../lib/format";
import { EuroIcon } from "../ui/icons";

const COLOR = "#2dd4bf";

const avisos = (n) => `${n} ${n === 1 ? "aviso" : "avisos"}`;

// Total de mancatos del año en curso: todo lo registrado (no solo lo gastado) y como se reparte entre pagado y por pagar.
// Con un mes o rango elegido muestra ese periodo debajo y deja el total del año como referencia.
export const MancatoTotalAnual = ({ totales, periodoLabel }) => {
  const { anio, anual, periodo } = totales;
  const pctPagado = anual.total > 0 ? Math.round((anual.pagado / anual.total) * 100) : 0;

  return (
    <div className="glass-surface @container flex flex-col gap-4 rounded-2xl p-3.5 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
      <div className="flex items-center gap-4 sm:min-w-[240px]">
        <span
          className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl sm:flex"
          style={{ color: COLOR, backgroundColor: `${COLOR}26`, boxShadow: `inset 0 0 0 1px ${COLOR}40` }}
        >
          <EuroIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-ink-300">Total {anio}</span>
          <span className="mt-0.5 block text-[clamp(19px,6cqw,26px)] font-semibold leading-tight text-ink-50">
            {formatCurrency(anual.total)}
          </span>
          <span className="mt-0.5 block text-[12px] text-ink-400">{avisos(anual.count)} registrados en el año</span>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div
          className="flex h-2.5 overflow-hidden rounded-full bg-danger-500/25"
          role="img"
          aria-label={`${pctPagado}% pagado`}
        >
          <div className="h-full bg-success-500" style={{ width: `${pctPagado}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[12px]">
          <span className="text-ink-300">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-success-500" />
            Pagado <strong className="font-semibold text-ink-50">{formatCurrency(anual.pagado)}</strong>
          </span>
          <span className="text-ink-300">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-danger-500" />
            Por pagar <strong className="font-semibold text-ink-50">{formatCurrency(anual.porPagar)}</strong>
          </span>
        </div>
        {periodo && (
          <p className="mt-2.5 border-t border-line/10 pt-2 text-[12px] text-ink-300">
            {periodoLabel || "Periodo elegido"}:{" "}
            <strong className="font-semibold text-ink-50">{formatCurrency(periodo.total)}</strong> · {avisos(periodo.count)}
            {" · "}pagado {formatCurrency(periodo.pagado)} · por pagar {formatCurrency(periodo.porPagar)}
          </p>
        )}
      </div>
    </div>
  );
};
