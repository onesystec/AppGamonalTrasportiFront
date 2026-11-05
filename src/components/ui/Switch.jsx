import clsx from "clsx";

export const Switch = ({ id, label, description, checked, onChange, disabled, small = false }) => (
  <div className="flex items-center justify-between gap-4">
    <div className="min-w-0">
      {label && (
        <label htmlFor={id} className="block text-[14px] font-medium text-ink-50">
          {label}
        </label>
      )}
      {description && <p className="mt-0.5 text-[12px] text-ink-400">{description}</p>}
    </div>
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-success-500/30",
        small ? "h-5 w-9" : "h-7 w-12",
        checked ? "bg-success-500" : "bg-line/15",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      )}
    >
      <span
        className={clsx(
          "inline-block transform rounded-full bg-white shadow-md transition-transform duration-200",
          small ? "h-3.5 w-3.5" : "h-5 w-5",
          small ? (checked ? "translate-x-[18px]" : "translate-x-[3px]") : checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  </div>
);
