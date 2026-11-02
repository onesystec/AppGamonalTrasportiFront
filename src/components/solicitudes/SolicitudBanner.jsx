import { useEffect, useState } from "react";
import { formatCurrency } from "../../lib/format";
import { esSolicitudDeTexto, formatFechaHora } from "../../lib/solicitudes";
import { getRutaEstimadaRequest } from "../../lib/solicitudes.api";

// Extra Piazza: los km no se escriben solos; aqui se muestra la ruta estimada entre el ritiro y la consegna como pista para quien los escribe.
const RutaEstimada = ({ solicitud }) => {
  const [km, setKm] = useState(null);
  useEffect(() => {
    if (solicitud.servicio !== "EXTRA_PIAZZA" || !solicitud.ritiro) return undefined;
    let cancelled = false;
    getRutaEstimadaRequest(solicitud.id)
      .then((r) => !cancelled && setKm(r.km))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [solicitud.id, solicitud.servicio, solicitud.ritiro]);
  if (km == null) return null;
  return (
    <span className="mt-1 block text-ink-300">
      Ruta estimada ritiro → consegna: ~{km} km (solo orientativo: escribe el KM a mano, {solicitud.km != null ? `la solicitud trae ${solicitud.km} km` : "la solicitud no trae km"}).
    </span>
  );
};

// Aviso en el formulario del servicio real cuando se completa una solicitud de un cliente: lo que pidio, para tenerlo a la vista mientras
// se completa el resto. Al crear el servicio la solicitud queda aceptada.
export const SolicitudBanner = ({ solicitud, clienteEncontrado }) => (
  <div className="rounded-2xl border border-accent-500/40 bg-accent-500/10 px-4 py-3 text-[13px] text-ink-100">
    <span className="block font-semibold text-accent-300">
      {esSolicitudDeTexto(solicitud)
        ? `Servizio letto da un testo incollato da ${solicitud.creadoPor ?? "l'ufficio"}: controlla i dati e completa il resto`
        : `Completando una solicitud de ${solicitud.empresa ?? solicitud.creadoPor ?? "un cliente"}`}
    </span>
    <span className="mt-1 block">
      {solicitud.servicioLabel} · {solicitud.cliente} · {solicitud.destinazione} · {solicitud.etaPendiente ? "ETA por completar" : formatFechaHora(solicitud.fechaHora)}
      {solicitud.km != null ? ` · ${solicitud.km} km` : solicitud.kmTexto ? ` · ${solicitud.kmTexto}` : ""}
      {solicitud.pagato != null ? ` · Pagato ${formatCurrency(solicitud.pagato)} (queda como monto recibido)` : ""}
      {solicitud.pagato50 ? " · Pagato al 50%" : ""}
    </span>
    {solicitud.ritiro && <span className="mt-1 block text-ink-300">Ritiro: {solicitud.ritiro}</span>}
    <RutaEstimada solicitud={solicitud} />
    {solicitud.autRitiro && <span className="mt-1 block text-ink-300">Aut. ritiro: {solicitud.autRitiro}</span>}
    {solicitud.varie && <span className="mt-1 block whitespace-pre-line text-ink-300">{solicitud.varie}</span>}
    {solicitud.varie2 != null && <span className="mt-1 block text-ink-300">Varie 2: {formatCurrency(solicitud.varie2)} (queda como costo de espera)</span>}
    {esSolicitudDeTexto(solicitud) && (
      <span className="mt-1 block text-ink-300">
        {solicitud.servicio === "EXTRA_PIAZZA"
          ? [solicitud.shipment && `Codice ${solicitud.shipment}`, solicitud.orderNumero && `Codice ${solicitud.orderNumero}`].filter(Boolean).join(" · ")
          : [solicitud.shipment && `Shipment ${solicitud.shipment}`, solicitud.orderNumero && `Order ${solicitud.orderNumero}`, solicitud.tipoPedido].filter(Boolean).join(" · ")}
      </span>
    )}
    {solicitud.choferIndicado && <span className="mt-1 block text-ink-300">Chofer indicado por el cliente: {solicitud.choferIndicado}</span>}
    {!esSolicitudDeTexto(solicitud) && solicitud.descripcion && <span className="mt-1 block whitespace-pre-line text-ink-300">{solicitud.descripcion}</span>}
    {!clienteEncontrado && solicitud.cliente && (
      <span className="mt-1 block text-warning-500">El cliente «{solicitud.cliente}» no esta en la lista: elige uno o crealo en el campo Cliente.</span>
    )}
  </div>
);
