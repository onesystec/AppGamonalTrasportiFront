// Modulos que se le pueden activar a un usuario cliente (mismos valores que el servidor, constants/clientes.js). Todos son de
// solo lectura y sobre los servicios de su propia empresa.
export const CLIENTE_MODULOS = [
  { key: "MAPA", label: "Mapa de targas en camino", hint: "La vista principal: solo la targa y su parada" },
  { key: "LISTA", label: "Lista de servicios en camino con hora estimada", hint: "Minutos de retraso incluidos" },
  { key: "AVISOS", label: "Avisos al celular de salida, retraso y entrega", hint: "Notificaciones en la app del celular" },
  { key: "HISTORIAL", label: "Historial de servicios", hint: "Servicios del mes, con su estado" },
  { key: "FOTOS", label: "Fotos de entrega y bolla", hint: "Se ven desde el historial" },
  { key: "EXCEL", label: "Descargar sus servicios en Excel", hint: "Se descarga desde el historial" },
];
export const CLIENTE_MODULOS_DEFAULT = ["MAPA", "LISTA", "AVISOS"];

// Fotos y Excel salen del historial: marcarlos marca tambien el historial, y quitar el historial los quita.
export const toggleModulo = (current, key) => {
  const on = current.includes(key);
  let next = on ? current.filter((k) => k !== key) : [...current, key];
  if (!on && (key === "FOTOS" || key === "EXCEL") && !next.includes("HISTORIAL")) next = [...next, "HISTORIAL"];
  if (on && key === "HISTORIAL") next = next.filter((k) => k !== "FOTOS" && k !== "EXCEL");
  return next;
};
