// Punto de partida fijo de todo servicio (coincide con DEPOT_ORIGIN del backend).
// Aca es solo para mostrarlo en la UI, no se geocodifica en el frontend.
// Sugerencias para el punto de salida de un servicio (solo atajos: el campo es de texto libre). Las que
// traen coordenadas se guardan con ubicacion exacta, sin geocodificar.
export const SALIDA_SUGERENCIAS = [
  {
    id: "dhl-milano",
    label: "DHL Milano",
    direccion: "Via Walter Tobagi, 8, 20068 Bettola-Zeloforamagno MI",
    lat: 45.4316679,
    lng: 9.2858459,
  },
  { id: "ab-service", label: "AB Service", direccion: "AB Service", lat: 45.37563890454172, lng: 9.79930539971582 },
  { id: "dhl-roma", label: "DHL Roma", direccion: "DHL Roma", lat: 41.87714283318788, lng: 12.359177365097292 },
];

// Destinos frecuentes por area (solo atajos: la direccion sigue siendo de texto libre). Traen ubicacion exacta, asi no
// se buscan en el mapa al guardar. Clave: "SPEDIZZIONE|ZONA".
export const DESTINO_SUGERENCIAS = {
  "DHL|MILANO": [
    { id: "navetta-settala", label: "Navetta Settala", lat: 45.42892605725507, lng: 9.392336833887438 },
    { id: "navetta-segrate", label: "Navetta Segrate", lat: 45.48365938751447, lng: 9.265573114520084 },
    { id: "navetta-lancetti", label: "Navetta Lancetti", lat: 45.49531725706131, lng: 9.178625050425186 },
    { id: "navetta-ferrera", label: "Navetta Ferrera", lat: 45.1003545280592, lng: 8.862973738302165 },
  ],
  "EXTRA_PIAZZA|MILANO": [
    { id: "malpensa-cargo-city", label: "Malpensa Cargo City", lat: 45.609681671586074, lng: 8.718266109902153 },
    { id: "segrate-wedo", label: "Segrate Wedo", lat: 45.4957098962224, lng: 9.306901004445473 },
    { id: "gallarate-trust", label: "Gallarate Trust", lat: 45.661734360997734, lng: 8.78631566371155 },
    { id: "lainate-world-courier", label: "Lainate World Courier/Cencora", lat: 45.56605997279036, lng: 9.009437343673945 },
    { id: "via-mecenate-gucci", label: "Via Mecenate - Gucci", lat: 45.452556354603246, lng: 9.249917692461695 },
    { id: "via-turati", label: "Via Turati", lat: 45.474463134360384, lng: 9.195140569497456 },
    { id: "linate-dogana", label: "Linate Aeroporto Dogana", lat: 45.45645476935813, lng: 9.283428018585507 },
  ],
};

export const destinoSugerencias = (spedizzione, zona) => DESTINO_SUGERENCIAS[`${spedizzione}|${zona}`] ?? [];

export const DEPOT_ORIGIN_LABEL = "Via Walter Tobagi, 8, 20068 Bettola-Zeloforamagno MI";

export const AREA_OPTIONS = [
  { value: "EXTRAS_PIAZZA", label: "Extras Piazza" },
  { value: "DHL", label: "DHL" },
  { value: "FARMACIA", label: "Farmacia" },
];

// Solo para Vehiculo (no para el area de un chofer/usuario) - "Sin asignar" es el
// area con la que se crean los vehiculos importados automaticamente desde Velocity
// Fleet (ver "Importar de Velocity Fleet" en VehiclesPage), para que se note que
// faltan revisar a mano.
export const VEHICLE_AREA_OPTIONS = [...AREA_OPTIONS, { value: "SIN_ASIGNAR", label: "Sin asignar" }];

// Seccion(es) de Registros/Control economico a las que queda acotado un ADMIN "de
// area" (ver lib/permissions.js) - lista, no un solo valor, por si a futuro un area
// vuelve a cubrir mas de una seccion. Un area sin entrada aca (ej. FARMACIA) no tiene
// seccion propia todavia. "extras-stefania" se saco de DHL: esa seccion (y DHL Milano/
// AB Service) ya no se ofrece en Registros para nadie, ni siquiera el ADMIN de area
// DHL - ver VISIBLE_SECTION_KEYS en RecordsListPage.jsx.
export const ADMIN_AREA_RECORDS_SECTION = {
  EXTRAS_PIAZZA: ["extras-piazza"],
  DHL: ["dhl-ab-service"],
};

export const CARGO_LABELS = {
  OWNER: "Admin",
  ADMIN: "Responsable",
  CHOFER: "Chofer",
  RRHH: "Recursos Humanos",
};

// Grupo operativo/organizacional del usuario (sucursal o socios), independiente del
// campo Area. Se usa para agrupar la lista de Choferes/Usuarios.
export const GRUPO_OPTIONS = [
  { value: "SOCIEDAD", label: "Sociedad" },
  { value: "MILANO_NORD", label: "Milano Nord" },
  { value: "MILANO_SUD", label: "Milano Sud" },
  { value: "ROMA", label: "Roma" },
  { value: "FARMACIA", label: "Farmacia" },
];

export const GRUPO_LABELS = Object.fromEntries(
  GRUPO_OPTIONS.map((opt) => [opt.value, opt.label])
);

// Spedizzione seleccionable al crear un servicio en la seccion DHL - AB Service
// (Extras Piazza sigue quedando fijo como EXTRA_PIAZZA).
export const SPEDIZZIONE_OPTIONS = [
  { value: "DHL", label: "DHL" },
  { value: "AB_SERVICE", label: "AB Service" },
];

// Sub-clasificacion de los servicios Extras Piazza (Milano vs Roma), para poder
// filtrar/reportar por zona mas adelante. No aplica a DHL/AB Service.
export const EXTRAS_PIAZZA_ZONA_OPTIONS = [
  { value: "MILANO", label: "Extras Milano" },
  { value: "ROMA", label: "Extras Roma" },
];

export const EXTRAS_PIAZZA_ZONA_LABELS = Object.fromEntries(
  EXTRAS_PIAZZA_ZONA_OPTIONS.map((opt) => [opt.value, opt.label])
);

// Mismo campo/valores que EXTRAS_PIAZZA_ZONA_OPTIONS (MILANO/ROMA, el campo en la
// base es el mismo "extrasPiazzaZona" para cualquier spedizzione, ver
// record.service.js), version generica para usar en DHL/AB Service - ahi el label
// "Extras Milano/Roma" no aplica.
export const ZONA_OPTIONS = [
  { value: "MILANO", label: "Milano" },
  { value: "ROMA", label: "Roma" },
];

export const ZONA_LABELS = Object.fromEntries(ZONA_OPTIONS.map((opt) => [opt.value, opt.label]));

export const RECORD_STATUS_OPTIONS = [
  { value: "IN_SOSPESO", label: "En suspenso" },
  { value: "IN_CONSEGNA", label: "En camino" },
  { value: "CONSEGNATO", label: "Entregado" },
  { value: "RITIRATO", label: "Retirado" },
  { value: "RISCHEDULATO", label: "Reprogramado" },
  { value: "ANNULLATO", label: "Anulado" },
];

// Circuito/aplicativo de reparto asignado al servicio (se carga por servicio, no por
// chofer, para conservar el historial exacto aunque el chofer cambie de aplicativo).
// ROMA_1..10 se agrego cuando arranco DHL en Roma (esa operacion tiene 10 circuitos,
// no 18) - se suma a los MILANO_1..18 ya existentes en vez de renombrarlos, para no
// tocar el historico ya cargado.
export const APLICATIVO_OPTIONS = [
  ...Array.from({ length: 18 }, (_, i) => ({ value: `MILANO_${i + 1}`, label: `MILANO ${i + 1}` })),
  ...Array.from({ length: 10 }, (_, i) => ({ value: `ROMA_${i + 1}`, label: `ROMA ${i + 1}` })),
];

export const APLICATIVO_LABELS = Object.fromEntries(
  APLICATIVO_OPTIONS.map((opt) => [opt.value, opt.label])
);

export const RECORD_STATUS_LABELS = Object.fromEntries(
  RECORD_STATUS_OPTIONS.map((opt) => [opt.value, opt.label])
);

// Color de estado (badge solido y grafico de barras), tomado de la paleta de
// estados de envio del style pack Express Dispatch. RITIRATO no tiene
// equivalente en el pack, se le asigna un teal propio para diferenciarlo.
export const RECORD_STATUS_TONE = {
  IN_SOSPESO: "pendiente",
  IN_CONSEGNA: "in-corso",
  CONSEGNATO: "consegnato",
  RITIRATO: "ritirato",
  RISCHEDULATO: "rischedulato",
  ANNULLATO: "annullato",
};

// Division de la seccion Registros en 2 pestanias, y de "Servicio actual" en el
// dashboard del chofer. RISCHEDULATO se considera terminado (queda para
// reprogramarse como un nuevo servicio, no sigue abierto).
export const EN_PROCESO_STATUSES = ["IN_SOSPESO", "IN_CONSEGNA", "RITIRATO"];
export const TERMINADOS_STATUSES = ["CONSEGNATO", "ANNULLATO", "RISCHEDULATO"];

// Mismos colores que los badges de estado (RECORD_STATUS_TONE + STATUS_COLORS
// en StatusBadge), para que el grafico de barras del dashboard OWNER use la
// misma paleta que el resto de la app.
export const RECORD_STATUS_CHART_COLOR = {
  IN_SOSPESO: "#6b7280",
  IN_CONSEGNA: "#2563eb",
  CONSEGNATO: "#16a34a",
  RITIRATO: "#0d9488",
  RISCHEDULATO: "#ea580c",
  ANNULLATO: "#dc2626",
};

export const CHART_COLORS = {
  // Cada dato con su propio color para distinguirlos de un vistazo: facturacion azul,
  // costos violeta, km celeste. Verde/rojo quedan para el resultado (ganancia o
  // perdida), porque solo significan estado.
  facturacion: "#2f8dff",
  costos: "#a78bfa",
  gananciaPositiva: "#22e093",
  gananciaNegativa: "#ff3b57",
  km: "#22d3ee",
};

export const VEHICLE_STATUS_OPTIONS = [
  { value: "DISPONIBLE", label: "Disponible" },
  { value: "EN_MANTENIMIENTO", label: "En mantenimiento" },
  { value: "FUERA_DE_SERVICIO", label: "Fuera de servicio" },
];

export const VEHICLE_STATUS_LABELS = Object.fromEntries(
  VEHICLE_STATUS_OPTIONS.map((opt) => [opt.value, opt.label])
);

export const VEHICLE_STATUS_TONE = {
  DISPONIBLE: "consegnato",
  EN_MANTENIMIENTO: "rischedulato",
  FUERA_DE_SERVICIO: "annullato",
};

export const TIPO_ARCHIVO_LABELS = {
  CMR: "CMR",
  FOTO_ENTREGA: "Foto de entrega",
  FACTURA: "Factura",
  COMPROBANTE: "Comprobante",
  OTRO: "Otro",
};

export const TIPO_DOCUMENTO_OPTIONS = [
  { value: "CARTA_IDENTITA", label: "Carta d'identita" },
  { value: "PATENTE", label: "Patente" },
  { value: "TRADUZIONE_PATENTE", label: "Traduzione patente" },
  { value: "CODICE_FISCALE", label: "Codice fiscale" },
  { value: "CONTRATO", label: "Contrato" },
  { value: "UNILAV", label: "UNILAV" },
  { value: "RESPONSIVAS", label: "Responsivas" },
  { value: "PERMESSO_TRASPORTO", label: "Permiso de trasporto" },
  { value: "PASSAPORTO", label: "Passaporto" },
  { value: "SOGGIORNO", label: "Soggiorno" },
  { value: "TREDICESIMA_QUATTORDICESIMA", label: "13ma/14ma" },
];

export const TIPO_DOCUMENTO_LABELS = Object.fromEntries(
  TIPO_DOCUMENTO_OPTIONS.map((opt) => [opt.value, opt.label])
);

// Seccion Mecanica: intervalo fijo de Tagliando y umbrales de aviso, medidos en KM
// restantes (TAGLIANDO_INTERVALO_KM - (kmActual - kmUltimoMantenimiento)).
export const TAGLIANDO_INTERVALO_KM = 20000;
export const TAGLIANDO_KM_RECORDATORIO = 3500; // <= esto: pedir repuestos
export const TAGLIANDO_KM_URGENTE = 1500; // <= esto (o vencido): hacer tagliando ya

// Calcula el estado de mantenimiento de un vehiculo a partir de sus KM cargados.
// Devuelve null si todavia no se cargaron los dos valores necesarios.
export const getTagliandoStatus = (kmUltimoMantenimiento, kmActual) => {
  if (kmUltimoMantenimiento == null || kmActual == null) return null;

  const usado = kmActual - kmUltimoMantenimiento;
  const restante = TAGLIANDO_INTERVALO_KM - usado;

  if (restante <= TAGLIANDO_KM_URGENTE) {
    return { level: "urgente", usado, restante };
  }
  if (restante <= TAGLIANDO_KM_RECORDATORIO) {
    return { level: "recordatorio", usado, restante };
  }
  return { level: "ok", usado, restante };
};

export const TAGLIANDO_STATUS_LABELS = {
  ok: "Al dia",
  recordatorio: "Pedir repuestos",
  urgente: "Tagliando urgente",
};

// De donde sale un servicio cuando no se escribe una "Salida" (igual que defaultSalidaFor del backend): AB Service retira en AB
// Service (Milano), todo lo de zona Roma (DHL, AB Service y Extras Piazza) en el deposito de DHL Roma y lo demas en el
// deposito de DHL Milano.
export const salidaPorDefectoLabel = (spedizzione, zona) => {
  if (zona === "ROMA" && (spedizzione === "DHL" || spedizzione === "AB_SERVICE" || spedizzione === "EXTRA_PIAZZA")) return "DHL Roma";
  if (spedizzione === "AB_SERVICE") return "AB Service";
  return "Via Walter Tobagi, 8 (DHL Milano)";
};
