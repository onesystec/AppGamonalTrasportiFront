import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { useT } from "../../i18n/index.jsx";
import { buildWhatsappMessage } from "../../lib/solicitudes";
import { copyText } from "../ui/CopyButton";
import { CheckIcon, CopyIcon } from "../ui/icons";

// "Copiar para WhatsApp": arma el mensaje de la solicitud segun su tipo (DHL, AB Service...) y lo copia. Si a la plantilla le falta algun dato
// lo copia igual, sin esa linea, y avisa cual falta.
export const SolicitudWhatsappButton = ({ solicitud, className }) => {
  const t = useT();
  const [status, setStatus] = useState("idle"); // idle | ok | error
  const [missing, setMissing] = useState([]);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = async () => {
    const message = buildWhatsappMessage(solicitud);
    setMissing(message.missing);
    setStatus((await copyText(message.text)) ? "ok" : "error");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 4000);
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
          status === "ok" ? "bg-success-500/15 text-success-500" : status === "error" ? "bg-danger-500/15 text-danger-500" : "bg-accent-500/15 text-accent-300 hover:bg-accent-500/25",
          className
        )}
      >
        {status === "ok" ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
        {status === "ok" ? t("wa.copied") : status === "error" ? t("wa.failed") : t("wa.copy")}
      </button>
      {status !== "idle" && missing.length > 0 && <span className="text-[11.5px] text-warning-500">{t("wa.missing", { items: missing.map((code) => t(`wa.missing.${code}`)).join(", ") })}</span>}
    </span>
  );
};
