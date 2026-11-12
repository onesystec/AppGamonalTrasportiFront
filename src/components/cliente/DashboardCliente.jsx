import clsx from "clsx";
import { Link } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AreaBadge } from "../records/AreaBadge";
import { useChartAxisColors } from "../charts/useChartAxisColors";
import { PanelShell } from "../ui/PanelShell";
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, BarsIcon, BellIcon, CheckCircleIcon, ClipboardListIcon, ClockIcon, PencilIcon } from "../ui/icons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage, useT } from "../../i18n/index.jsx";
import { horaRoma } from "../../lib/seguimiento";
import { AREAS, RetrasoPill } from "./RegistroLista";

// Piezas del Dashboard del cliente (Piazza), centradas en sus servicios: indicadores del mes con su variacion, evolucion diaria, actividad reciente, resumen por area
// y los servicios que quedan pendientes hoy.

const COLOR_SERVICIOS = "#3b82f6";
const COLOR_ENTREGADOS = "#94a3b8";

// Tono de cada indicador: la barra de la izquierda y el color del numero.
const TONOS = {
  info: { barra: "border-l-accent-500", icono: "text-accent-400" },
  bien: { barra: "border-l-success-500", icono: "text-success-500" },
};

// Variacion contra el mes anterior: flecha y porcentaje (o puntos, en la puntualidad). Sin datos del mes anterior no se muestra nada.
const Variacion = ({ actual, previo, puntos = false }) => {
  const t = useT();
  if (previo == null || actual == null || (!puntos && previo === 0)) return <span className="text-[12px] text-ink-400">{t("dash.kpi.noPrev")}</span>;
  const delta = puntos ? actual - previo : Math.round(((actual - previo) / previo) * 100);
  const igual = delta === 0;
  const sube = delta > 0;
  const Flecha = sube ? ArrowUpIcon : ArrowDownIcon;
  return (
    <span className={clsx("flex items-center gap-1 text-[13px] font-semibold", igual ? "text-ink-400" : sube ? "text-success-500" : "text-danger-500")}>
      {!igual && <Flecha className="h-3.5 w-3.5" />}
      {igual ? "=" : `${sube ? "+" : ""}${delta}%`}
      <span className="ml-1 text-[11px] font-normal text-ink-400">{t("dash.kpi.vsPrev")}</span>
    </span>
  );
};

// Un indicador del mes: icono, numero grande, variacion y el icono grande de fondo.
export const KpiTarjeta = ({ icon: Icon, label, value, tono = "info", onClick, children }) => {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={clsx(
        "glass-surface relative flex flex-col gap-2 overflow-hidden rounded-2xl border-l-4 p-5 text-left",
        TONOS[tono].barra,
        onClick && "transition-colors hover:bg-line/[0.05]"
      )}
    >
      <Icon aria-hidden="true" className="pointer-events-none absolute -bottom-3 right-3 h-24 w-24 text-ink-50 opacity-[0.06]" />
      <span className="flex items-center gap-2.5 text-[14px] font-medium text-ink-200">
        <Icon className={clsx("h-5 w-5", TONOS[tono].icono)} />
        {label}
      </span>
      <span className="text-[38px] font-semibold leading-none text-ink-50">{value}</span>
      {children}
    </Tag>
  );
};
export { Variacion };

const TooltipEvolucion = ({ active, payload, label, mes }) => {
  const t = useT();
  const { language } = useLanguage();
  if (!active || !payload?.length) return null;
  const fecha = new Date(`${mes}-${String(label).padStart(2, "0")}T12:00:00Z`).toLocaleDateString(language === "it" ? "it-IT" : "es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <div className="glass-surface-sm rounded-lg px-3 py-2 text-[13px]">
      <div className="mb-1 font-semibold text-ink-50">{t("dash.chart.weekOf", { date: fecha })}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-ink-300">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.stroke }} />
            {p.name}
          </span>
          <span className="font-medium text-ink-50">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// Evolucion del mes por semanas: servicios programados y servicios entregados. Cada marca del eje es el lunes de esa semana.
export const EvolucionMensual = ({ datos, mes }) => {
  const t = useT();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const { tickColor, axisLineColor } = useChartAxisColors(theme);
  const inicios = datos.map((d) => d.dia);
  const etiqueta = (dia) =>
    new Date(`${mes}-${String(dia).padStart(2, "0")}T12:00:00Z`).toLocaleDateString(language === "it" ? "it-IT" : "es-AR", { weekday: "short", day: "numeric", timeZone: "UTC" }).replace(".", "");
  const hayDatos = datos.some((d) => d.servicios > 0);
  return (
    <PanelShell
      icon={BarsIcon}
      title={t("dash.chart.title")}
      aside={
        <span className="flex items-center gap-4 text-[12px] text-ink-300">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_SERVICIOS }} />
            {t("dash.chart.services")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_ENTREGADOS }} />
            {t("dash.chart.delivered")}
          </span>
        </span>
      }
    >
      {hayDatos ? (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={datos} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={axisLineColor} />
              <XAxis dataKey="dia" ticks={inicios} tickFormatter={etiqueta} tick={{ fill: tickColor, fontSize: 11 }} axisLine={{ stroke: axisLineColor }} tickLine={false} />
              <YAxis width={30} tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<TooltipEvolucion mes={mes} />} cursor={{ stroke: axisLineColor }} />
              <Line type="monotone" dataKey="servicios" name={t("dash.chart.services")} stroke={COLOR_SERVICIOS} strokeWidth={2.5} dot={{ r: 3, fill: COLOR_SERVICIOS, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="entregados" name={t("dash.chart.delivered")} stroke={COLOR_ENTREGADOS} strokeWidth={2.5} dot={{ r: 3, fill: COLOR_ENTREGADOS, strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-16 text-center text-[13px] text-ink-300">{t("dash.chart.empty")}</p>
      )}
    </PanelShell>
  );
};

const CAMPOS = ["shipment", "orderNumero", "tipoPedido", "ciudad", "eta"];

// Un evento de la actividad reciente: icono de color, titulo, detalle y la hora a la derecha.
const eventoVista = (e, t) => {
  if (e.tipo === "NUEVO") return { icono: ClipboardListIcon, color: "bg-accent-500/15 text-accent-400", titulo: t("dash.act.new") };
  if (e.tipo === "CONSEGNADO") return { icono: CheckCircleIcon, color: "bg-success-500/15 text-success-500", titulo: t("dash.act.delivered") };
  if (e.campo === "chofer") return { icono: PencilIcon, color: "bg-warning-500/15 text-warning-500", titulo: e.nuevo ? t("dash.act.driver", { value: e.nuevo }) : t("dash.act.driverNoName") };
  if (e.campo === "targa") return { icono: PencilIcon, color: "bg-warning-500/15 text-warning-500", titulo: t(e.anterior ? "dash.act.plateChanged" : "dash.act.plate", { value: e.nuevo ?? "—" }) };
  const campo = CAMPOS.includes(e.campo) ? t(`dash.field.${e.campo}`) : e.campo;
  return { icono: PencilIcon, color: "bg-warning-500/15 text-warning-500", titulo: t("dash.act.changed", { field: campo }), detalle: `${e.anterior ?? "—"} → ${e.nuevo ?? "—"}` };
};

export const ActividadReciente = ({ eventos }) => {
  const t = useT();
  const { language } = useLanguage();
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
  const fecha = (iso) => {
    const dia = new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
    return dia === hoy ? "" : new Date(iso).toLocaleDateString(language === "it" ? "it-IT" : "es-AR", { day: "2-digit", month: "2-digit", timeZone: "Europe/Rome" });
  };
  return (
    <PanelShell
      icon={BellIcon}
      title={t("dash.activity.title")}
      aside={
        <Link to="/cliente/registro" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-400 hover:text-accent-300">
          {t("dash.activity.all")}
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      }
    >
      {eventos == null ? null : eventos.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-ink-300">{t("dash.activity.empty")}</p>
      ) : (
        <ul className="flex flex-col">
          {eventos.slice(0, 6).map((e, i) => {
            const v = eventoVista(e, t);
            const Icono = v.icono;
            return (
              <li key={`${e.tipo}-${e.recordId}-${e.fecha}-${i}`} className="flex items-center gap-3 border-t border-line/10 py-3 first:border-t-0">
                <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", v.color)}>
                  <Icono className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink-50">{v.titulo}</span>
                  <span className="block truncate text-[12px] text-ink-300">
                    {[e.cliente, e.codigo].filter(Boolean).join(" · ")}
                    {v.detalle && <span className="text-ink-400"> · {v.detalle}</span>}
                  </span>
                </span>
                <span className="shrink-0 text-right text-[12px] text-ink-300">
                  <span className="block font-medium text-ink-200">{horaRoma(e.fecha)}</span>
                  {fecha(e.fecha) && <span className="block text-ink-400">{fecha(e.fecha)}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </PanelShell>
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
