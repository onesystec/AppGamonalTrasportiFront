// Lo que puede haber en un dia de un chofer o de un vehiculo, y como se pinta. Libre = no hay nada ese dia. Los textos y las letras de cada
// estado salen del diccionario de idiomas (disp.estado.* y disp.letra.*).
export const ESTADOS = {
  LIBRE: { cell: "bg-success-500/20", chip: "bg-success-500/15 text-success-500", dot: "bg-success-500" },
  SERVICIO: { cell: "bg-accent-500/35 text-accent-300", chip: "bg-accent-500/20 text-accent-300", dot: "bg-accent-400" },
  PERMISO: { cell: "bg-warning-500/35 text-warning-500", chip: "bg-warning-500/20 text-warning-500", dot: "bg-warning-500" },
  VACACIONES: { cell: "bg-warning-500/35 text-warning-500", chip: "bg-warning-500/20 text-warning-500", dot: "bg-warning-500" },
  OTRO: { cell: "bg-warning-500/35 text-warning-500", chip: "bg-warning-500/20 text-warning-500", dot: "bg-warning-500" },
  ENFERMEDAD: { cell: "bg-danger-500/30 text-danger-500", chip: "bg-danger-500/20 text-danger-500", dot: "bg-danger-500" },
  DESCANSO: { cell: "bg-[#8b5cf6]/25 text-[#a78bfa]", chip: "bg-[#8b5cf6]/20 text-[#a78bfa]", dot: "bg-[#8b5cf6]" },
  MANTENIMIENTO: { cell: "bg-danger-500/30 text-danger-500", chip: "bg-danger-500/20 text-danger-500", dot: "bg-danger-500" },
  FUERA_DE_SERVICIO: { cell: "bg-danger-500/30 text-danger-500", chip: "bg-danger-500/20 text-danger-500", dot: "bg-danger-500" },
};

// Leyendas segun lo que se mira.
export const LEYENDA_CHOFERES = ["LIBRE", "SERVICIO", "PERMISO", "VACACIONES", "ENFERMEDAD", "DESCANSO"];
export const LEYENDA_VEHICULOS = ["LIBRE", "SERVICIO", "MANTENIMIENTO", "FUERA_DE_SERVICIO"];

// Las ausencias mandan sobre el servicio (un chofer de vacaciones no esta disponible aunque tenga un servicio puesto: es un choque).
const PRIORIDAD = ["MANTENIMIENTO", "FUERA_DE_SERVICIO", "ENFERMEDAD", "VACACIONES", "PERMISO", "OTRO", "DESCANSO", "SERVICIO"];

// Estado de un dia a partir de lo que dijo el servidor: { key, items, choque, pendiente }.
export const estadoDelDia = (items = []) => {
  if (items.length === 0) return { key: "LIBRE", items, choque: false, pendiente: false };
  const key = PRIORIDAD.find((tipo) => items.some((i) => i.tipo === tipo)) ?? "SERVICIO";
  const principal = items.filter((i) => i.tipo === key);
  return {
    key,
    items,
    // Un permiso todavia sin aprobar no saca al chofer, pero se marca.
    pendiente: key !== "SERVICIO" && principal.every((i) => i.pendiente),
    // Tiene una ausencia y a la vez un servicio ese dia.
    choque: key !== "SERVICIO" && items.some((i) => i.tipo === "SERVICIO"),
  };
};

export const estadoLabel = (t, key) => t(`disp.estado.${key}`);
export const estadoLetra = (t, key) => (key === "LIBRE" ? "" : t(`disp.letra.${key}`));

// Texto de cada cosa de un dia (para la lista y el cuadro flotante).
export const itemTexto = (t, item) => {
  if (item.tipo === "SERVICIO") {
    return item.destino ? t("disp.serviceTo", { codigo: item.codigo, destino: item.destino }) : t("disp.service", { codigo: item.codigo });
  }
  const label = estadoLabel(t, item.tipo);
  return item.pendiente ? t("disp.inReview", { label }) : label;
};

const parts = (day) => new Date(`${day}T00:00:00.000Z`);
// Dia de la semana y fecha corta en el idioma de la pantalla ("mié 28 oct" / "mer 28 ott").
export const diaSemana = (day, locale) => parts(day).toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" }).replace(".", "");
export const esFinDeSemana = (day) => [0, 6].includes(parts(day).getUTCDay());
export const diaCorto = (day, locale) =>
  `${diaSemana(day, locale)} ${Number(day.slice(8, 10))} ${parts(day).toLocaleDateString(locale, { month: "short", timeZone: "UTC" }).replace(".", "")}`;
export const sumarDias = (day, n) => new Date(parts(day).getTime() + n * 86400000).toISOString().slice(0, 10);
