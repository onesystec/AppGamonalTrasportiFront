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
