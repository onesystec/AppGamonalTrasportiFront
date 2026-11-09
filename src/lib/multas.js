// Las multas comparten estados (Vencido / Pendiente / Pagado) y colores con Mancato
// Pagamento: ver lib/mancato.js. Aca solo lo propio de las multas.
export { MANCATO_ESTADOS as MULTA_ESTADOS, MANCATO_ESTADO_BY_VALUE as MULTA_ESTADO_BY_VALUE } from "./mancato";

// Si el verbale no trae vencimiento cargado, se sugiere recepcion + 60 dias (se puede cambiar).
export const MULTA_PLAZO_POR_DEFECTO_DIAS = 60;

export const QUIEN_PAGA_OPTIONS = [
  { value: "CHOFER_PAGO", label: "Si, pago el chofer" },
  { value: "A_DESCONTAR", label: "No, a descontar" },
];

// Texto corto para la tabla y el detalle.
export const quienPagaLabel = (multa) => {
  if (multa.quienPaga === "CHOFER_PAGO") return { text: "Pago el chofer", tone: "neutral" };
  return multa.descontado
    ? { text: "Descontado", tone: "success" }
    : { text: "A descontar", tone: "warning" };
};

// A nombre de quien llego el verbale: la S.R.L. o la ditta individuale.
export const TITULAR_OPTIONS = [
  { value: "SRL", label: "S.R.L." },
  { value: "INDIVIDUAL", label: "Individual" },
];

export const titularLabel = (titular) => TITULAR_OPTIONS.find((o) => o.value === titular)?.label ?? "Sin indicar";

// Comunicacion de los datos del conductor (art. 126-bis C.d.S.): si la multa quita puntos, hay que
// decir quien manejaba dentro de los 60 dias desde la notificacion.
export const DATI_PLAZO_DIAS = 60;

export const DATI_ESTADO_OPTIONS = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "ENVIADO", label: "Enviado" },
  { value: "NO_REQUERIDO", label: "No requerido" },
];

// Texto y color del contador de "datos del conductor" para la tabla y el detalle (null si no aplica).
export const datiConducenteInfo = (multa) => {
  if (!multa?.datiEstado) return null;
  if (multa.datiEstado === "ENVIADO") {
    return {
      text: multa.datiEnviadoAt ? `Datos enviados ${formatDay(multa.datiEnviadoAt)}` : "Datos enviados",
      tone: "bg-success-500/15 text-success-500",
    };
  }
  if (multa.datiEstado === "NO_REQUERIDO") return { text: "Datos: no requerido", tone: "bg-line/10 text-ink-400" };
  const dias = multa.datiDiasRestantes;
  if (dias == null) return { text: "Datos pendientes", tone: "bg-warning-500/15 text-warning-500" };
  if (dias < 0) return { text: `Datos: vencido hace ${-dias} ${-dias === 1 ? "dia" : "dias"}`, tone: "bg-danger-500/15 text-danger-500" };
  if (dias === 0) return { text: "Datos: vence hoy", tone: "bg-danger-500/15 text-danger-500" };
  return {
    text: `Datos: faltan ${dias} ${dias === 1 ? "dia" : "dias"}`,
    tone: dias <= 7 ? "bg-warning-500/15 text-warning-500" : "bg-accent-500/15 text-accent-300",
  };
};

// "2026-11-09T00:00:00.000Z" -> "09/11/2026" (fechas sin hora).
const formatDay = (value) => {
  const [y, m, d] = String(value).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
