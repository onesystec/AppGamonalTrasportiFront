import { api } from "./api";

const BASE = "/horas";

// body: { inicio, fin, esperaMin, pausaMin, kilometrosReales?, comentarios? } - inicio/fin como
// "AAAA-MM-DDTHH:mm" en hora de Roma. Devuelve { jornada, pago }.
export const submitHorasRequest = (recordId, body) =>
  api.post(`${BASE}/${recordId}`, body).then((res) => res.data.data);

// Pago por km: el chofer termina el servicio (queda entregado) y declara solo su espera.
// body: { esperaMin, comentarios? }. Devuelve { estado, esperaMin, pago }.
export const cierreServicioRequest = (recordId, body) =>
  api.post(`${BASE}/${recordId}/cierre`, body).then((res) => res.data.data);

// body: { accion: "APROBAR" | "DEVOLVER", nota?, inicio?, fin?, esperaMin?, pausaMin? }.
export const reviewHorasRequest = (recordId, body) =>
  api.post(`${BASE}/${recordId}/revision`, body).then((res) => res.data.data);

// Cola de aprobacion (OWNER/ADMIN). estado: PENDIENTE (default) | DEVUELTAS | TODAS.
export const listHorasPendientesRequest = (estado) =>
  api.get(`${BASE}/pendientes`, { params: { estado } }).then((res) => res.data.data.items);

// Recalcula a mano las paradas del vehiculo durante la jornada de un servicio (OWNER/ADMIN).
export const recalcParadasRequest = (recordId) =>
  api.post(`${BASE}/${recordId}/paradas`).then((res) => res.data.data);

// El chofer que recibio un servicio de otro indica a que hora le dieron el paquete.
// hora: "AAAA-MM-DDTHH:mm" en hora de Roma. Devuelve { traspasoHora, estado }.
export const setRecepcionRequest = (recordId, hora) =>
  api.post(`${BASE}/${recordId}/recepcion`, { hora }).then((res) => res.data.data);

// Recalcula la estimacion por ruta de un servicio (sin GPS): retiro + paradas + retorno (OWNER/ADMIN).
// Devuelve { estimacionRuta, avisos }.
export const recalcEstimacionRequest = (recordId) =>
  api.post(`${BASE}/${recordId}/estimacion`).then((res) => res.data.data);
