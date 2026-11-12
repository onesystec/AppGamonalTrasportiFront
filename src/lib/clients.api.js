import { api } from "./api";

export const listClientsRequest = () =>
  api.get("/clients").then((res) => res.data.data.clients);

export const updateClientRequest = (id, data) =>
  api.patch(`/clients/${id}`, data).then((res) => res.data.data.client);

export const createClientRequest = (nombre) =>
  api.post("/clients", { nombre }).then((res) => res.data.data.client);
