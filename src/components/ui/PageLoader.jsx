import clsx from "clsx";
import { isChoferView, useChoferTip } from "../../lib/choferTips";
import { Spinner } from "./Spinner";

// Loader de pantalla/seccion completa, reusable en toda la app. Mismo Spinner (CSS
// puro, sin libs) que ya se usaba suelto y repetido en cada pagina - solo se le suma
// un mensaje, para no agregar peso al bundle.
// Al chofer, en el loader de pantalla completa (sin className propio), ademas se le muestra un consejo de trabajo (ver lib/choferTips.js).
export const PageLoader = ({
  message = "Configurando para tu mejor experiencia...",
  className,
}) => {
  const tip = useChoferTip(!className && isChoferView());
  return (
    <div className={clsx(className ?? "flex flex-col items-center justify-center gap-3 py-16")}>
      <Spinner className="h-6 w-6 border-line/20 border-t-line" />
      <p className="text-sm text-ink-400">{message}</p>
      {tip && (
        <div className="mt-4 max-w-sm rounded-2xl border border-accent-400/25 bg-accent-500/10 px-5 py-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-400">Consejo</p>
          <p className="mt-1 text-[14px] leading-snug text-ink-100">{tip}</p>
        </div>
      )}
    </div>
  );
};
