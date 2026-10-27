import { formatCurrency } from "../../lib/format";

const avisos = (n) => `${n} ${n === 1 ? "aviso" : "avisos"}`;

// Total de mancatos del año en curso, en una tira baja: total, barra pagado / por pagar y los dos importes.
// Con un mes o rango elegido muestra ese periodo debajo y deja el total del año como referencia.
export const MancatoTotalAnual = ({ totales, periodoLabel }) => {
  const { anio, anual, periodo } = totales;
  const pctPagado = anual.total > 0 ? Math.round((anual.pagado / anual.total) * 100) : 0;

  return (
    <div className="glass-surface-sm rounded-2xl px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-[13px] text-ink-300">
          Total {anio} <strong className="ml-1 text-[15px] font-semibold text-ink-50">{formatCurrency(anual.total)}</strong>
          <span className="ml-1.5 text-[12px] text-ink-400">· {avisos(anual.count)}</span>
        </span>
        <div
          className="flex h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-danger-500/25"
          role="img"
          aria-label={`${pctPagado}% pagado`}
        >
          <div className="h-full bg-success-500" style={{ width: `${pctPagado}%` }} />
        </div>
        <span className="text-[12px] text-ink-300">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-success-500" />
          Pagado <strong className="font-semibold text-ink-50">{formatCurrency(anual.pagado)}</strong>
        </span>
        <span className="text-[12px] text-ink-300">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-danger-500" />
          Por pagar <strong className="font-semibold text-ink-50">{formatCurrency(anual.porPagar)}</strong>
        </span>
      </div>
      {periodo && (
        <p className="mt-1.5 border-t border-line/10 pt-1.5 text-[12px] text-ink-300">
          {periodoLabel || "Periodo elegido"}:{" "}
          <strong className="font-semibold text-ink-50">{formatCurrency(periodo.total)}</strong> · {avisos(periodo.count)}
          {" · "}pagado {formatCurrency(periodo.pagado)} · por pagar {formatCurrency(periodo.porPagar)}
        </p>
      )}
    </div>
  );
};
