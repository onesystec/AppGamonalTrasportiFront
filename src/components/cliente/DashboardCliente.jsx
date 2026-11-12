import clsx from "clsx";
import { AreaBadge } from "../records/AreaBadge";
import { PanelShell } from "../ui/PanelShell";
import { BarsIcon, ClockIcon } from "../ui/icons";
import { useLanguage, useT } from "../../i18n/index.jsx";
import { horaRoma } from "../../lib/seguimiento";
import { AREAS, RetrasoPill } from "./RegistroLista";

// Piezas del Dashboard del cliente (Piazza): los indicadores del mes, el resumen por area y los servicios que quedan pendientes hoy. Antes el resumen y los
// pendientes estaban en la columna derecha del Registro; aqui tienen su propio espacio y el Registro queda a todo el ancho.

const TONOS = {
  neutro: "text-ink-50",
  bien: "text-success-500",
  aviso: "text-warning-500",
  malo: "text-danger-500",
  info: "text-accent-300",
};

// Un indicador: icono, numero grande y una etiqueta (con una nota opcional debajo).
export const KpiTarjeta = ({ icon: Icon, label, value, nota, tono = "neutro", onClick }) => {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={clsx("glass-surface flex flex-col gap-2 rounded-2xl p-4 text-left", onClick && "transition-colors hover:bg-line/[0.05]")}
    >
      <span className="flex items-center gap-2 text-[12px] font-medium text-ink-300">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className={clsx("text-[26px] font-semibold leading-none", TONOS[tono])}>{value}</span>
      {nota && <span className="text-[11px] text-ink-400">{nota}</span>}
    </Tag>
  );
};

// Servicios del mes por area (cada una filtra los pendientes de hoy) y el total del mes con sus km.
export const ResumenMes = ({ stats, total, totalKm, areaKey, onArea }) => {
  const t = useT();
  const { language } = useLanguage();
  const cuenta = (count) => t("reg.serviceCount", { count });
  return (
    <PanelShell icon={BarsIcon} title={t("reg.monthSummary")}>
      <div className="grid grid-cols-2 gap-2.5">
        {AREAS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => onArea(areaKey === a.key ? null : a.key)}
            className={clsx(
              "flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors hover:bg-line/[0.05]",
              areaKey === a.key ? "border-accent-500/50 bg-accent-500/10" : "border-line/10"
            )}
          >
            <AreaBadge areaKey={a.key} size={30} />
            <span className="min-w-0">
              <span className="block text-[18px] font-semibold leading-none text-ink-50">{stats[a.key].count}</span>
              <span className="mt-1 block truncate text-[11px] text-ink-400">{a.shortLabel ?? a.label}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 flex items-center justify-between border-t border-line/10 pt-3 text-[12px] text-ink-300">
        <span>{t("reg.monthTotal")}</span>
        <span className="font-medium text-ink-100">
          {cuenta(total)} · {Math.round(totalKm).toLocaleString(language === "it" ? "it-IT" : "es-AR")} km
        </span>
      </p>
    </PanelShell>
  );
};

// Los servicios de hoy que todavia no llegaron, lo mas urgente primero. Los que van tarde, en rojo.
export const PendientesHoy = ({ filas }) => {
  const t = useT();
  return (
    <PanelShell icon={ClockIcon} title={t("reg.pendingToday")}>
      <p className="mb-3 text-[12px] text-ink-400">{t("reg.pendingHint")}</p>
      {filas.length === 0 ? (
        <p className="py-2 text-center text-[13px] text-ink-300">{t("reg.noPendingToday")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {filas.map((f) => (
            <li key={f.key} className={clsx("rounded-xl border border-line/10 px-3 py-2", f.retraso != null && "border-l-4 border-l-danger-500 bg-danger-500/[0.09]")}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <AreaBadge areaKey={f.area} size={22} />
                  <span className="truncate text-[13px] font-semibold text-ink-50">{f.codigo || "—"}</span>
                </span>
                <span className="shrink-0 text-[12px] text-ink-200">{f.eta ? horaRoma(f.eta) : "—"}</span>
              </div>
              <p className="mt-0.5 truncate text-[12px] text-ink-300">{f.destino}</p>
              {f.retraso != null && <RetrasoPill min={f.retraso} className="mt-1" />}
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
};
