import { formatCurrency } from "../../lib/format";
import { APLICATIVO_LABELS } from "../../lib/constants";
import { formatFechaHora, kmDeSolicitud, SOLICITUD_ESTADOS } from "../../lib/solicitudes";

const Fila = ({ label, children }) =>
  children == null || children === "" ? null : (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-32 shrink-0 text-[12px] uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="min-w-0 whitespace-pre-line break-words text-[14px] text-ink-50">{children}</dd>
    </div>
  );

export const EstadoPill = ({ estado }) => {
  const e = SOLICITUD_ESTADOS[estado] ?? { label: estado, pill: "bg-line/15 text-ink-300" };
  return <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${e.pill}`}>{e.label}</span>;
};

// Todos los datos de una solicitud (vista rapida, antes de editarla o completarla).
export const SolicitudDetalle = ({ solicitud: s }) => (
  <dl className="flex flex-col gap-2.5">
    <Fila label="Tipo">{s.servicioLabel}</Fila>
    <Fila label="Cliente">{s.cliente}</Fila>
    <Fila label="Destinazione">{s.destinazione}</Fila>
    <Fila label="Fecha y hora">{formatFechaHora(s.fechaHora)}</Fila>
    <Fila label="Fornitore">{s.fornitore}</Fila>
    <Fila label="Aut. ritiro">{s.autRitiro}</Fila>
    <Fila label={s.servicio === "AB_SERVICE" ? "Totale" : "KM destino"}>{s.km != null ? `${kmDeSolicitud(s)} km` : s.kmTexto}</Fila>
    <Fila label="Pagato">{s.pagato != null ? formatCurrency(s.pagato) : null}</Fila>
    <Fila label="Pagato al 50%">{s.pagato50 ? "Si" : null}</Fila>
    <Fila label="Varie">{s.varie}</Fila>
    <Fila label="Varie 2">{s.varie2 != null ? formatCurrency(s.varie2) : null}</Fila>
    <Fila label="Descripcion">{s.descripcion}</Fila>
    <Fila label="Numero">{s.aplicativo ? (APLICATIVO_LABELS[s.aplicativo] ?? s.aplicativo) : null}</Fila>
    {s.creadoPor && <Fila label="Pedido por">{`${s.creadoPor}${s.empresa ? ` (${s.empresa})` : ""}`}</Fila>}
    {s.estado === "RECHAZADA" && s.motivoRechazo && <Fila label="Motivo">{s.motivoRechazo}</Fila>}
  </dl>
);
