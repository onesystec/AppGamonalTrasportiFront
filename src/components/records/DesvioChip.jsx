// "Desvío": el recorrido real del vehiculo (GPS) se alejo mucho de la ruta planificada (la lista del servicio lleva `recorridoEstado`).
export const DesvioChip = ({ recorridoEstado, className = "" }) => {
  if (recorridoEstado !== "REVISAR") return null;
  return (
    <span
      title="El recorrido real se desvió bastante de la ruta planificada. Abre el servicio y pulsa «Ver recorrido real»."
      className={`inline-flex items-center gap-1 rounded-full bg-warning-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-warning-500 ${className}`}
    >
      ⚠ Desvío
    </span>
  );
};
