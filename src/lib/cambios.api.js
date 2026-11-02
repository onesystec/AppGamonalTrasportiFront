import { api } from "./api";

// Oficina (Owner y Admin): alertas de servicios ya entregados que un cliente edito en su hoja ({ items, noLeidas }), marcarlas como vistas y el historial
// de cambios de un servicio.
export const listCambiosRequest = () => api.get("/cambios").then((res) => res.data.data);
export const leerCambiosRequest = (ids) => api.post("/cambios/leer", ids ? { ids } : {}).then((res) => res.data.data);
export const getHistorialCambiosRequest = (recordId) => api.get("/cambios", { params: { recordId } }).then((res) => res.data.data.items);
