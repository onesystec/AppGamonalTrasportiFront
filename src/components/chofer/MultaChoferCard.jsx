import clsx from "clsx";
import { useState } from "react";
import { Alert } from "../ui/Alert";
import { CameraPickButton } from "../ui/CameraPickButton";
import { Spinner } from "../ui/Spinner";
import { CameraIcon, FileTextIcon } from "../ui/icons";
import { parseApiError } from "../../lib/api";
import { formatCurrency, formatDateOnly } from "../../lib/format";
import { uploadMyMultaComprobanteRequest } from "../../lib/multas.api";

const pill = (tone, text) => (
  <span className={clsx("inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", tone)}>{text}</span>
);

const vencimientoText = (multa) => {
  const dias = multa.diasRestantes;
  const fecha = formatDateOnly(multa.fechaVencimiento);
  if (dias < 0) return `Vencio el ${fecha} (hace ${-dias} ${-dias === 1 ? "dia" : "dias"})`;
  if (dias === 0) return `Vence hoy (${fecha})`;
  return `Vence el ${fecha} (en ${dias} ${dias === 1 ? "dia" : "dias"})`;
};

// Estado visible para el chofer: solo lo que le sirve. Si la paga el, plazo y comprobante; si la paga la
// empresa, solo el importe y si ya se le descuento.
const statusPill = (multa) => {
  if (multa.quienPaga === "A_DESCONTAR") {
    return multa.descontado
      ? pill("bg-success-500/15 text-success-500", "Descontada")
      : pill("bg-warning-500/20 text-warning-500", "Se te va a descontar");
  }
  if (multa.pagado) return pill("bg-success-500/15 text-success-500", "Pagada");
  if (multa.comprobantePendiente) return pill("bg-accent-500/20 text-accent-300", "Comprobante enviado");
  if (multa.estado === "VENCIDO") return pill("bg-danger-500/20 text-danger-500", "Vencida");
  return pill("bg-warning-500/20 text-warning-500", "Por pagar");
};

const linkClass = "inline-flex items-center gap-1.5 rounded-full border border-line/20 px-4 py-2 text-[13px] font-medium text-ink-50 transition hover:bg-line/10";

// Una multa del chofer. onChanged: se llama despues de subir un comprobante.
export const MultaChoferCard = ({ multa, onChanged }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const paysHimself = multa.quienPaga === "CHOFER_PAGO";
  const canUpload = paysHimself && !multa.pagado;

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      await uploadMyMultaComprobanteRequest(multa.id, file);
      onChanged?.();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="glass-surface-sm flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="block break-words text-[15px] font-semibold text-ink-50">Verbale {multa.numeroVerbale}</span>
          <span className="block text-[12px] text-ink-400">
            {multa.targa}
            {multa.fechaInfraccion ? ` · Infraccion ${formatDateOnly(multa.fechaInfraccion)}` : ""}
          </span>
        </div>
        {statusPill(multa)}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <span className="text-[24px] font-semibold leading-none text-ink-50">{formatCurrency(multa.costo)}</span>
        <span className="text-[12px] text-ink-300">
          {paysHimself
            ? multa.pagado
              ? multa.pagadoAt
                ? `Pagada el ${formatDateOnly(multa.pagadoAt)}`
                : "Pagada"
              : vencimientoText(multa)
            : multa.descontado && multa.descontadoAt
              ? `Descontada el ${formatDateOnly(multa.descontadoAt)}`
              : "La paga la empresa y se te descuenta"}
        </span>
      </div>

      {multa.comprobantePendiente && (
        <p className="rounded-lg bg-accent-500/10 px-3 py-2 text-[12px] text-ink-200">
          Enviaste tu comprobante. La oficina lo revisa y la marca como pagada.
        </p>
      )}

      <Alert>{error}</Alert>

      <div className="flex flex-wrap gap-2">
        {multa.multa && (
          <a href={multa.multa.url} target="_blank" rel="noreferrer" className={linkClass}>
            <FileTextIcon className="h-4 w-4" />
            Ver multa
          </a>
        )}
        {paysHimself && multa.comprobante && (
          <a href={multa.comprobante.url} target="_blank" rel="noreferrer" className={linkClass}>
            <FileTextIcon className="h-4 w-4" />
            Ver comprobante
          </a>
        )}
        {canUpload && (
          <span className="flex flex-wrap items-center gap-2">
            <CameraPickButton
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line/20 px-4 py-2 text-[13px] font-semibold text-ink-50 transition hover:bg-line/10"
              onChange={handleUpload}
              disabled={uploading}
            />
            <label
              className={clsx(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition",
                multa.comprobantePendiente
                  ? "border border-line/20 text-ink-50 hover:bg-line/10"
                  : "bg-brand text-brand-foreground hover:brightness-105"
              )}
            >
              {uploading ? <Spinner className="h-4 w-4" /> : <CameraIcon className="h-4 w-4" />}
              {multa.comprobantePendiente ? "Reemplazar comprobante" : "Subir comprobante de pago"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </span>
        )}
      </div>
    </div>
  );
};
