import clsx from "clsx";
import { ArrowDownIcon, ArrowUpIcon, CalendarIcon, CheckCircleIcon, ClockIcon, FileTextIcon } from "../ui/icons";
import { DIA_ESTADOS, diaCellClassPro } from "../../lib/permisos";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

const XIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" {...props}>
    <path d="m7 7 10 10M17 7 7 17" />
  </svg>
);

const TONES = {
  green: { box: "border-success-500/50", icon: "bg-success-500 text-brand-foreground" },
  red: { box: "border-danger-500/50", icon: "bg-danger-500 text-white" },
  amber: { box: "border-warning-500/50", icon: "bg-warning-500/20 text-warning-500 ring-2 ring-warning-500" },
  blue: { box: "border-accent-400/40", icon: "bg-accent-500/20 text-accent-400" },
  violet: { box: "border-line/20", icon: "bg-line/10 text-ink-300" },
};

// Comparacion con el mes anterior (mismo tramo del mes si es el mes en curso). "goodWhen": hacia donde
// es bueno que vaya el numero.
const Delta = ({ cur, prev, goodWhen }) => {
  if (cur == null || prev == null) return <span className="mt-1 block text-[11px] text-ink-400">&nbsp;</span>;
  const diff = cur - prev;
  const pct = prev > 0 ? Math.round((diff / prev) * 100) : null;
  const text = pct != null ? `${diff > 0 ? "+" : ""}${pct}%` : diff === 0 ? "" : `${diff > 0 ? "+" : ""}${diff}`;
  const good = goodWhen === "up" ? diff > 0 : goodWhen === "down" ? diff < 0 : null;
  const bad = goodWhen === "up" ? diff < 0 : goodWhen === "down" ? diff > 0 : null;
  const color = diff === 0 ? "text-ink-400" : good ? "text-success-500" : bad ? "text-danger-500" : "text-ink-300";
  return (
    <span className="mt-1 flex items-center gap-0.5 text-[10px] text-ink-400 sm:gap-1 sm:text-[11px]">
      {diff === 0 ? (
        <span>=</span>
      ) : (
        <span className={clsx("flex items-center font-semibold", color)}>
          {diff > 0 ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />}
          {text}
        </span>
      )}
      <span className="hidden truncate sm:inline">vs. mes anterior</span>
    </span>
  );
};

const Tile = ({ label, value, tone, icon: Icon, cur, prev, goodWhen }) => (
  <div className={clsx("min-w-0 rounded-2xl border bg-line/[0.03] p-2 sm:p-3", TONES[tone].box)}>
    <span className={clsx("flex h-7 w-7 items-center justify-center rounded-full sm:h-9 sm:w-9", TONES[tone].icon)}>
      <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
    </span>
    <span className="mt-1.5 block text-[22px] font-semibold leading-none text-ink-50 sm:mt-2 sm:text-[28px]">{value}</span>
    <span className="mt-1 block break-words text-[10px] leading-tight text-ink-200 sm:text-[13px]">{label}</span>
    <Delta cur={cur} prev={prev} goodWhen={goodWhen} />
  </div>
);

const countUntil = (data, estado, cutoff) =>
  data ? data.days.filter((d) => d.estado === estado && Number(d.fecha.slice(8)) <= cutoff).length : null;

const LEGEND = [
  ["TRABAJADO", "Trabajado"],
  ["NO_TRABAJADO", "No trabajado"],
  ["JUSTIFICADO", "Justificado (aprobado)"],
  ["PERMISO_PENDIENTE", "Permiso en revision"],
  ["DESCANSO", "Dia libre"],
];

// Resumen del mes + cuadricula, con el estilo del dashboard del chofer. "prev" es el calendario del
// mes anterior (puede faltar).
export const CalendarioChofer = ({ data, prev, selected, onSelect }) => {
  const [year, month] = data.month.split("-").map(Number);
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const { summary } = data;

  // Cuantos dias del mes anterior comparar: el mismo tramo si es el mes en curso, todo si ya paso.
  const todayMonth = data.today.slice(0, 7);
  const cutoff = data.month === todayMonth ? Number(data.today.slice(8)) : data.month < todayMonth ? 31 : null;
  const cmp = (estado) =>
    cutoff == null
      ? { cur: null, prev: null }
      : { cur: countUntil(data, estado, cutoff), prev: countUntil(prev, estado, cutoff) };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
        <Tile label="Trabajados" value={summary.trabajados} tone="green" icon={CheckCircleIcon} goodWhen="up" {...cmp("TRABAJADO")} />
        <Tile label="No trabajados" value={summary.noTrabajados} tone="red" icon={XIcon} goodWhen="down" {...cmp("NO_TRABAJADO")} />
        <Tile label="Justificados" value={summary.justificados} tone="amber" icon={ClockIcon} {...cmp("JUSTIFICADO")} />
        <Tile label="En revision" value={summary.pendientes} tone="blue" icon={CalendarIcon} {...cmp("PERMISO_PENDIENTE")} />
        <Tile label="Dias libres" value={summary.descansos} tone="violet" icon={FileTextIcon} {...cmp("DESCANSO")} />
      </div>

      <p className="-mt-2 text-[11px] text-ink-400 sm:hidden">Las flechas comparan con el mes anterior.</p>

      <div className="glass-surface rounded-3xl p-3.5 sm:p-5">
        <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[12px] font-medium text-ink-300 sm:gap-2">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {Array.from({ length: offset }, (_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {data.days.map((dia) => (
            <button
              key={dia.fecha}
              type="button"
              onClick={() => onSelect?.(dia)}
              aria-label={`${dia.fecha}: ${DIA_ESTADOS[dia.estado].label || "sin datos"}`}
              className={diaCellClassPro(dia, selected === dia.fecha, dia.fecha === data.today)}
            >
              {Number(dia.fecha.slice(8))}
              {dia.servicios > 1 && dia.estado === "TRABAJADO" && (
                <span className="absolute bottom-0.5 text-[9px] font-medium opacity-80">{dia.servicios}</span>
              )}
              {dia.completo && <span className="absolute bottom-1 h-0.5 w-5 rounded bg-danger-500" aria-hidden="true" />}
              {dia.estado === "PROGRAMADO" && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent-400" />}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-surface-sm flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl px-4 py-3 text-[13px] text-ink-200">
        {LEGEND.map(([key, label]) => (
          <span key={key} className="inline-flex items-center gap-2">
            <span className={clsx("h-3 w-3 rounded-full", DIA_ESTADOS[key].dot)} />
            {label}
          </span>
        ))}
        {data.tope && (
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 rounded bg-danger-500" />
            Dia completo (sin cupo)
          </span>
        )}
      </div>
    </div>
  );
};
