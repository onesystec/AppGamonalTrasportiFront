import { api } from "./api";

const BASE = "/trabajos-adicionales";

// fields: texto (los vacios/undefined se omiten); foto: File opcional.
const toFormData = (fields = {}, foto) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  if (foto) formData.append("foto", foto);
  return formData;
};

// { items, pendientes }: el chofer ve los suyos; la oficina, los de sus areas.
export const listTrabajosAdicionalesRequest = (params) => api.get(BASE, { params }).then((res) => res.data.data);
export const createTrabajoAdicionalRequest = (fields, foto) =>
  api.post(BASE, toFormData(fields, foto)).then((res) => res.data.data.trabajo);
export const updateTrabajoAdicionalRequest = (id, fields, foto) =>
  api.patch(`${BASE}/${id}`, toFormData(fields, foto)).then((res) => res.data.data.trabajo);
export const deleteTrabajoAdicionalRequest = (id) => api.delete(`${BASE}/${id}`);
// body: { accion: "APROBAR" | "DEVOLVER", nota?, inicio?, fin? } (inicio/fin = ajuste, con nota)
export const reviewTrabajoAdicionalRequest = (id, body) =>
  api.post(`${BASE}/${id}/revision`, body).then((res) => res.data.data.trabajo);
