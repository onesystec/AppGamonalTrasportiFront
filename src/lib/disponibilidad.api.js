import { api } from "./api";

// Disponibilidad de choferes y vehiculos dia por dia. params: { desde, hasta } (AAAA-MM-DD; maximo 62 dias). Solo OWNER/ADMIN.
export const getDisponibilidadRequest = (params) => api.get("/disponibilidad", { params }).then((res) => res.data.data.disponibilidad);
