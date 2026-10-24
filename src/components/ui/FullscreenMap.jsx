import clsx from "clsx";
import { useEffect, useState } from "react";
import { useT } from "../../i18n/index.jsx";
import { notifyParentFullscreen } from "../../lib/embedded";

const ExpandIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);

const CollapseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  </svg>
);

// Contenedor de un mapa con un boton para verlo en pantalla completa: ocupa todo el marco de la app (y, dentro de OneSystec, tambien su pantalla).
// `className` es el tamano normal; en pantalla completa pasa a cubrirlo todo y el mapa de adentro (alto/ancho 100%) lo llena.
export const FullscreenMap = ({ className, children }) => {
  const t = useT();
  const [full, setFull] = useState(false);

  useEffect(() => {
    notifyParentFullscreen(full);
    // Google Maps recalcula su tamano al cambiar el contenedor; el evento lo adelanta para que no quede una franja gris.
    const timer = setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
    return () => clearTimeout(timer);
  }, [full]);

  // Si la persona sale de la vista con el mapa abierto, OneSystec no debe quedarse con la cabecera escondida.
  useEffect(() => () => notifyParentFullscreen(false), []);

  useEffect(() => {
    if (!full) return undefined;
    const onKey = (e) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  return (
    <div className={clsx(full ? "fixed inset-0 z-[100] h-dvh w-screen bg-background" : className)}>
      {children}
      <button
        type="button"
        onClick={() => setFull((value) => !value)}
        aria-label={full ? t("fullscreen.exit") : t("fullscreen.enter")}
        title={full ? t("fullscreen.exit") : t("fullscreen.title")}
        className="absolute left-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-800 shadow-md hover:bg-gray-100"
      >
        {full ? <CollapseIcon /> : <ExpandIcon />}
      </button>
    </div>
  );
};
