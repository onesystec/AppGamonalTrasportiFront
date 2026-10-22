import { api } from "./api";

const BASE = "/mancato-pagamentos";

// fields: texto (los vacios/undefined se omiten); files: { foto, comprobante } (File).
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
export const listMancatosRequest = (params) =>
  api.get(BASE, { params }).then((res) => res.data.data);

// Cantidad y total en plata por estado: { VENCIDO, PENDIENTE, PAGADO } -> { count, total }.
export const getMancatoSummaryRequest = (params) =>
  api.get(`${BASE}/summary`, { params }).then((res) => res.data.data.summary);

// Resumen por mes (de la fecha del transito) para los acordeones por mes: [{ mes: "2026-06", count, total, PENDIENTE/VENCIDO/PAGADO: { count, total } }],
// del mas reciente al mas antiguo. Mismos filtros que el resumen (sin estado).
export const getMancatoMesesRequest = (params) =>
  api.get(`${BASE}/meses`, { params }).then((res) => res.data.data.meses);

// Indicadores del encabezado: deuda abierta, variacion contra el mes anterior, deuda por
// chofer, evolucion mensual y datos para la recomendacion.
export const getMancatoStatsRequest = (params) =>
  api.get(`${BASE}/stats`, { params }).then((res) => res.data.data.stats);

export const getMancatoRequest = (id) =>
  api.get(`${BASE}/${id}`).then((res) => res.data.data.mancato);

export const createMancatoRequest = (fields, files) =>
  api.post(BASE, toFormData(fields, files)).then((res) => res.data.data.mancato);

export const updateMancatoRequest = (id, fields, files) =>
  api.patch(`${BASE}/${id}`, toFormData(fields, files)).then((res) => res.data.data.mancato);

export const deleteMancatoRequest = (id) => api.delete(`${BASE}/${id}`);

// Servicios del vehiculo cerca del transito, para elegir a mano a cual pertenece (OWNER/ADMIN).
export const listMancatoCandidatesRequest = (id) =>
  api.get(`${BASE}/${id}/candidatos`).then((res) => res.data.data.candidatos);

// Reevalua los mancatos de un mes (solo el Admin): aplicar=false solo simula. Devuelve el resumen y las listas de cambios.
export const reevaluarMancatosRequest = ({ month, aplicar = false, incluirFijados = false }) =>
  api.post(`${BASE}/reevaluar`, { month, aplicar, incluirFijados }).then((res) => res.data.data.resultado);

// Vuelve a evaluar los mancatos que la oficina no fijo a mano. Devuelve { revisados, cambiados }.
export const rematchMancatosRequest = () =>
  api.post(`${BASE}/reasignar`).then((res) => res.data.data.resultado);
