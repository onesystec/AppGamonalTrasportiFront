// Mes en curso de Roma como "AAAA-MM" (el mismo criterio que usa el backend).
export const currentMonth = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" }).slice(0, 7);

export const shiftMonth = (month, delta) => {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1 + delta, 1)).toISOString().slice(0, 7);
};

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export const monthName = (month) => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

// Colores de las tres series del grafico de gasto mensual (y de sus tarjetas).
export const COSTO_COLORS = {
  pagoChoferes: "#a78bfa",
  gastosServicios: "#ff8a1a",
  combustible: "#22e093",
};

const KM_SOURCE_LABELS = { REAL: "km reales", SERVICIO: "km del servicio", RUTA: "km de la ruta", SIN_DATO: "sin km", VIAJE: "km del viaje", TRASPASO_SIN_KM: "sin km" };
export const kmSourceLabel = (source) => KM_SOURCE_LABELS[source] ?? "";

const nf = (value) => Number(value).toLocaleString("es-AR", { maximumFractionDigits: 2 });

// Texto de como se calculo el pago de un servicio: "170 km x 10 EUR cada 85 km", "3,5 h x 10 EUR"...
export const payCalcText = (item, reglas) => {
  // Servicio compactado en un viaje: se paga una sola vez, en el servicio principal.
  if (item.incluidoEnViaje) return `Incluido en el viaje de ${item.viajeCodigo}`;
  const parts = [];
  if (item.viajeServicios > 1) parts.push(`Viaje de ${item.viajeServicios} servicios:`);
  if (item.modo === "HORAS") {
    const horas = [];
    if (item.horasDia > 0) horas.push(`${nf(item.horasDia)} h dia x ${nf(reglas.horaDiaEur)} EUR`);
    if (item.horasNoche > 0) horas.push(`${nf(item.horasNoche)} h noche x ${nf(reglas.horaNocheEur)} EUR`);
    parts.push(horas.join(" + "));
  } else if (item.kmFuente === "SIN_DATO") parts.push("sin kilometros cargados");
  else if (item.kmFuente === "TRASPASO_SIN_KM") parts.push("servicio con traspaso: sin horas ni km reales no se paga por los km del servicio");
  else {
    const eur = item.franja === "NOCHE" ? reglas.kmBloqueNocheEur : reglas.kmBloqueDiaEur;
    parts.push(
      `${nf(item.km)} km x ${nf(eur)} EUR cada ${nf(reglas.kmBloque)} km${item.franja === "NOCHE" ? " (noche)" : ""}${item.horasManejo > 0 ? ` (${nf(item.horasManejo)} h de manejo)` : ""}`
    );
  }
  if (item.esperaHoras > 0) parts.push(`+ ${nf(item.esperaHoras)} h de espera x ${nf(reglas.esperaHoraEur)} EUR`);
  if (item.reperibilidad) {
    const motivo = item.reperibilidad === "FESTIVO" ? "festivo" : "fin de semana";
    parts.push(`+ ${nf(item.pagoReperibilidad)} EUR de reperibilidad (${motivo})`);
  }
  return parts.join(" ");
};

// Tarifas por defecto (espejo de config/payRates.js) para estimar antes de consultar al servidor.
export const PAY_RULES_FALLBACK = {
  horaDiaEur: 10,
  horaNocheEur: 12,
  kmBloque: 85,
  kmBloqueDiaEur: 10,
  kmBloqueNocheEur: 12,
  esperaHoraEur: 7,
  banda: { diaInicio: "06:30", nocheInicio: "22:00" },
  redondeoHoras: 0,
  reperibilidad: { extraEur: 10, diasLaborales: [1, 2, 3, 4, 5], festivosCuentan: true },
  festivos: [],
};
