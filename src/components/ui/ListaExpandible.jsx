import clsx from "clsx";
import { useState } from "react";

// Lista compacta: una fila por elemento (resumen en una linea y, a la derecha, sus acciones rapidas); al pulsar la fila se despliega el detalle debajo.
// Reemplaza a las tarjetas cuando hay muchos elementos que revisar y cada tarjeta ocupaba demasiado espacio.
export const ListaExpandible = ({ children, className }) => (
  <ul className={clsx("overflow-hidden rounded-2xl border border-line/15 bg-line/[0.03]", className)}>{children}</ul>
);

// resumen: lo que se ve en la fila; acciones: botones a la derecha (no abren el detalle); error: aviso bajo la fila; children: el detalle desplegable.
export const FilaExpandible = ({ resumen, acciones, error, children, abierta: abiertaInicial = false }) => {
  const [abierta, setAbierta] = useState(abiertaInicial);
  return (
    <li className="border-b border-line/10 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 transition-colors hover:bg-line/[0.05] sm:px-4">
        <button type="button" onClick={() => setAbierta((v) => !v)} aria-expanded={abierta} className="flex min-w-0 flex-1 basis-[260px] items-center gap-3 text-left">
          <span className={clsx("shrink-0 text-[9px] text-ink-400 transition-transform", abierta && "rotate-90")}>▶</span>
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-0.5">{resumen}</span>
        </button>
        {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
      </div>
      {error && <p className="px-4 pb-2 text-[12px] text-danger-500">{error}</p>}
      {abierta && <div className="border-t border-line/10 bg-line/[0.04] px-3 py-3 sm:px-4">{children}</div>}
    </li>
  );
};

// Un dato del resumen con ancho fijo en pantallas grandes (para que las filas queden alineadas como columnas).
export const Celda = ({ ancho = "sm:w-28", className, title, children }) => (
  <span title={title} className={clsx("min-w-0 truncate text-[13px]", ancho, className)}>
    {children}
  </span>
);
