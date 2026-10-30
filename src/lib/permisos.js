import clsx from "clsx";

export const PERMISO_TIPOS = [
  { value: "PERMISO", label: "Permiso" },
  { value: "ENFERMEDAD", label: "Enfermedad" },
  { value: "VACACIONES", label: "Vacaciones" },
  { value: "OTRO", label: "Otro motivo" },
];

// Solo la oficina: dia libre / descanso (no cuenta como falta).
export const PERMISO_TIPOS_OFICINA = [...PERMISO_TIPOS, { value: "DESCANSO", label: "Dia libre / descanso" }];

export const permisoTipoLabel = (tipo) =>
  PERMISO_TIPOS_OFICINA.find((t) => t.value === tipo)?.label ?? tipo;

export const PERMISO_ESTADOS = {
  PENDIENTE: { label: "En revision", pill: "bg-warning-500/20 text-warning-500" },
  APROBADO: { label: "Aprobado", pill: "bg-success-500/15 text-success-500" },
  RECHAZADO: { label: "Rechazado", pill: "bg-danger-500/20 text-danger-500" },
};

// Estilo de cada dia del calendario: verde = trabajado, rojo = falta, naranja = justificado.
export const DIA_ESTADOS = {
  TRABAJADO: {
    label: "Trabajado",
    cell: "bg-success-500/20 text-success-500 font-semibold",
    dot: "bg-success-500",
  },
  NO_TRABAJADO: {
    label: "No trabajado",
    cell: "bg-danger-500/20 text-danger-500 font-semibold",
    dot: "bg-danger-500",
  },
  JUSTIFICADO: {
    label: "Justificado (aprobado)",
    cell: "bg-warning-500/25 text-warning-500 font-semibold",
    dot: "bg-warning-500",
  },
  PERMISO_PENDIENTE: {
    label: "Permiso en revision",
    cell: "border border-dashed border-warning-500 text-warning-500 font-semibold",
    dot: "border border-dashed border-warning-500",
  },
  DESCANSO: { label: "Dia libre", cell: "bg-line/[0.05] text-ink-300 font-semibold", dot: "bg-ink-400" },
  PROGRAMADO: { label: "Servicio programado", cell: "bg-accent-500/15 text-accent-400 font-semibold", dot: "bg-accent-400" },
  HOY: { label: "Hoy", cell: "text-ink-50", dot: "" },
  FUTURO: { label: "", cell: "text-ink-300", dot: "" },
  SIN_DATOS: { label: "", cell: "text-ink-400 opacity-50", dot: "" },
};

export const LEGEND_ESTADOS = ["TRABAJADO", "NO_TRABAJADO", "JUSTIFICADO", "PERMISO_PENDIENTE", "DESCANSO", "PROGRAMADO"];

export const diaCellClass = (dia, selected) =>
  clsx(
    "relative flex aspect-square w-full flex-col items-center justify-center rounded-xl text-[14px] transition-colors",
    DIA_ESTADOS[dia.estado].cell,
    dia.estado === "HOY" && "ring-2 ring-accent-400",
    selected && "outline outline-2 outline-offset-2 outline-ink-50"
  );

export const anticipacionText = (permiso) => {
  const d = permiso.anticipacionDias;
  if (permiso.cargadoPorOficina) return "Cargado por la oficina";
  if (d > 0) return `Avisado con ${d} ${d === 1 ? "dia" : "dias"} de anticipacion`;
  if (d === 0) return "Avisado el mismo dia";
  return `Justificado ${-d} ${d === -1 ? "dia" : "dias"} despues`;
};

export const PERMISO_ESTADO_RANK = { PENDIENTE: 0, APROBADO: 1, RECHAZADO: 2 };

// Variante "pro" de la celda (calendario del chofer): fondo oscuro con borde fino, y borde de color
// segun el estado.
const PRO_BORDER = {
  TRABAJADO: "border-success-500/50",
  NO_TRABAJADO: "border-danger-500/40",
  JUSTIFICADO: "border-warning-500/50",
  PERMISO_PENDIENTE: "border-dashed border-warning-500",
  DESCANSO: "border-line/10",
  PROGRAMADO: "border-accent-400/40",
};

export const diaCellClassPro = (dia, selected, isToday) =>
  clsx(
    "relative flex aspect-[1/0.92] w-full flex-col items-center justify-center rounded-xl border text-[15px] transition-colors hover:brightness-110 sm:aspect-[1/0.62]",
    // Neutro solo para los dias sin estado de color (si no, pisaria el fondo/borde del estado).
    PRO_BORDER[dia.estado] ? PRO_BORDER[dia.estado] : "border-line/10 bg-line/[0.04] text-ink-100",
    DIA_ESTADOS[dia.estado].cell,
    isToday && "ring-2 ring-success-500 ring-offset-0",
    selected && "outline outline-2 outline-offset-2 outline-ink-50"
  );
