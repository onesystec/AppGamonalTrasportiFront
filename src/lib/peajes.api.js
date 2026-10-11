import { api } from "./api";

// Catalogo de peajes de Italia (OpenStreetMap, ~700): casi no cambia, se pide una sola vez por sesion.
let cached = null;
export const listPeajesRequest = () => {
  cached ??= api
    .get("/peajes")
    .then((res) => res.data.data.peajes)
    .catch((err) => {
      cached = null;
      throw err;
    });
  return cached;
};
