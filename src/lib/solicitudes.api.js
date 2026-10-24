import { api } from "./api";

// Usuario cliente (Piazza): sus solicitudes de servicio.
export const listSolicitudesClienteRequest = () => api.get("/cliente/solicitudes").then((res) => res.data.data.items);
export const createSolicitudRequest = (payload) => api.post("/cliente/solicitudes", payload).then((res) => res.data.data);
export const updateSolicitudRequest = (id, payload) => api.patch(`/cliente/solicitudes/${id}`, payload).then((res) => res.data.data);
export const deleteSolicitudRequest = (id) => api.delete(`/cliente/solicitudes/${id}`).then((res) => res.data.data);

// Oficina (Admin y Responsables): solicitudes de los clientes. Aceptar = crear el servicio con `solicitudId`.
export const listSolicitudesOficinaRequest = (estado = "PENDIENTE") =>
  api.get("/solicitudes", { params: { estado } }).then((res) => res.data.data.items);
export const rechazarSolicitudRequest = (id, motivo) => api.post(`/solicitudes/${id}/rechazar`, { motivo: motivo || null }).then((res) => res.data.data);
