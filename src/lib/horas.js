// Las bandas, tarifas y reglas de reperibilidad vienen del servidor (config/payRates.js, el unico
// archivo de tarifas) dentro de "reglas"; el pago real lo calcula el servidor, esto solo alimenta la
// vista previa mientras el chofer completa el formulario.
const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export const HORAS_ESTADOS = {
  PENDIENTE: { label: "En revision", pill: "bg-warning-500/20 text-warning-500" },
  APROBADAS: { label: "Aprobadas", pill: "bg-success-500/15 text-success-500" },
  DEVUELTAS: { label: "Devueltas", pill: "bg-danger-500/20 text-danger-500" },
  SIN_CARGAR: { label: "Sin cargar", pill: "bg-line/10 text-ink-300" },
};

export const horasEstadoKey = (estado) => estado ?? "SIN_CARGAR";

// "AAAA-MM-DDTHH:mm" (hora de pared) -> minutos desde una epoca comun. Se toma como UTC a
// proposito: no se quiere ninguna conversion de zona, solo aritmetica sobre el reloj de pared.
const wallToMinutes = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) / 60000;
};

// Vista previa de la jornada: misma logica que utils/workHours.js (lo trabajado se reparte en
// la misma proporcion que la jornada entre dia y noche). Ignora el cambio de hora (2 dias al
// ano); el servidor es quien manda.
export const previewShift = ({ inicio, fin, esperaMin = 0, pausaMin = 0 }, rates) => {
  const start = wallToMinutes(inicio);
  const end = wallToMinutes(fin);
  if (start == null || end == null) return { error: "" };
  if (end <= start) return { error: "La hora de fin debe ser posterior a la de inicio" };
  const total = end - start;
  const espera = Math.max(0, Number(esperaMin) || 0);
  const pausa = Math.max(0, Number(pausaMin) || 0);
  // Mismo criterio que el servidor (computeShiftHours): descontada la pausa no trabajada, lo trabajado no pasa de 24 h.
  if (total > 48 * 60 || total - pausa > 24 * 60) {
    return {
      error:
        "La jornada no puede superar las 24 horas trabajadas (la pausa no trabajada se descuenta): pon como inicio la hora en que saliste a entregar (no la del retiro del paquete), revisa las fechas y anota tu descanso en la pausa",
    };
  }
  if (espera + pausa > total) return { error: "La espera y la pausa no pueden superar la jornada" };

  const dayStart = toMin(rates?.banda?.diaInicio ?? "06:30");
  const nightStart = toMin(rates?.banda?.nocheInicio ?? "22:00");
  let diaMin = 0;
  for (let t = start; t < end; t += 1) {
    const minuteOfDay = ((t % 1440) + 1440) % 1440;
    if (minuteOfDay >= dayStart && minuteOfDay < nightStart) diaMin += 1;
  }
  const nocheMin = total - diaMin;
  const factor = (total - espera - pausa) / total;
  const step = rates?.redondeoHoras ?? 0;
  const round = (value) => (step > 0 ? Math.round(value / step) * step : value);
  const horasDia = round((diaMin * factor) / 60);
  const horasNoche = round((nocheMin * factor) / 60);
  const esperaHoras = round(espera / 60);

  // Reperibilidad: el servicio sale en fin de semana o festivo (fecha de la hora de inicio).
  let reperibilidad = null;
  if (rates?.reperibilidad) {
    const day = inicio.slice(0, 10);
    const [y, m, d] = day.split("-").map(Number);
    const weekday = ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1; // 1 = lunes ... 7 = domingo
    if (rates.reperibilidad.festivosCuentan && (rates.festivos ?? []).includes(day)) reperibilidad = "FESTIVO";
    else if (!rates.reperibilidad.diasLaborales.includes(weekday)) reperibilidad = "FIN_DE_SEMANA";
  }
  const extra = reperibilidad ? rates.reperibilidad.extraEur : 0;
  const pago = rates
    ? horasDia * rates.horaDiaEur + horasNoche * rates.horaNocheEur + esperaHoras * rates.esperaHoraEur + extra
    : null;
  return { error: "", totalMin: total, horasDia, horasNoche, esperaHoras, reperibilidad, pago };
};

// Horas con un decimal y coma: 1,5 h.
export const formatHours = (value) =>
  `${Number(value ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })} h`;

// Desde el 1/10/2026 (hora de Roma) el chofer no declara horas: se le paga por km (km / 85 = horas de manejo) y solo declara
// su espera. Debe coincidir con la tarifa "pagoPorKm" del servidor (config/payRates.js).
const PAGO_POR_KM_DESDE = new Date("2026-09-30T22:00:00Z");
export const pagaPorKm = (record) => new Date(record.fechaServicio).getTime() >= PAGO_POR_KM_DESDE.getTime();

// Un servicio entregado/retirado al que el chofer todavia tiene que cargarle horas (solo servicios anteriores al pago por km).
export const needsHours = (record) =>
  !pagaPorKm(record) &&
  // En un viaje compacto las horas se cargan una sola vez, en el servicio principal.
  !(record.compactado && !record.compactado.principal) &&
  // Un servicio reprogramado por la oficina tambien: el chofer manejo hasta ahi y se le paga.
  (["CONSEGNATO", "RITIRATO"].includes(record.estado) || (record.estado === "RISCHEDULATO" && Boolean(record.reprogramado))) &&
  (!record.jornada?.estado || record.jornada.estado === "DEVUELTAS");
