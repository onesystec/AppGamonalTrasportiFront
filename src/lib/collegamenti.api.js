import { api } from "./api";

// App collegate (solo Owner): conexion segura con otras apps One Driver (App Piazza le asigna servicios a Gamonal).
// Devuelve { codice, scadeAt, nome, cifratura, collegamenti: [{ id, stato, remotoNome, client, ultimoErrore, ... }] }.
export const getCollegamentiRequest = () => api.get("/collegamenti").then((res) => res.data.data);
export const rigeneraCodiceRequest = () => api.post("/collegamenti/codice").then((res) => res.data.data);
// clientId = ficha de cliente existente; sin eso se crea una con el nombre de la otra empresa.
export const accettaCollegamentoRequest = (id, clientId) =>
  api.post(`/collegamenti/${id}/accetta`, { clientId: clientId || null }).then((res) => res.data.data.collegamento);
// Interruptor del Owner: compartir (o no) con esa app los servicios en curso de Gamonal (posicion, chofer, targa y cliente).
export const impostaCondivisioneRequest = (id, condividiServiziInCorso) =>
  api.patch(`/collegamenti/${id}/condivisione`, { condividiServiziInCorso }).then((res) => res.data.data.collegamento);
export const rifiutaCollegamentoRequest = (id) => api.post(`/collegamenti/${id}/rifiuta`).then((res) => res.data);
export const scollegaRequest = (id) => api.delete(`/collegamenti/${id}`).then((res) => res.data);
// Volver a avisar a la otra app el estado, chofer y targa de una solicitud ya aceptada.
export const reinviaSolicitudRequest = (solicitudId) => api.post(`/collegamenti/solicitudes/${solicitudId}/reinvia`).then((res) => res.data.data);
