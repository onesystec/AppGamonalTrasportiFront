import clsx from "clsx";

// En pantallas angostas, si las opciones no caben, se desplazan hacia el costado dentro del control (sin ensanchar la pagina).
export const SegmentedControl = ({ options, value, onChange, className }) => (
  <div
    className={clsx(
      "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full glass-surface-sm p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      className
    )}
  >
    {options.map((opt) => (
      <button
        key={opt.value}
        type="button"
        onClick={() => onChange(opt.value)}
        className={clsx(
          "shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
          value === opt.value ? "bg-line/15 text-ink-50" : "text-ink-300 hover:text-ink-50"
        )}
      >
        {opt.label}
      </button>
    ))}
  </div>
);
