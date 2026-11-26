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

// Responsable de la oficina que gestiona la multa. Hasta el 18/11/2026 las gestiono Yan; desde el 19/11/2026, Claudia
// (las nuevas se cargan a nombre de Claudia si no se elige otro).
export const GESTOR_OPTIONS = [
  { value: "Yan", label: "Yan" },
  { value: "Claudia", label: "Claudia" },
];
export const GESTOR_POR_DEFECTO = "Claudia";
export const gestorLabel = (gestor) => gestor || "Sin responsable";

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

// Tipo de multa para la lista, sacado del texto de la multa (comentarios). No hay un campo propio: si no se reconoce, null.
const TIPOS_MULTA = [
  { test: /126-?bis|datos del conductor|dati del conducente/i, label: "Datos del conductor", tone: "bg-danger-500/15 text-danger-500" },
  { test: /area\s*c\b/i, label: "Area C", tone: "bg-[#22d3ee]/15 text-[#22d3ee]" },
  { test: /\bztl\b|traffico limitato|quadrilatero/i, label: "ZTL", tone: "bg-[#22d3ee]/15 text-[#22d3ee]" },
  { test: /velocidad|velocit|km\/h|art\.?\s*142/i, label: "Velocidad", tone: "bg-warning-500/20 text-warning-500" },
  { test: /pedagg|peaje|casello|176\/21/i, label: "Peaje", tone: "bg-accent-500/15 text-accent-300" },
  { test: /sosta|estacion|parcheggi|aparcad|art\.?\s*157|art\.?\s*158/i, label: "Estacionamiento", tone: "bg-[#a78bfa]/15 text-[#a78bfa]" },
  { test: /semaforo|rosso/i, label: "Semaforo", tone: "bg-danger-500/15 text-danger-500" },
  { test: /cellular|penna|telefono|art\.?\s*173|169\/10/i, label: "Conduccion", tone: "bg-warning-500/20 text-warning-500" },
  { test: /suiza|alemania|austria|francia|svizzera|germania|kanton|mahnung|extranjero/i, label: "Extranjero", tone: "bg-ink-500/15 text-ink-300" },
];
export const tipoMulta = (multa) => {
  const text = multa?.comentarios ?? "";
  if (!text) return null;
  return TIPOS_MULTA.find((t) => t.test.test(text)) ?? null;
};
