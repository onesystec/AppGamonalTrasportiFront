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
