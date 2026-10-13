import { getToken } from "./token";

// Lecturas repetidas comparten UNA sola peticion al servidor. Al abrir la app, varias pantallas y el centro de avisos piden a la vez
// la misma lista (usuarios, vehiculos...): sin esto el servidor la lee y la envia 5 veces seguidas, y cada lectura deja memoria
// reservada en una instancia de 512 MB. Mientras una peticion esta en curso todos esperan la misma; despues, el resultado se reutiliza
// unos segundos (ttlMs) y se descarta solo.
//  - La clave incluye el token: otra sesion nunca ve lo de esta.
//  - Cada llamada recibe su propia copia, asi que nadie pisa los datos de otro al ordenarlos o editarlos.
//  - Cualquier escritura (POST/PATCH/PUT/DELETE) vacia todo (ver api.js).
const entries = new Map();

const copyOf = (value) => (typeof structuredClone === "function" ? structuredClone(value) : value);

export const sharedGet = (key, load, ttlMs = 8000) => {
  const fullKey = `${getToken() ?? ""}|${key}`;
  const hit = entries.get(fullKey);
  if (hit && (!hit.settled || Date.now() - hit.settledAt < ttlMs)) return hit.promise.then(copyOf);

  const entry = { settled: false, settledAt: 0, promise: null };
  entry.promise = load().then(
    (value) => {
      entry.settled = true;
      entry.settledAt = Date.now();
      return value;
    },
    (error) => {
      // Un error no se guarda: el siguiente intento vuelve a pedir.
      if (entries.get(fullKey) === entry) entries.delete(fullKey);
      throw error;
    }
  );
  entries.set(fullKey, entry);
  return entry.promise.then(copyOf);
};

export const clearSharedRequests = () => entries.clear();
