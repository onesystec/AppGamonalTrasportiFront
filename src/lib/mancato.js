// Estados de Mancato Pagamento. El backend los deriva (no se guardan): Pagado si tiene el
// pago registrado, Vencido si no esta pagado y ya paso la fecha de vencimiento, Pendiente
// el resto. Colores con el mismo criterio del resto de la app: rojo = problema real,
// naranja = atencion, verde = ok.
export const MANCATO_ESTADOS = [
  {
    value: "VENCIDO",
    label: "Vencido",
    plural: "Vencidos",
    dot: "bg-danger-500 shadow-[0_0_6px_var(--danger-500)]",
    pill: "bg-danger-500/20 text-danger-500 ring-1 ring-danger-500/40",
    text: "text-danger-500",
    edge: "border-l-danger-500",
  },
  {
    value: "PENDIENTE",
    label: "Pendiente",
    plural: "Pendientes",
    dot: "bg-warning-500 shadow-[0_0_6px_var(--warning-500)]",
    pill: "bg-warning-500/20 text-warning-500 ring-1 ring-warning-500/40",
    text: "text-warning-500",
    edge: "border-l-warning-500",
  },
  {
    value: "PAGADO",
    label: "Pagado",
    plural: "Pagados",
    dot: "bg-success-500",
    pill: "bg-success-500/15 text-success-500",
    text: "text-success-500",
    edge: "border-l-success-500",
  },
];

export const MANCATO_ESTADO_BY_VALUE = Object.fromEntries(MANCATO_ESTADOS.map((e) => [e.value, e]));

// Dias despues de la fecha del aviso hasta los que se puede pagar (el aviso dice "entro il
// 15° giorno successivo alla data del transito"): vencimiento = fecha + 15.
export const MANCATO_PLAZO_DIAS = 15;

// Dia calendario de Roma (YYYY-MM-DD), el mismo criterio que usa el backend.
export const romeToday = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });

export const addDaysToDay = (day, days) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

// Para mostrar un YYYY-MM-DD como dd/mm/aaaa sin pasar por la zona horaria.
export const formatDay = (day) => {
  if (!day) return "-";
  const [year, month, dayOfMonth] = day.split("-");
  return `${dayOfMonth}/${month}/${year}`;
};

// Texto corto del plazo, para el chip de cada fila.
export const plazoLabel = (mancato) => {
  if (mancato.estado === "PAGADO") {
    return mancato.pagadoFueraDePlazo ? "Pagado fuera de plazo" : "Pagado";
  }
  const dias = mancato.diasRestantes;
  if (dias < 0) return `Vencido hace ${-dias} ${-dias === 1 ? "dia" : "dias"}`;
  if (dias === 0) return "Vence hoy";
  return `Vence en ${dias} ${dias === 1 ? "dia" : "dias"}`;
};

// "12,50" / "12.50" -> numero, o null si no es un importe valido.
export const parseCosto = (text) => {
  const value = Number(String(text ?? "").trim().replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
};

// A que servicio pertenece cada peaje y en que punto esta esa asignacion. El backend lo
// calcula (ver mancatoMatching.service.js): el chofer suele subir el peaje antes de que la
// oficina cargue el servicio, asi que "Esperando servicio" es un estado normal y se resuelve
// solo cuando el servicio aparece.
export const MANCATO_ASIGNACIONES = {
  AUTO: { label: "Asignado", pill: "bg-success-500/15 text-success-500", tone: "text-success-500" },
  CONFIRMADO: { label: "Confirmado", pill: "bg-success-500/15 text-success-500", tone: "text-success-500" },
  MANUAL: { label: "Asignado a mano", pill: "bg-success-500/15 text-success-500", tone: "text-success-500" },
  SUGERIDO: { label: "Por confirmar", pill: "bg-warning-500/20 text-warning-500", tone: "text-warning-500" },
  EN_ESPERA: { label: "Esperando servicio", pill: "bg-accent-500/20 text-accent-300", tone: "text-accent-300" },
  FUERA_DE_HORARIO: {
    label: "Fuera del horario laboral",
    pill: "bg-line/15 text-ink-300",
    tone: "text-ink-300",
  },
  // Anteriores al 1 de julio de 2026 y sin servicio: no se asignan ni generan alertas.
  HISTORICO: { label: "Histórico", pill: "bg-line/15 text-ink-300", tone: "text-ink-300" },
};

// Un estado que el front no conoce (backend mas nuevo que el front) se muestra neutro en vez de romper la pantalla.
export const asignacionInfo = (value) =>
  MANCATO_ASIGNACIONES[value] ?? { label: "Sin servicio", pill: "bg-line/15 text-ink-300", tone: "text-ink-300" };

export const ASIGNACION_FILTER_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "REVISAR", label: "Por revisar" },
  { value: "SUGERIDO", label: "Por confirmar" },
  { value: "EN_ESPERA", label: "Esperando servicio" },
  { value: "FUERA_DE_HORARIO", label: "Fuera del horario laboral" },
  { value: "HISTORICO", label: "Histórico (antes de julio)" },
];

export const TRAMO_LABELS = { IDA: "Ida", VUELTA: "Vuelta" };

// "12/10/2026 08:40" (hora de Roma) a partir de la fecha del aviso y su hora.
export const formatTransito = (mancato) => {
  if (!mancato.fechaHoraTransito) return null;
  return new Date(mancato.fechaHoraTransito).toLocaleString("es-AR", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

// El sitio web de pago es texto libre: solo se vuelve enlace si es una direccion http(s) (o empieza con
// "www."); si no, se muestra como texto. Evita enlaces "javascript:" y similares.
export const sitioWebHref = (text) => {
  const value = (text ?? "").trim();
  if (/^https?:\/\/\S+$/i.test(value)) return value;
  if (/^www\.\S+$/i.test(value)) return `https://${value}`;
  return null;
};
