import { api } from "./api";

// Servicios en camino con posicion (GPS del vehiculo, del celular o simulada), llegada estimada y alertas.
// incluirAntiguos: tambien los servicios con muchas horas de retraso (los que nadie cerro), que por defecto no se muestran.
export const listSeguimientoRequest = ({ incluirAntiguos = false } = {}) =>
  api.get("/seguimiento", { params: incluirAntiguos ? { incluirAntiguos: 1 } : undefined }).then((res) => res.data.data);

// Ruta del servicio elegido (lo que falta desde la posicion actual, o la planificada si no hay GPS) y sus paradas.
export const getRutaSeguimientoRequest = (id) => api.get(`/seguimiento/${id}/ruta`).then((res) => res.data.data.ruta);
