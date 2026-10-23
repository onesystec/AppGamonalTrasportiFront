import { useState } from "react";
import { formatKmValue } from "../../lib/compactado";
import { CircuitoMapaModal } from "./CircuitoMapaModal";
import { RecorridoRealModal } from "./RecorridoRealModal";

const sentido = (nombre, sinPeaje, evitado, lista, cantidad, revisar) => {
  if (sinPeaje) return evitado ? `${nombre}: sin peaje` : `${nombre}: sin peaje (no se pudo calcular la ruta que los evita)`;
  if (!cantidad) return `${nombre}: sin peajes en el camino`;
  return `${nombre}: ${cantidad} ${cantidad === 1 ? "pago" : "pagos"} de peaje (${lista.join(" · ")})${revisar ? " · revisar" : ""}`;
};

// Que peajes tiene la ruta del circuito: si el chofer declaro que no uso peaje, la ruta se calculo sin autopistas de pago.
const PeajesResumen = ({ peajes }) =>
  peajes ? (
    <p className="mt-1 text-[12px] text-ink-300">
      {sentido("Ida", peajes.idaSinPeaje, peajes.idaEvitado, peajes.ida, peajes.idaCantidad, peajes.idaRevisar)} ·{" "}
      {sentido("Vuelta", peajes.vueltaSinPeaje, peajes.vueltaEvitado, peajes.vuelta, peajes.vueltaCantidad, peajes.vueltaRevisar)}
    </p>
  ) : null;

// Los km del circuito de un servicio o viaje tramo por tramo (lugar de espera -> retiro -> paradas -> lugar de espera), con un
// boton para verlo en el mapa. `circuito` = record.circuito (con tramos).
export const CircuitoDetalle = ({ circuito, recordId, className, recorridoEstado }) => {
  const [open, setOpen] = useState(false);
  const [openReal, setOpenReal] = useState(false);
  if (!circuito?.tramos?.length) return null;
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[12px] font-semibold uppercase tracking-wide text-ink-400">Circuito planificado</h4>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setOpenReal(true)} className="text-[12px] font-medium text-accent-400 hover:text-accent-300">
            Ver recorrido real
            {recorridoEstado === "REVISAR" && <span className="ml-1.5 rounded-full bg-warning-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-warning-500">Revisar</span>}
          </button>
          <button type="button" onClick={() => setOpen(true)} className="text-[12px] font-medium text-accent-400 hover:text-accent-300">
            Ver en el mapa
          </button>
        </div>
      </div>
      <PeajesResumen peajes={circuito.peajes} />
      <ul className="mt-1.5 flex flex-col gap-1">
        {circuito.tramos.map((t, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3 text-[12.5px] text-ink-200">
            <span className="min-w-0">
              {t.desde} &rarr; {t.hasta}
            </span>
            <span className="shrink-0 font-semibold text-ink-50">{formatKmValue(t.km)}</span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-3 border-t border-line/10 pt-1 text-[13px]">
          <span className="text-ink-300">Total</span>
          <span className="font-semibold text-ink-50">{formatKmValue(circuito.km)}</span>
        </li>
      </ul>
      {open && <CircuitoMapaModal recordId={recordId} onClose={() => setOpen(false)} />}
      {openReal && <RecorridoRealModal recordId={recordId} onClose={() => setOpenReal(false)} />}
    </div>
  );
};
