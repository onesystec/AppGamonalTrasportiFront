import { api } from "./api";

// Choferes con las fechas de sus documentos y vehiculos con seguro, revision y tagliando, cada fecha con su estado.
// Owner y Recursos Humanos: todo; Responsable: solo su zona.
export const getVencimientosRequest = () => api.get("/vencimientos").then((res) => res.data.data.vencimientos);
