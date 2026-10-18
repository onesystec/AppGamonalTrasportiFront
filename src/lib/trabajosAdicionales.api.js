import { api } from "./api";

const BASE = "/trabajos-adicionales";

// fields: texto (los vacios/undefined se omiten); fotos: File[] (varias); quitarFotos: ids de las ya guardadas que se quitan.
const toFormData = (fields = {}, fotos = [], quitarFotos = []) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  fotos.forEach((foto) => formData.append("fotos", foto));
  quitarFotos.forEach((key) => formData.append("quitarFotos", key));
  return formData;
};

// { items, pendientes }: el chofer ve los suyos; la oficina, los de sus areas.
export const listTrabajosAdicionalesRequest = (params) => api.get(BASE, { params }).then((res) => res.data.data);
export const createTrabajoAdicionalRequest = (fields, fotos) =>
  api.post(BASE, toFormData(fields, fotos)).then((res) => res.data.data.trabajo);
export const updateTrabajoAdicionalRequest = (id, fields, fotos, quitarFotos) =>
  api.patch(`${BASE}/${id}`, toFormData(fields, fotos, quitarFotos)).then((res) => res.data.data.trabajo);
export const deleteTrabajoAdicionalRequest = (id) => api.delete(`${BASE}/${id}`);
// body: { accion: "APROBAR" | "DEVOLVER", nota?, inicio?, fin? } (inicio/fin = ajuste, con nota)
export const reviewTrabajoAdicionalRequest = (id, body) =>
  api.post(`${BASE}/${id}/revision`, body).then((res) => res.data.data.trabajo);
