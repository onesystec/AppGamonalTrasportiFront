import { APLICATIVO_LABELS } from "./constants";

// Solicitudes de servicio de un usuario cliente (Piazza): el registro limitado que la oficina completa y acepta.
// Mismos valores que el servidor (constants/solicitudes.js).
export const SOLICITUD_SERVICIOS = [
  { value: "DHL_MILANO", label: "DHL Milano" },
  { value: "DHL_ROMA", label: "DHL Roma" },
  { value: "AB_SERVICE", label: "AB Service" },
  { value: "EXTRA_PIAZZA", label: "Extra Piazza" },
];
export const SOLICITUD_SERVICIO_LABELS = Object.fromEntries(SOLICITUD_SERVICIOS.map((s) => [s.value, s.label]));

export const SOLICITUD_ESTADOS = {
  PENDIENTE: { label: "Pendiente", pill: "bg-warning-500/15 text-warning-500" },
  ACEPTADA: { label: "Aceptada", pill: "bg-success-500/15 text-success-500" },
  RECHAZADA: { label: "Rechazada", pill: "bg-danger-500/15 text-danger-500" },
};

// Datos del servicio real que se crea al aceptar cada tipo.
export const SOLICITUD_A_SERVICIO = {
  DHL_MILANO: { spedizzione: "DHL", zona: "MILANO" },
  DHL_ROMA: { spedizzione: "DHL", zona: "ROMA" },
  AB_SERVICE: { spedizzione: "AB_SERVICE", zona: "MILANO" },
  EXTRA_PIAZZA: { spedizzione: "EXTRA_PIAZZA", zona: null },
};

const ROME = "Europe/Rome";
const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: ROME,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const romeParts = (value) => {
  const parts = Object.fromEntries(PARTS.formatToParts(new Date(value)).map((p) => [p.type, p.value]));
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute };
};

// Un instante -> "AAAA-MM-DDTHH:mm" en hora de Roma, el formato de un campo datetime-local (el servidor lo vuelve a leer como hora de Roma).
export const toRomeInput = (value) => {
  if (!value) return "";
  const p = romeParts(value);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};

export const formatFechaHora = (value) => {
  if (!value) return "-";
  const p = romeParts(value);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
};

const kmText = (km) => String(Math.round(km * 10) / 10).replace(".", ",");

// KM destino tal cual se muestra: el numero o, si lo escrito no era un numero (ej. "NAVETTA HP"), ese texto.
export const kmDeSolicitud = (s) => (s.km != null ? kmText(s.km) : (s.kmTexto ?? null));

// "KEVIN, DAVID" -> "@KEVIN @DAVID" (como se avisa en el grupo de WhatsApp a quien retira).
const menciones = (autRitiro) =>
  (autRitiro ?? "")
    .split(/[,/&]|\s+y\s+/i)
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n) => `@${n}`)
    .join(" ");

// Mensaje listo para pegar en WhatsApp. Devuelve { text, missing }: missing son los datos que la plantilla pide y la solicitud no tiene
// (el mensaje se arma igual, sin esas lineas).
//  - DHL (Milano y Roma): cliente / PER destinazione / ETA / KM / A CHI ASSEGNO? (+ el numero de Milano o Roma si se eligio).
//  - AB Service: la descripcion del envio tal cual, KM (el Totale), ETA, las menciones de quien retira (Aut. ritiro) y la hora limite de entrega.
//  - Extra Piazza: como DHL, con la nota (Varie) al final.
export const buildWhatsappMessage = (s, now = new Date()) => {
  const missing = [];
  const p = romeParts(s.fechaHora);
  const hoy = toRomeInput(now).slice(0, 10) === `${p.year}-${p.month}-${p.day}`;
  const hora = `${p.hour}.${p.minute}`;
  const diaCorto = `${p.day}/${p.month}`;
  const etaLine = `ETA ORE ${hora}${hoy ? "" : ` DEL ${diaCorto}`}`;

  const cliente = (s.cliente ?? "").trim();
  const destino = (s.destinazione ?? "").trim();
  const varie = (s.varie ?? "").trim();
  const descripcion = (s.descripcion ?? "").trim();
  const km = kmDeSolicitud(s);
  // Codigos, no textos: quien los muestra los traduce (wa.missing.*).
  if (km == null) missing.push("km");

  if (s.servicio === "AB_SERVICE") {
    if (!descripcion) missing.push("description");
    const mencion = menciones(s.autRitiro);
    if (!mencion) missing.push("autRitiro");
    // "19.00" se dice "19": las horas en punto sin minutos.
    const limite = p.minute === "00" ? String(Number(p.hour)) : hora;
    const lines = [descripcion || null, km != null ? `KM ${km}` : null, etaLine, mencion || null, `CONSEGNI ${hoy ? "OGGI" : `IL ${diaCorto}`} ENTRO LE ${limite}`];
    return { text: lines.filter(Boolean).join("\n"), missing };
  }

  const per = /^per\s/i.test(destino) ? destino : `PER ${destino}`;
  // Un KM que no es numero (NAVETTA HP) va solo, sin la palabra KM.
  const kmLine = km == null ? null : s.km != null ? `KM ${km}` : km.toUpperCase();
  const lines = [cliente.toUpperCase(), per.toUpperCase(), etaLine, kmLine];
  if (s.servicio === "EXTRA_PIAZZA") return { text: [...lines, varie || null].filter(Boolean).join("\n"), missing };
  const asigno = `A CHI ASSEGNO?${s.aplicativo ? ` ${APLICATIVO_LABELS[s.aplicativo] ?? s.aplicativo}` : ""}`;
  return { text: [...lines.filter(Boolean), "", asigno].join("\n"), missing };
};

// El texto de KM que no es numero (NAVETTA HP) no tiene campo en el servicio real: va a la descripcion.
const kmTextoSuelto = (s) => (s.kmTexto ? `KM: ${s.kmTexto}` : null);

// Valores que una solicitud pone de partida en el formulario real del servicio (la oficina completa el resto).
export const solicitudToFormDefaults = (s) => ({
  eta: toRomeInput(s.fechaHora),
  kilometros: s.km != null ? String(s.km) : "",
  pagoRecibido: s.pagato != null ? String(s.pagato) : "",
  // Varie 2 es lo que se cobra aparte (ej. espera onsite): queda como costo de espera.
  costoEspera: s.varie2 != null ? String(s.varie2) : "",
  descripcion:
    [s.descripcion, s.varie, kmTextoSuelto(s), s.autRitiro ? `Aut. ritiro: ${s.autRitiro}` : null, s.pagato50 ? "Pagato al 50%" : null]
      .filter((v) => v && String(v).trim())
      .join("\n") || `Solicitud de ${s.cliente}`,
  aplicativo: s.aplicativo ?? "",
});

const normalizeName = (name) => String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ");

// Cliente (ficha) que coincide con el nombre escrito en la solicitud, si existe.
export const findClientByName = (clients, name) => clients.find((c) => normalizeName(c.nombre) === normalizeName(name)) ?? null;

// Aviso de que se cargo un servicio nuevo desde una solicitud (para refrescar el contador de pendientes).
export const SOLICITUDES_CHANGED_EVENT = "solicitudes-changed";
export const notifySolicitudesChanged = () => window.dispatchEvent(new Event(SOLICITUDES_CHANGED_EVENT));
