import { StatusBadge } from "../ui/StatusBadge";
import { APLICATIVO_LABELS } from "../../lib/constants";
import { formatKm, formatRomeDateTime } from "../../lib/format";

const Cell = ({ label, children }) => (
  <div className="min-w-0">
    <span className="block text-[11px] uppercase tracking-wide text-ink-400">{label}</span>
    <span className="block truncate text-[13px] text-ink-100">{children || "-"}</span>
  </div>
);

// Servicios que hizo el chofer el dia elegido (oficina): una fila por servicio. Los que vienen de un dia
// anterior (viaje largo o vuelta) van marcados "en curso".
export const ServiciosDelDia = ({ servicios }) => {
  if (!servicios?.length) return null;
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {servicios.map((s) => (
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
