import { useEffect, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";
import { TextField } from "../ui/TextField";

// Anular un servicio: la oficina anota los km TOTALES que el chofer ya recorrio antes de la anulacion (0 si no salio). Con km, el
// servicio anulado se factura y se paga por esos km y se puede compactar con otro servicio. `editar` = corregir los km de uno ya anulado.
export const AnularModal = ({ open, record, editar = false, loading, error, onConfirm, onCancel }) => {
  const [km, setKm] = useState("");
  const [nota, setNota] = useState("");

  useEffect(() => {
    if (!open) return;
    setKm(record?.anulado?.kmHechos != null ? String(record.anulado.kmHechos) : "");
    setNota(record?.anulado?.nota ?? "");
  }, [open, record?.id, record?.anulado?.kmHechos, record?.anulado?.nota]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onCancel]);

  if (!open || !record) return null;

  const planificados = record.anulado?.kmPlanificados ?? record.kmFacturables ?? null;
  const kmNumber = km.trim() === "" ? 0 : Number(km.replace(",", "."));
  const invalid = !Number.isFinite(kmNumber) || kmNumber < 0 || kmNumber > 5000;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button type="button" aria-label="Cerrar" onClick={() => !loading && onCancel()} className="absolute inset-0 bg-backdrop backdrop-blur-sm" />
      <div className="glass-surface relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-background p-6">
        <h2 className="text-[17px] font-semibold text-ink-50">{editar ? "Km recorridos del servicio anulado" : "Anular servicio"}</h2>
        <p className="mt-1 text-[13px] text-ink-300">
          {record.codigo}
          {record.destinazione ? ` · ${record.destinazione}` : ""}
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <TextField
            id="anular-km"
            label="Km totales recorridos antes de anular"
            type="number"
            inputMode="decimal"
            min="0"
            max="5000"
            step="0.1"
            value={km}
            onChange={(e) => setKm(e.target.value)}
            placeholder="Si no salio, deja vacio"
          />
          <p className="-mt-2 text-[12px] text-ink-400">
            Con km, el servicio anulado se <b>factura y se paga</b> por esos km y se puede compactar con otro servicio.
            {planificados > 0 ? ` El servicio tenia ${planificados} km planificados.` : ""} Sin km queda anulado como siempre (sin pago ni facturacion).
          </p>
          <Textarea id="anular-nota" label="Nota (opcional)" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: el cliente cancelo en camino" />
        </div>
        {invalid && <p className="mt-2 text-[13px] text-danger-500">Los km tienen que estar entre 0 y 5000.</p>}
        <Alert>{error}</Alert>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" className="sm:w-auto sm:px-6" disabled={loading} onClick={onCancel}>
            Volver
          </Button>
          <Button className="sm:w-auto sm:px-6" loading={loading} disabled={invalid} onClick={() => onConfirm({ kmRecorridos: kmNumber, nota: nota.trim() || null })}>
            {editar ? "Guardar km" : "Anular servicio"}
          </Button>
        </div>
      </div>
    </div>
  );
};
