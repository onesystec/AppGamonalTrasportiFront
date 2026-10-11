import { api } from "./api";

const BASE = "/multas";

// fields: texto (los vacios/undefined se omiten); files: { multa, comprobante } (File).
const toFormData = (fields = {}, files = {}) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  Object.entries(files).forEach(([key, file]) => {
    if (file) formData.append(key, file);
  });
  return formData;
};

// Devuelve { items, total, page, pageSize }.
export const listMultasRequest = (params) => api.get(BASE, { params }).then((res) => res.data.data);

// Cantidad y total en plata por estado: { VENCIDO, PENDIENTE, PAGADO } -> { count, total }.
export const getMultaSummaryRequest = (params) =>
  api.get(`${BASE}/summary`, { params }).then((res) => res.data.data.summary);

// Indicadores del encabezado: deuda abierta, lo que falta descontar, evolucion, etc.
export const getMultaStatsRequest = (params) =>
  api.get(`${BASE}/stats`, { params }).then((res) => res.data.data.stats);

export const getMultaRequest = (id) => api.get(`${BASE}/${id}`).then((res) => res.data.data.multa);

export const createMultaRequest = (fields, files) =>
  api.post(BASE, toFormData(fields, files)).then((res) => res.data.data.multa);

export const updateMultaRequest = (id, fields, files) =>
  api.patch(`${BASE}/${id}`, toFormData(fields, files)).then((res) => res.data.data.multa);

export const deleteMultaRequest = (id) => api.delete(`${BASE}/${id}`);

// Quien llevaba esa unidad el dia de la infraccion (cruza con Registros): { vehiculoEncontrado,
// candidatos: [{ id, nombre, apellido, servicios, desde, hasta }], asignados: [...] }.
export const suggestMultaDriverRequest = (targa, fecha) =>
  api.get(`${BASE}/sugerencia-chofer`, { params: { targa, fecha } }).then((res) => res.data.data.sugerencia);

// Quien pudo ser el responsable de una multa SIN chofer (solo sugiere, no asigna): { modo, resumen, fechaBase, hora,
// candidatos: [{ id, nombre, apellido, confianza: ALTA|MEDIA|BAJA, score, motivos: [texto] }] }.
export const getMultaSuggestionRequest = (id) =>
  api.get(`${BASE}/${id}/sugerencia`).then((res) => res.data.data.sugerencia);

// Lo mismo para varias a la vez (filas visibles de un acordeon, hasta 20): { [multaId]: sugerencia }.
export const getMultasSuggestionsRequest = (ids) =>
  api.get(`${BASE}/sugerencias`, { params: { ids: ids.join(",") } }).then((res) => res.data.data.sugerencias);

// Para la campanita: vencidas, por vencer (7 dias) y descuentos pendientes.
export const listMultaAlertsRequest = () => api.get(`${BASE}/alertas`).then((res) => res.data.data.alerts);

// El chofer sube el comprobante de una multa que paga el mismo: queda "por confirmar" hasta que la
// oficina la marque como pagada.
export const uploadMyMultaComprobanteRequest = (id, file) => {
  const formData = new FormData();
  formData.append("comprobante", file);
  return api.post(`${BASE}/${id}/comprobante-chofer`, formData).then((res) => res.data.data.multa);
};
