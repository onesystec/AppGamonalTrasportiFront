import clsx from "clsx";

// Indicador de las paginas de lista (Vehiculos, Choferes): icono tintado, numero
// grande, etiqueta y detalle. El color significa estado: verde = correcto/activo,
// naranja = atencion, rojo = problema real, azul = informacion neutral.
export const StatTile = ({ icon: Icon, value, label, detail, tone = "neutral" }) => (
  <div
    className={clsx(
      "glass-surface @container flex items-center gap-3 rounded-2xl p-4",
      tone === "warning" && "border-warning-500/50 shadow-[0_0_24px_-10px_var(--warning-500)]",
      tone === "danger" && "border-danger-500/50 shadow-[0_0_24px_-10px_var(--danger-500)]"
    )}
  >
    <span
      className={clsx(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1",
        tone === "success" && "bg-success-500/15 text-success-500 ring-success-500/30",
        tone === "warning" && "bg-warning-500/20 text-warning-500 ring-warning-500/60",
        tone === "danger" && "bg-danger-500/20 text-danger-500 ring-danger-500/60",
        tone === "neutral" && "bg-accent-500/15 text-accent-400 ring-accent-500/30"
      )}
    >
      <Icon className="h-5 w-5" />
    </span>
    <div className="min-w-0 flex-1">
      <div
        className={clsx(
          "text-[clamp(20px,9cqw,26px)] font-semibold leading-none tracking-tight",
          tone === "warning" ? "text-warning-500" : tone === "danger" ? "text-danger-500" : "text-ink-50"
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-[13px] leading-tight text-ink-200">{label}</div>
      {detail && <div className="mt-0.5 text-[12px] text-ink-400">{detail}</div>}
    </div>
  </div>
);
