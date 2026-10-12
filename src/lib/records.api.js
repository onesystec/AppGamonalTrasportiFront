import { api } from "./api";

// params: { days?: number } - sin days, trae todo el historico (comportamiento de
// siempre); con days, acota a los ultimos N dias (ver ?days en record.controller.js).
export const listRecordsRequest = (params) =>
  api.get("/records", { params }).then((res) => res.data.data.records);

// Panel de "Pendientes" de Registros: acotado a los servicios de HOY en el backend,
// no el historico completo (no tiene sentido traer miles de registros para filtrar
// los pocos que estan en curso ahora mismo).
export const listPendingRecordsRequest = () =>
  api.get("/records/pending").then((res) => res.data.data.records);

// Buscador de Registros (codigo/cliente/chofer/destino) - filtra en el backend, no
// trae el historico completo para buscar en el navegador.
export const searchRecordsRequest = (q) =>
  api.get("/records/search", { params: { q } }).then((res) => res.data.data.records);

// Export CSV de Registros (ver ExportRecordsModal.jsx) - todos los filtros son
// opcionales, se mandan tal cual (undefined se omite solo, axios no lo serializa).
export const exportRecordsRequest = (filters) =>
  api.get("/records/export", { params: filters }).then((res) => res.data.data.records);

// Export con TODA la informacion de cada servicio: { columnas, filas } ya escritas como texto (ver recordExport.service.js).
export const exportFullRecordsRequest = (filters) =>
  api
    .get("/records/export", { params: { ...filters, formato: "completo" }, timeout: 120000 })
    .then((res) => res.data.data.csv);

// Resumen liviano (id/fechaServicio/estado) de un mes, para armar el acordeon de
// dias sin traer stops/ruta/economico de cada registro.
export const listRecordsSummaryByMonthRequest = (year, month) =>
  api.get(`/records/${year}/${month}/summary`).then((res) => res.data.data.records);

// Registros completos de un dia especifico (se piden recien al desplegar ese dia).
export const listRecordsByDayRequest = (year, month, day) =>
  api.get(`/records/${year}/${month}/${day}`).then((res) => res.data.data.records);

// Registros completos de un mes especifico (ej. ranking de KM de flota del mes en
// Vehiculos) - acotado a ese mes, no el historico completo.
export const listRecordsByMonthRequest = (year, month) =>
  api.get(`/records/${year}/${month}`).then((res) => res.data.data.records);

export const createRecordRequest = (payload) =>
  api.post("/records", payload).then((res) => res.data.data.record);

export const getRecordRequest = (id) =>
  api.get(`/records/${id}`).then((res) => res.data.data.record);

export const updateRecordRequest = (id, payload) =>
  api.patch(`/records/${id}`, payload).then((res) => res.data.data.record);

// Solo OWNER/ADMIN (el backend lo restringe igual). El registro se elimina
// definitivamente, con sus paradas y archivos asociados.
export const deleteRecordRequest = (id) => api.delete(`/records/${id}`);

export const listRecordFilesRequest = (id) =>
  api.get(`/records/${id}/files`).then((res) => res.data.data.files);

// A demanda desde el mapa: solo se pide para el servicio abierto/seleccionado, no para
// todos los servicios activos en cada refresco de posiciones.
export const getRecordLiveEtaRequest = (id) =>
  api.get(`/records/${id}/eta-en-vivo`).then((res) => res.data.data.eta);

export const uploadRecordFileRequest = (id, file, tipoArchivo) => {
  const formData = new FormData();
  formData.append("archivo", file);
  formData.append("tipoArchivo", tipoArchivo);
  return api
    .post(`/records/${id}/files`, formData)
    .then((res) => res.data.data.file);
};

// Switches de peajes y carburante de un servicio (rapido: no sincroniza con AppSheet).
export const updateDeclaracionesRequest = (id, data) =>
  api.patch(`/records/${id}/declaraciones`, data).then((res) => res.data.data.record);

// Excepcion de la oficina: al servicio no se le exigen peajes ni combustible (con motivo).
export const setFaltantesExcepcionRequest = (id, { aplicar, nota }) =>
  api.patch(`/records/${id}/excepcion`, { aplicar, nota }).then((res) => res.data.data.record);

// Servicios compactados (varios servicios de un chofer en un solo viaje): solo Admin/Responsable.
export const listCompactablesRequest = () =>
  api.get("/records/compactar/sugerencias").then((res) => res.data.data.servicios);

// recordIds en el orden de las paradas: el primero es el servicio principal.
export const compactarRequest = (recordIds) =>
  api.post("/records/compactar", { recordIds }).then((res) => res.data.data.viaje);

export const reordenarCompactadoRequest = (compactadoId, recordIds) =>
  api.patch(`/records/compactar/${compactadoId}`, { recordIds }).then((res) => res.data.data.viaje);

export const descompactarRequest = (compactadoId) => api.delete(`/records/compactar/${compactadoId}`);

// La oficina corrige el reparto de km reales de un viaje: reparto = [{ id, km }] con todos sus servicios.
export const ajustarKmViajeRequest = (compactadoId, { reparto, nota }) =>
  api.put(`/records/compactar/${compactadoId}/km`, { reparto, ...(nota ? { nota } : {}) }).then((res) => res.data.data.viaje);

// Registros sin sustentar del propio chofer: peajes y carburante de sus servicios hechos que nadie subio ni declaro.
// { registros, servicios }.
export const getSinSustentarRequest = () => api.get("/records/sin-sustentar").then((res) => res.data.data);

// Circuito del servicio (o del viaje) para verlo en un mapa: { circuito, puntos: [{ tipo, nombre, lat, lng }], geometria }.
export const getCircuitoMapaRequest = (id) => api.get(`/records/${id}/circuito`).then((res) => res.data.data);

// Reprogramacion (solo Admin/Responsable). "previa" devuelve la hora de salida sugerida para una ETA (o la ETA para una
// salida) y los avisos de choque; "km-gps" los km que hizo el vehiculo desde que salio; "reprogramar" crea el servicio nuevo.
export const getReprogramacionPreviaRequest = (id, params) =>
  api.get(`/records/${id}/reprogramacion/previa`, { params }).then((res) => res.data.data);

export const getReprogramacionKmGpsRequest = (id) =>
  api.get(`/records/${id}/reprogramacion/km-gps`, { timeout: 40000 }).then((res) => res.data.data);

export const reprogramarRecordRequest = (id, payload) =>
  api.post(`/records/${id}/reprogramar`, payload).then((res) => res.data.data);

export const deshacerReprogramacionRequest = (id) =>
  api.post(`/records/${id}/reprogramacion/deshacer`).then((res) => res.data.data.record);
