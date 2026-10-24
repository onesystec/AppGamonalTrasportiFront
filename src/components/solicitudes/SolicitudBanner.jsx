import { formatCurrency } from "../../lib/format";
import { formatFechaHora } from "../../lib/solicitudes";

// Aviso en el formulario del servicio real cuando se completa una solicitud de un cliente: lo que pidio, para tenerlo a la vista mientras
// se completa el resto. Al crear el servicio la solicitud queda aceptada.
export const SolicitudBanner = ({ solicitud, clienteEncontrado }) => (
  <div className="rounded-2xl border border-accent-500/40 bg-accent-500/10 px-4 py-3 text-[13px] text-ink-100">
    <span className="block font-semibold text-accent-300">Completando una solicitud de {solicitud.empresa ?? solicitud.creadoPor ?? "un cliente"}</span>
    <span className="mt-1 block">
      {solicitud.servicioLabel} · {solicitud.cliente} · {solicitud.destinazione} · {formatFechaHora(solicitud.fechaHora)}
      {solicitud.km != null ? ` · ${solicitud.km} km` : ""}
      {solicitud.pagato != null ? ` · Pagato ${formatCurrency(solicitud.pagato)} (queda como monto recibido)` : ""}
    </span>
    {solicitud.varie && <span className="mt-1 block whitespace-pre-line text-ink-300">{solicitud.varie}</span>}
    {solicitud.varie2 && <span className="mt-1 block whitespace-pre-line text-ink-300">{solicitud.varie2}</span>}
    {!clienteEncontrado && (
      <span className="mt-1 block text-warning-500">El cliente «{solicitud.cliente}» no esta en la lista: elige uno o crealo en el campo Cliente.</span>
    )}
  </div>
);
