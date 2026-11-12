import { api } from "./api";

// Usuarios de empresas cliente (solo lectura; el servidor filtra siempre por su empresa).
export const getClienteMeRequest = () => api.get("/cliente/me").then((res) => res.data.data.cliente);

export const getClienteEnVivoRequest = () => api.get("/cliente/en-vivo").then((res) => res.data.data);

// Disponibilitá del cliente: targas libres u ocupadas por dia y cuantos choferes estan libres (sin nombres ni motivos). params: { desde, hasta }.
export const getClienteDisponibilidadRequest = (params) => api.get("/cliente/disponibilidad", { params }).then((res) => res.data.data.disponibilidad);

export const getClienteSeguimientoRequest = () => api.get("/cliente/seguimiento").then((res) => res.data.data.seguimiento);

// Recorrido que le falta a la furgoneta hasta la parada del cliente (null si ya llego o no hay posicion).
export const getClienteRutaRequest = (id) => api.get(`/cliente/seguimiento/${id}/ruta`).then((res) => res.data.data.ruta);

// Editar una celda de la hoja tipo Excel: origen "solicitud" | "servicio", su id y { campo: valor }. Queda en el historial; si el servicio ya se entrego, avisa a la oficina.
export const editarCeldaRequest = ({ origen, id, cambios }) => api.patch("/cliente/celda", { origen, id, cambios }).then((res) => res.data.data);

// Ancho de las columnas de las hojas tipo Excel: { dhl: { A: 120, ... }, ... }. Lo que fija una persona de la empresa lo ven todas.
export const getHojaAnchosRequest = () => api.get("/cliente/hoja-anchos").then((res) => res.data.data.anchos);
export const saveHojaAnchosRequest = (hoja, anchos) => api.put(`/cliente/hoja-anchos/${hoja}`, { anchos }).then((res) => res.data.data.anchos);

export const getClienteServiciosRequest = (month) => api.get("/cliente/servicios", { params: { month } }).then((res) => res.data.data);

export const exportClienteServiciosRequest = (month) => api.get("/cliente/exportar", { params: { month } }).then((res) => res.data.data);

// Actividad reciente de los servicios (Dashboard): nuevos, entregados y cambios.
export const getClienteActividadRequest = () => api.get("/cliente/actividad").then((res) => res.data.data.eventos);

// Cambios de un servicio (de la oficina y de la propia empresa).
export const getClienteCambiosRequest = (id) => api.get(`/cliente/servicios/${id}/cambios`).then((res) => res.data.data.cambios);

export const getClienteFotosRequest = (id) => api.get(`/cliente/servicios/${id}/fotos`).then((res) => res.data.data.fotos);

// Admin: usuarios cliente (cargo CLIENTE). No se mezclan con la lista de choferes.
export const listClienteUsersRequest = () => api.get("/users", { params: { cargo: "CLIENTE" } }).then((res) => res.data.data.users);
