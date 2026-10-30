import { StatusBadge } from "../ui/StatusBadge";
import { APLICATIVO_LABELS } from "../../lib/constants";
import { formatKm, formatRomeDateTime } from "../../lib/format";

const AREA_LABELS = { DHL: "DHL", EXTRAS: "Extras", FARMACIA: "Farmacia", OTROS: "Otros" };
const ZONA_LABELS = { MILANO: "Milano", ROMA: "Roma" };

const areaLabel = (t) =>
  [t.areaTipo === "OTROS" && t.areaOtros ? t.areaOtros : AREA_LABELS[t.areaTipo] ?? t.areaTipo, ZONA_LABELS[t.zona]]
    .filter(Boolean)
    .join(" ");

const Cell = ({ label, children }) => (
  <div className="min-w-0">
    <span className="block text-[11px] uppercase tracking-wide text-ink-400">{label}</span>
    <span className="block truncate text-[13px] text-ink-100">{children || "-"}</span>
  </div>
);

// Servicios que hizo el chofer el dia elegido (oficina): una fila por servicio. Los que vienen de un dia
// anterior (viaje largo o vuelta) van marcados "en curso".
export const ServiciosDelDia = ({ servicios, adicionales }) => {
  if (!servicios?.length && !adicionales?.length) return null;
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {(adicionales ?? []).map((t) => (
        <li key={t.id} className="rounded-xl border border-line/10 bg-line/[0.04] px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-[13px] text-ink-50">Trabajo adicional</b>
            <span className="rounded bg-success-500/20 px-2 py-0.5 text-[11px] font-medium text-success-500">Aprobado</span>
            <span className="ml-auto text-[14px] font-semibold text-ink-50">{t.horas} h</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <Cell label="Area">{areaLabel(t)}</Cell>
            <Cell label="Inicio">{formatRomeDateTime(t.inicio)}</Cell>
            <Cell label="Fin">{formatRomeDateTime(t.fin)}</Cell>
            <Cell label="Descripcion">{t.descripcion}</Cell>
          </div>
        </li>
      ))}
      {(servicios ?? []).map((s) => (
        <li key={s.id} className="rounded-xl border border-line/10 bg-line/[0.04] px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-[13px] text-ink-50">{s.codigo}</b>
            <StatusBadge status={s.estado} />
            {s.enCurso && (
              <span className="rounded bg-accent-500/20 px-2 py-0.5 text-[11px] font-medium text-accent-400">
                Viene de un dia anterior (viaje / vuelta)
              </span>
            )}
            <span className="ml-auto text-[14px] font-semibold text-ink-50">{formatKm(s.km)}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <Cell label="Cliente">{s.cliente}</Cell>
            <Cell label="Destino">{s.destino}</Cell>
            <Cell label="Vehiculo">{s.vehiculo}</Cell>
            <Cell label="Circuito">{s.aplicativo ? APLICATIVO_LABELS[s.aplicativo] : null}</Cell>
            <Cell label="Salida">{formatRomeDateTime(s.salida)}</Cell>
            <Cell label="ETA">{formatRomeDateTime(s.eta)}</Cell>
          </div>
        </li>
      ))}
    </ul>
  );
};
