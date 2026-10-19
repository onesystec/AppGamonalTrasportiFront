import { api } from "./api";

const BASE = "/finanzas";

// month: "AAAA-MM" (por defecto, el mes en curso de Roma).
export const getFinanzasResumenRequest = (month) =>
  api.get(`${BASE}/resumen`, { params: { month } }).then((res) => res.data.data.resumen);

// Pago a choferes del mes: total, resumen por chofer y (si se pide un chofer, o si quien
// consulta es chofer) el detalle servicio por servicio.
export const getPagosChoferesRequest = (params) =>
  api.get(`${BASE}/pagos`, { params }).then((res) => res.data.data.pagos);

// Planilla de presencias del mes (Excel, una plaza por chofer). formato: "decimal" (6,68) o "hhmm" (6:41). Solo OWNER/ADMIN.
export const downloadPresenciasRequest = ({ month, formato }) =>
  api.get(`${BASE}/presencias`, { params: { month, formato }, responseType: "blob" }).then((res) => res.data);

// Gastos cargados en los servicios del mes (peajes, Area C, hotel...). Solo OWNER/ADMIN.
export const getGastosServiciosRequest = (month) =>
  api.get(`${BASE}/gastos-servicios`, { params: { month } }).then((res) => res.data.data.gastos);

// Tarifas por km (EUR/km): { AUTO_FURGONCINO, H1_L1, H2_L2, CASONATO, DHL_AB }. Las ve la oficina y las cambia el Admin.
export const getTarifasKmRequest = () => api.get(`${BASE}/tarifas-km`).then((res) => res.data.data.tarifas);

export const setTarifasKmRequest = (tarifas) => api.put(`${BASE}/tarifas-km`, tarifas).then((res) => res.data.data.tarifas);
