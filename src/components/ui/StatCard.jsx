import clsx from "clsx";

const TONE_CLASSES = {
  default: "text-ink-50",
  amber: "text-status-rischedulato",
  blue: "text-accent-300",
  green: "text-success-500",
  red: "text-danger-500",
};

// deltaPct: variacion porcentual vs. el periodo anterior equivalente (ej: "+8.4%
// vs ayer"). Se omite si es null (sin base de comparacion, ej. periodo anterior en 0).
export const StatCard = ({ label, value, sublabel, deltaPct, deltaLabel, tone = "default", className }) => (
  <div className={clsx("glass-surface-sm @container rounded-xl px-4 py-4", className)}>
    <span className="block text-[12px] uppercase tracking-wide text-ink-400">{label}</span>
    <span className={clsx("mt-1 block text-[clamp(18px,11cqw,24px)] font-semibold", TONE_CLASSES[tone])}>
      {value}
    </span>
    {deltaPct != null ? (
      <span
        className={clsx(
          "mt-0.5 block text-[12px] font-medium",
          deltaPct >= 0 ? "text-success-500" : "text-danger-500"
        )}
      >
        {deltaPct >= 0 ? "+" : ""}
        {deltaPct.toFixed(1)}% {deltaLabel}
      </span>
    ) : (
      sublabel && <span className="mt-0.5 block text-[12px] text-ink-400">{sublabel}</span>
    )}
  </div>
);
