import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { parseApiError } from "../../lib/api";
import { confirmMemorandumRequest, getMemorandumFileRequest } from "../../lib/memorandums.api";
import { openPdfFromRequest } from "../../lib/bustaPaga";
import { SignaturePad } from "../bustapaga/SignaturePad";

// El destinatario confirma antes de abrir el memorandum: con un toque ("he leido y entiendo") o con su firma manuscrita, segun el nivel. Quedan
// guardados la hora, el dispositivo y, si hay, la firma; recien despues se abre el PDF.
export const FirmarMemorandumModal = ({ memo, onClose, onConfirmed }) => {
  const firma = memo.nivelFirma === "FIRMA";
  const padRef = useRef(null);
  const [hasInk, setHasInk] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  const handleConfirm = async () => {
    setError("");
    setSaving(true);
    // La pestaña del PDF se abre ya, en el toque; se completa cuando el servidor confirma.
    const win = window.open("", "_blank");
    try {
      await confirmMemorandumRequest(memo.id, firma ? padRef.current.toDataURL() : null);
      const { url } = await getMemorandumFileRequest(memo.id);
      if (win) win.location.href = url;
      onConfirmed(memo.id);
    } catch (err) {
      win?.close();
      setError(parseApiError(err).message);
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Cerrar" onClick={saving ? undefined : onClose} className="absolute inset-0 bg-backdrop backdrop-blur-sm" />
      <div className="glass-surface relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-3xl bg-background p-5 sm:rounded-3xl sm:p-6">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-wide text-ink-400">{memo.numero} · {memo.tipoLabel}</p>
          <h2 className="mt-1 text-[19px] font-semibold text-ink-50">{memo.titulo}</h2>
          <p className="mt-1 text-[13px] text-ink-300">
            De {memo.emisor} ({memo.emisorRol}).{" "}
            {firma ? "Firma con el dedo dentro del recuadro para poder abrirlo." : "Confirma que lo recibes para poder abrirlo."}
          </p>
        </div>

        {firma && (
          <>
            <SignaturePad ref={padRef} onInkChange={setHasInk} />
            <div>
              <button
                type="button"
                onClick={() => padRef.current?.clear()}
                disabled={saving}
                className="text-[13px] font-medium text-accent-400 hover:text-accent-300 disabled:opacity-50"
              >
                Borrar y firmar de nuevo
              </button>
            </div>
          </>
        )}

        <label className="flex cursor-pointer items-start gap-3 text-[13px] text-ink-200">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {firma
              ? "Declaro haber recibido este memorándum. Quedan registrados mi firma, la fecha y hora y mi dispositivo."
              : "He leído y entiendo este memorándum. Quedan registrados la fecha y hora y mi dispositivo."}
          </span>
        </label>

        <Alert>{error}</Alert>

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button onClick={handleConfirm} loading={saving} disabled={(firma && !hasInk) || !accepted} className="sm:w-auto sm:px-8">
            {firma ? "Firmar y abrir" : "Confirmar y abrir"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={saving} className="sm:w-auto sm:px-8">
            Cancelar
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
