import { Link } from "react-router-dom";
import { useCloseOverlay } from "../../hooks/useCloseOverlay";

// Enlace "← Volver" de las pantallas de detalle/alta: lleva a la pantalla desde la que se abrio (ver useCloseOverlay). `to` es solo el destino de
// respaldo, cuando no hay pantalla anterior.
export const BackLink = ({ to, className, children }) => {
  const close = useCloseOverlay(to);
  return (
    <Link
      to={to}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        close();
      }}
    >
      {children}
    </Link>
  );
};
