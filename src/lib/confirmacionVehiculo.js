const STORAGE_KEY = "gt_confirmacion_vehiculo";
let confirmedSession = null;

export const clearConfirmacionVehiculo = () => {
  confirmedSession = null;
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Almacenamiento no disponible. */ }
};

export const wasConfirmed = (session) => {
  if (confirmedSession === session) return true;
  try { return sessionStorage.getItem(STORAGE_KEY) === session; } catch { return false; }
};

export const markConfirmed = (session) => {
  confirmedSession = session;
  try { sessionStorage.setItem(STORAGE_KEY, session); } catch { /* Se conserva en memoria. */ }
};
