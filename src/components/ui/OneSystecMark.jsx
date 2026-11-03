import clsx from "clsx";
import { useT } from "../../i18n/index.jsx";

// Firma de OneSystec: logo + "by OneSystec" (variante "by", para barras con poco espacio) o "Hecho por OneSystec" (variante "madeBy").
// Es solo un texto, sin enlace. No define el display (lo pone quien lo usa: flex, hidden sm:flex...).
// tone="sidebar": para los menus laterales de fondo azul marino fijo (no cambian con el tema). logoOnly: solo el logo (menu reducido a iconos).
export const OneSystecMark = ({ variant = "by", tone = "page", logoOnly = false, className }) => {
  const t = useT();
  const prefix = variant === "madeBy" ? t("firma.madeBy") : "by";
  const label = `${prefix} OneSystec`;

  return (
    <span className={clsx("items-center gap-1.5 whitespace-nowrap text-xs", className)} title={logoOnly ? label : undefined}>
      <img src="/onesystec-logo.jpg" alt="" aria-hidden="true" className="h-4 w-4 shrink-0 rounded object-cover" />
      {!logoOnly && (
        <span className={tone === "sidebar" ? "text-sidebar-foreground/50" : "text-slate-400 dark:text-slate-500"}>
          {prefix}{" "}
          <span className={clsx("font-semibold", tone === "sidebar" ? "text-sidebar-foreground/90" : "text-slate-600 dark:text-slate-300")}>OneSystec</span>
        </span>
      )}
    </span>
  );
};
