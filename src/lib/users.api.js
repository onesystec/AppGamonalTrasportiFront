import { api } from "./api";
import { sharedGet } from "./sharedRequest";

// Compartida (ver sharedRequest.js): al abrir la app la piden varias pantallas a la vez.
export const listUsersRequest = () => sharedGet("users", () => api.get("/users").then((res) => res.data.data.users));

export const createUserRequest = (payload) =>
  api.post("/users", payload).then((res) => res.data.data.user);

export const getUserRequest = (id) =>
  api.get(`/users/${id}`).then((res) => res.data.data.user);

export const updateUserRequest = (id, payload) =>
  api.patch(`/users/${id}`, payload).then((res) => res.data.data.user);

export const deleteUserRequest = (id) => api.delete(`/users/${id}`);

// logo: true = logo de una empresa cliente (se muestra entero, sin recortar a cuadrado).
export const uploadUserAvatarRequest = (id, file, { logo = false } = {}) => {
  const formData = new FormData();
  if (logo) formData.append("tipo", "logo");
  formData.append("imagen", file);
  return api.post(`/users/${id}/avatar`, formData).then((res) => res.data.data.user);
};

// accuracy (radio de incertidumbre en metros que reporta el propio GPS) es opcional -
// el backend la usa para descartar fixes de mala calidad antes de guardarlos.
export const updateMyLocationRequest = (lat, lng, accuracy) =>
  api.patch("/users/me/ubicacion", { lat, lng, ...(accuracy != null ? { accuracy } : {}) });

export const reportLocationPermissionRequest = (denegado) =>
  api.patch("/users/me/ubicacion-permiso", { denegado });

export const updateMyReperibilidadRequest = (noDisponible) =>
  api.patch("/users/me/reperibilidad", { noDisponible }).then((res) => res.data.data.user);

// Notificaciones push (Area C, exceso de velocidad) - ver usePushNotifications.js.
export const registerPushTokenRequest = (token, platform) =>
  api.post("/users/me/push-token", { token, platform });

export const unregisterPushTokenRequest = (token) =>
  api.delete("/users/me/push-token", { data: { token } });

export const listDriverLocationsRequest = () =>
  api.get("/users/ubicaciones").then((res) => res.data.data.ubicaciones);

// A demanda desde el mapa: solo se pide para el chofer libre abierto/seleccionado, no
// para todos los choferes libres en cada refresco de posiciones.
export const getDriverReturnEtaRequest = (id) =>
  api.get(`/users/${id}/eta-regreso`).then((res) => res.data.data.eta);

// Ruta real (historial de pings GPS) de un chofer en un dia puntual.
export const getDriverRouteHistoryRequest = (id, year, month, day) =>
  api.get(`/users/${id}/ruta/${year}/${month}/${day}`).then((res) => res.data.data.puntos);
