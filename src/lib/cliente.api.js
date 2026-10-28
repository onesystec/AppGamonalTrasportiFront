import { api } from "./api";

// Usuarios de empresas cliente (solo lectura; el servidor filtra siempre por su empresa).
export const getClienteMeRequest = () => api.get("/cliente/me").then((res) => res.data.data.cliente);

export const getClienteEnVivoRequest = () => api.get("/cliente/en-vivo").then((res) => res.data.data);

// Disponibilitá del cliente: targas libres u ocupadas por dia y cuantos choferes estan libres (sin nombres ni motivos). params: { desde, hasta }.
export const getClienteDisponibilidadRequest = (params) => api.get("/cliente/disponibilidad", { params }).then((res) => res.data.data.disponibilidad);

export const getClienteSeguimientoRequest = () => api.get("/cliente/seguimiento").then((res) => res.data.data.seguimiento);

// Recorrido que le falta a la furgoneta hasta la parada del cliente (null si ya llego o no hay posicion).
export const getClienteRutaRequest = (id) => api.get(`/cliente/seguimiento/${id}/ruta`).then((res) => res.data.data.ruta);

export const getClienteServiciosRequest = (month) => api.get("/cliente/servicios", { params: { month } }).then((res) => res.data.data);

export const exportClienteServiciosRequest = (month) => api.get("/cliente/exportar", { params: { month } }).then((res) => res.data.data);

export const getClienteFotosRequest = (id) => api.get(`/cliente/servicios/${id}/fotos`).then((res) => res.data.data.fotos);

// Admin: usuarios cliente (cargo CLIENTE). No se mezclan con la lista de choferes.
export const listClienteUsersRequest = () => api.get("/users", { params: { cargo: "CLIENTE" } }).then((res) => res.data.data.users);
