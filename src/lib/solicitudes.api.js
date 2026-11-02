import { api } from "./api";

// Usuario cliente (Piazza): sus solicitudes de servicio.
export const listSolicitudesClienteRequest = (month) => api.get("/cliente/solicitudes", { params: { month } }).then((res) => res.data.data.items);
export const createSolicitudRequest = (payload) => api.post("/cliente/solicitudes", payload).then((res) => res.data.data);
export const updateSolicitudRequest = (id, payload) => api.patch(`/cliente/solicitudes/${id}`, payload).then((res) => res.data.data);
export const deleteSolicitudRequest = (id) => api.delete(`/cliente/solicitudes/${id}`).then((res) => res.data.data);

// Oficina (Admin y Responsables): solicitudes de los clientes. Aceptar = crear el servicio con `solicitudId`.
export const listSolicitudesOficinaRequest = (estado = "PENDIENTE") =>
  api.get("/solicitudes", { params: { estado } }).then((res) => res.data.data.items);
export const rechazarSolicitudRequest = (id, motivo) => api.post(`/solicitudes/${id}/rechazar`, { motivo: motivo || null }).then((res) => res.data.data);

// Servicio desde un texto pegado (DHL Milano): el bot de reglas lo lee (no guarda nada) y despues se crea la solicitud pendiente.
export const leerTextoRequest = (servicio, texto) => api.post("/solicitudes/leer-texto", { servicio, texto }).then((res) => res.data.data);
export const crearDesdeTextoRequest = (payload) => api.post("/solicitudes/desde-texto", payload).then((res) => res.data.data);

// Extra Piazza: km estimados por ruta entre el ritiro y la consegna (solo una pista: el KM lo escribe una persona).
export const getRutaEstimadaRequest = (id) => api.get(`/solicitudes/${id}/ruta-estimada`).then((res) => res.data.data);

// Usuario cliente (Piazza): registrar un servicio pegando solo el texto (se lee y se crea la solicitud de una vez). body: { servicio, texto, confirmar? }.
// Devuelve { creada: true, solicitud, avisos } o, si ya hay una con el mismo Shipment / Order, { creada: false, duplicados, avisos }.
export const registrarDesdeTextoClienteRequest = (body) => api.post("/cliente/solicitudes/desde-texto", body).then((res) => res.data.data);

// Usuario cliente (Piazza): leer el texto de DHL para rellenar la solicitud y el detalle (chofer, targa, bolla) de una ya aceptada.
export const leerTextoClienteRequest = (servicio, texto) => api.post("/cliente/solicitudes/leer-texto", { servicio, texto }).then((res) => res.data.data);
export const getDetalleSolicitudRequest = (id) => api.get(`/cliente/solicitudes/${id}/detalle`).then((res) => res.data.data);
