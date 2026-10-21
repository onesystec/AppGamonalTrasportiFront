import { api } from "./api";

// Usuarios de empresas cliente (solo lectura; el servidor filtra siempre por su empresa).
export const getClienteMeRequest = () => api.get("/cliente/me").then((res) => res.data.data.cliente);

export const getClienteSeguimientoRequest = () => api.get("/cliente/seguimiento").then((res) => res.data.data.seguimiento);

// Recorrido que le falta a la furgoneta hasta la parada del cliente (null si ya llego o no hay posicion).
export const getClienteRutaRequest = (id) => api.get(`/cliente/seguimiento/${id}/ruta`).then((res) => res.data.data.ruta);

export const getClienteServiciosRequest = (month) => api.get("/cliente/servicios", { params: { month } }).then((res) => res.data.data);

export const exportClienteServiciosRequest = (month) => api.get("/cliente/exportar", { params: { month } }).then((res) => res.data.data);

export const getClienteFotosRequest = (id) => api.get(`/cliente/servicios/${id}/fotos`).then((res) => res.data.data.fotos);

// Admin: usuarios cliente (cargo CLIENTE). No se mezclan con la lista de choferes.
export const listClienteUsersRequest = () => api.get("/users", { params: { cargo: "CLIENTE" } }).then((res) => res.data.data.users);
