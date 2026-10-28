import { api } from "./api";

const BASE = "/otros-gastos";

// fields: texto (los vacios/undefined se omiten); comprobante: File (foto o PDF) opcional.
const toFormData = (fields = {}, comprobante = null) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  if (comprobante) formData.append("comprobante", comprobante);
  return formData;
};

// { items, total, pendientes }: el chofer ve los suyos; la oficina, los de todos. params: { estado, driverId, month }.
export const listOtrosGastosRequest = (params) => api.get(BASE, { params }).then((res) => res.data.data);
export const createOtroGastoRequest = (fields, comprobante) =>
  api.post(BASE, toFormData(fields, comprobante)).then((res) => res.data.data.gasto);
export const updateOtroGastoRequest = (id, fields, comprobante) =>
  api.patch(`${BASE}/${id}`, toFormData(fields, comprobante)).then((res) => res.data.data.gasto);
export const deleteOtroGastoRequest = (id) => api.delete(`${BASE}/${id}`);
// body: { accion: "REEMBOLSAR" | "RECHAZAR", nota? } (la nota es obligatoria al rechazar)
export const reviewOtroGastoRequest = (id, body) => api.post(`${BASE}/${id}/revision`, body).then((res) => res.data.data.gasto);
