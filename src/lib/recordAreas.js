// Las 6 areas de servicio de Registros. Cada servicio se clasifica por su spedizzione y su
// zona (Milano/Roma):
// - DHL + zona                   -> DHL Milano / DHL Roma
// - AB_SERVICE                   -> AB Service
// - EXTRA_PIAZZA (o sin valor)   -> Extras Piazza Milano / Roma (sin zona cuenta como Milano)
// - EXTRAS_STEFANIA y el resto   -> Otros
export const AREA_ALL = "todos";

export const RECORD_AREAS = [
  {
    key: "dhl-milano",
    label: "DHL Milano",
    initials: "DHL",
    colors: { bg: "#facc15", fg: "#dc2626" },
    chartColor: "#facc15",
    newPath: "/records/dhl-ab-service/new",
    newState: { spedizzione: "DHL", zona: "MILANO" },
  },
  {
    key: "dhl-roma",
    label: "DHL Roma",
    initials: "DHL",
    colors: { bg: "#facc15", fg: "#dc2626" },
    chartColor: "#fde68a",
    newPath: "/records/dhl-ab-service/new",
    newState: { spedizzione: "DHL", zona: "ROMA" },
  },
  {
    key: "piazza-milano",
    label: "Extras Piazza Milano",
    shortLabel: "Piazza Milano",
    initials: "PS",
    colors: { bg: "#0ea5e9", fg: "#ffffff" },
    chartColor: "#94a3b8",
    newPath: "/records/extras-piazza/new",
    newState: { zona: "MILANO" },
  },
  {
    key: "piazza-roma",
    label: "Extras Piazza Roma",
    shortLabel: "Piazza Roma",
    initials: "PS",
    colors: { bg: "#0ea5e9", fg: "#ffffff" },
    chartColor: "#64748b",
    newPath: "/records/extras-piazza/new",
    newState: { zona: "ROMA" },
  },
  {
    key: "ab-service",
    label: "AB Service",
    initials: "AB",
    colors: { bg: "#dc2626", fg: "#ffffff" },
    chartColor: "#2f8dff",
    newPath: "/records/dhl-ab-service/new",
    newState: { spedizzione: "AB_SERVICE", zona: "MILANO" },
  },
  {
    key: "otros",
    label: "Otros",
    initials: "···",
    colors: { bg: "#475569", fg: "#e2e8f0" },
    chartColor: "#475569",
    newPath: "/records/extras-stefania/new",
    newState: {},
  },
];

export const AREAS_BY_KEY = Object.fromEntries(RECORD_AREAS.map((area) => [area.key, area]));

const zonaOf = (record) => (record.extrasPiazzaZona === "ROMA" ? "ROMA" : "MILANO");

export const classifyRecord = (record) => {
  if (record.spedizzione === "DHL") return zonaOf(record) === "ROMA" ? "dhl-roma" : "dhl-milano";
  if (record.spedizzione === "AB_SERVICE") return "ab-service";
  if (record.spedizzione === "EXTRAS_STEFANIA") return "otros";
  return zonaOf(record) === "ROMA" ? "piazza-roma" : "piazza-milano";
};
