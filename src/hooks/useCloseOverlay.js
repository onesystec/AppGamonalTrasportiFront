import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

// Cerrar una pantalla de detalle/alta (un servicio, un chofer, una multa...) devuelve a donde estaba la persona antes de abrirla: el Dashboard, Pago a
// choferes, el Mapa, una lista... Se hace "volviendo atras" en el historial de la app en vez de mandar siempre a la lista de esa seccion.
// Solo si la pantalla se abrio directo por la URL (no hay una pantalla anterior de la app a la que volver) va a `fallback`.
export const useCloseOverlay = (fallback) => {
  const navigate = useNavigate();
  return useCallback(() => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
};
