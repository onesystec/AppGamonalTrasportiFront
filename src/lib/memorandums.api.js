import { api } from "./api";

// Los que recibio el usuario (cualquier cargo): se ve el asunto; el contenido se abre despues de confirmar.
export const listMemorandumsRecibidosRequest = () => api.get("/memorandums/mine").then((res) => res.data.data.memorandums);

// Un toque ("he leido y entiendo") o la firma manuscrita (PNG en base64), segun el nivel del memorandum.
export const confirmMemorandumRequest = (id, firma) =>
  api.post(`/memorandums/${id}/firma`, { acepto: true, ...(firma ? { firma } : {}) }).then((res) => res.data.data);

// URL temporal del PDF (unos 2 minutos).
export const getMemorandumFileRequest = (id) => api.get(`/memorandums/${id}/archivo`).then((res) => res.data.data);

// Emitir (Admin, Recursos Humanos y Responsables): tipos, zonas y personas que puede elegir quien emite.
export const getMemorandumOptionsRequest = () => api.get("/memorandums/opciones").then((res) => res.data.data);
export const emitMemorandumRequest = (payload) => api.post("/memorandums", payload).then((res) => res.data.data.memorandum);
export const listMemorandumsEmitidosRequest = () => api.get("/memorandums/emitidos").then((res) => res.data.data.memorandums);
export const getMemorandumEmitidoRequest = (id) => api.get(`/memorandums/emitidos/${id}`).then((res) => res.data.data.memorandum);
export const remindMemorandumRequest = (id) => api.post(`/memorandums/${id}/recordar`).then((res) => res.data.data);
export const deleteMemorandumRequest = (id) => api.delete(`/memorandums/${id}`);
