import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Conserva la referencia al servicio cuando el perfil no puede abrir su ficha.
export const FinanceRecordLink = ({ children, className, ...props }) => {
  const { user } = useAuth();
  if (user?.cargo === "RRHH") return <span className={className}>{children}</span>;
  return <Link className={className} {...props}>{children}</Link>;
};
