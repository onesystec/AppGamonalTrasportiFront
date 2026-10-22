import clsx from "clsx";
import { Link } from "react-router-dom";
import { CalendarIcon, CheckCircleIcon, ChevronRightIcon, ClockIcon, RouteIcon } from "../ui/icons";

const XCircleIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </svg>
);

const TONES = {
  blue: { box: "border-accent-400/40", icon: "bg-accent-500/15 text-accent-400", value: "text-accent-300" },
  amber: { box: "border-warning-500/40", icon: "bg-warning-500/15 text-warning-500", value: "text-warning-500" },
  green: { box: "border-success-500/40", icon: "bg-success-500/15 text-success-500", value: "text-success-500" },
  red: { box: "border-danger-500/40", icon: "bg-danger-500/15 text-danger-500", value: "text-danger-500" },
};

const Tile = ({ label, value, tone, icon: Icon }) => {
  const t = TONES[tone];
  return (
    <div className={clsx("flex items-center gap-2.5 rounded-2xl border bg-line/[0.03] px-3 py-3.5", t.box)}>
      <span className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", t.icon)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 leading-tight">
        <span className="block truncate text-[10.5px] font-medium uppercase tracking-normal text-ink-300">{label}</span>
        <span className={clsx("block text-[30px] font-semibold leading-none", t.value)}>{value}</span>
        <span className="mt-0.5 block text-[12px] text-ink-300">{value === 1 ? "servicio" : "servicios"}</span>
      </div>
    </div>
  );
};

export const ResumenServiciosCard = ({ counts }) => (
  <section className="glass-surface rounded-3xl p-5 sm:p-7">
    <h2 className="flex items-center gap-3 text-[20px] font-semibold text-ink-50">
      <RouteIcon className="h-6 w-6 text-accent-400" />
      Mis servicios
    </h2>

    <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Tile label="Hoy" value={counts.hoy} tone="blue" icon={CalendarIcon} />
      <Tile label="Pendientes" value={counts.pendientes} tone="amber" icon={ClockIcon} />
      <Tile label="Completados" value={counts.completados} tone="green" icon={CheckCircleIcon} />
      <Tile label="Cancelados" value={counts.cancelados} tone="red" icon={XCircleIcon} />
    </div>

    <Link
      to="/mis-servicios"
      className="mt-4 flex items-center justify-between gap-3 text-[14px] font-medium text-accent-400 hover:text-accent-300"
    >
      <span className="flex items-center gap-2.5">
        <ClockIcon className="h-5 w-5" />
        Ver historial completo &rarr;
      </span>
      <ChevronRightIcon className="h-5 w-5 text-ink-400" />
    </Link>
  </section>
);
