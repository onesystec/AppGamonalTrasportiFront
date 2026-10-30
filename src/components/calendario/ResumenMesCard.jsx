import { monthName } from "../../lib/finanzas";

const Tile = ({ label, value, total, color }) => (
  <div className="rounded-2xl border border-line/10 bg-line/[0.03] p-3">
    <span className="flex items-center gap-2 text-[12px] text-ink-300">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
    <span className="mt-1.5 block text-[24px] font-semibold leading-none text-ink-50">{value}</span>
    <span className="mt-1 block text-[11px] text-ink-400">({total ? Math.round((value / total) * 100) : 0}%)</span>
  </div>
);

// Resumen del mes de un chofer: dias trabajados, libres, justificados y no trabajados, con el
// porcentaje sobre los dias del mes.
export const ResumenMesCard = ({ data }) => {
  const total = data.days.length;
  const s = data.summary;
  return (
    <section className="glass-surface rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[16px] font-semibold text-ink-50">Resumen del mes</h2>
        <span className="text-[12px] capitalize text-ink-300">{monthName(data.month)}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Tile label="Dias trabajados" value={s.trabajados} total={total} color="#22e093" />
        <Tile label="Dias libres" value={s.descansos} total={total} color="#94a3b8" />
        <Tile label="Dias justificados" value={s.justificados} total={total} color="#ff8a1a" />
        <Tile label="Dias no trabajados" value={s.noTrabajados} total={total} color="#ff3b57" />
      </div>
    </section>
  );
};
