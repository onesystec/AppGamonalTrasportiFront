import { api } from "./api";

const BASE = "/cronologia-vehicular";

export const listCronologiaVehicularRequest = () => api.get(BASE).then((res) => res.data.data);
export const getContextoVehiculoRequest = () => api.get(`${BASE}/confirmacion`).then((res) => res.data.data);
export const confirmarUsoVehiculoRequest = (vehicleId, continuar = false) =>
  api.post(`${BASE}/confirmacion`, { vehicleId, continuar });

const romeDateTime = new Intl.DateTimeFormat("es", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Rome",
});

export const formatCronologiaDate = (value) => romeDateTime.format(new Date(value));

const romeDay = new Intl.DateTimeFormat("es", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Rome" });
const romeTime = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Rome" });

export const formatCronologiaDay = (value) => romeDay.format(new Date(value));
export const formatCronologiaTime = (value) => romeTime.format(new Date(value));
