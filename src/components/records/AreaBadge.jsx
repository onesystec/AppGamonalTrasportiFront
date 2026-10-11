import { AREAS_BY_KEY } from "../../lib/recordAreas";

// Circulo con las iniciales del area (DHL amarillo con letras rojas, AB rojo, Extras Piazza celeste con "PS").
export const AreaBadge = ({ areaKey, size = 36 }) => {
  const area = AREAS_BY_KEY[areaKey];
  if (!area) return null;
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor: area.colors.bg,
        color: area.colors.fg,
        fontSize: size * 0.3,
      }}
    >
      {area.initials}
    </span>
  );
};
