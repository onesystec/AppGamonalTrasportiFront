import { api } from "./api";

// A que vehiculos y choferes se refieren los avisos de gestion de quien esta conectado: { todo: true } (Admin) o { todo: false, vehicleIds,
// driverIds } (Responsable: solo lo de su asignacion). Se guarda unos minutos para no pedirlo en cada pantalla.
const CACHE_MS = 5 * 60 * 1000;
let cache = null;

export const getNotificationScopeRequest = (userId) => {
  if (cache && cache.userId === userId && Date.now() - cache.at < CACHE_MS) return cache.promise;
  const promise = api
    .get("/notificaciones/alcance")
    .then((res) => res.data.data.alcance)
    .catch((err) => {
      cache = null;
      throw err;
    });
  cache = { userId, at: Date.now(), promise };
  return promise;
};

export const clearNotificationScopeCache = () => {
  cache = null;
};

// Filtros con el alcance (null/{ todo: true } = sin restriccion).
export const vehicleInScope = (scope, vehicleId) => !scope || scope.todo || scope.vehicleIds.includes(vehicleId);
export const driverInScope = (scope, driverId) => !scope || scope.todo || scope.driverIds.includes(driverId);
