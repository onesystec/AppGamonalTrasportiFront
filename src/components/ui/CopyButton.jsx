import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "./icons";

// Copia un texto al portapapeles. Usa la API moderna y, si no esta disponible
// (algunos WebView o http), cae al metodo clasico con un textarea oculto.
const copyText = async (text) => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // sigue con el metodo clasico
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

// Boton pequeno de copiar. Funciona aunque este dentro de un enlace (no abre el enlace).
export const CopyButton = ({ value, label = "Copiar", className, iconClassName = "h-3.5 w-3.5" }) => {
  const [status, setStatus] = useState("idle"); // idle | ok | error
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await copyText(String(value ?? ""));
    setStatus(ok ? "ok" : "error");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 1500);
  };

  const title = status === "ok" ? "Copiado" : status === "error" ? "No se pudo copiar" : label;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-md p-1 align-middle transition-colors",
        status === "ok"
          ? "text-success-500"
          : status === "error"
            ? "text-danger-500"
            : "text-ink-400 hover:bg-line/10 hover:text-ink-50",
        className
      )}
    >
      {status === "ok" ? <CheckIcon className={iconClassName} /> : <CopyIcon className={iconClassName} />}
    </button>
  );
};
