import { useEffect, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";
import { TextField } from "../ui/TextField";
import { parseApiError } from "../../lib/api";
import { formatKmValue } from "../../lib/compactado";
import { fijarKmPagoRequest } from "../../lib/records.api";

// "Km a pagar al chofer": la oficina fija los km con los que se calcula el pago del servicio (o de todo el viaje compacto) cuando lo que
// hizo el chofer no coincide con el circuito planificado (desvios, esperas, anulaciones tardias). No cambia lo que se factura al cliente.
export const KmPagoPanel = ({ record, onChanged, className }) => {
  const fijado = record.kmPago ?? null;
  const calculado = record.compactado?.km?.planificado ?? record.circuito?.km ?? record.kmFacturables ?? null;
  const [open, setOpen] = useState(false);
  const [km, setKm] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setKm(fijado?.km != null ? String(fijado.km) : "");
    setNota(fijado?.nota ?? "");
    setError("");
  }, [record.id, fijado?.km, fijado?.nota]);

  const save = async (value) => {
    setSaving(true);
    setError("");
    try {
      await fijarKmPagoRequest(record.id, { km: value, nota: value == null ? null : nota.trim() || null });
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const kmNumber = km.trim() === "" ? null : Number(km.replace(",", "."));
  const invalid = kmNumber == null || !Number.isFinite(kmNumber) || kmNumber <= 0 || kmNumber > 10000;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[12px] font-semibold uppercase tracking-wide text-ink-400">Km a pagar al chofer</h4>
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-[12px] font-medium text-accent-400 hover:text-accent-300">
          {open ? "Cerrar" : fijado ? "Cambiar" : "Fijar km"}
        </button>
      </div>
      <p className="mt-1.5 text-[13px] text-ink-100">
        {fijado ? (
          <>
            Fijados por la oficina: <b>{formatKmValue(fijado.km)}</b>
            {calculado != null ? ` (el circuito calculado es ${formatKmValue(calculado)})` : ""}.{fijado.nota ? ` ${fijado.nota}` : ""}
          </>
        ) : (
          <>Se pagan los km calculados{calculado != null ? ` (${formatKmValue(calculado)})` : ""}. Si el chofer hizo otro recorrido, puedes fijar los km a pagar.</>
        )}
        {record.compactado && !record.compactado.principal ? " Vale para todo el viaje compacto." : ""}
      </p>
      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <TextField
            id="km-pago"
            label="Km a pagar (total del servicio o viaje)"
            type="number"
            inputMode="decimal"
            min="0"
            max="10000"
            step="0.1"
            value={km}
            disabled={saving}
            onChange={(e) => setKm(e.target.value)}
          />
          <Textarea id="km-pago-nota" label="Motivo (opcional)" value={nota} maxLength={300} disabled={saving} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: km del GPS, el chofer dio la vuelta cerca de Singen" />
          <Alert>{error}</Alert>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {fijado && (
              <Button variant="ghost" className="sm:w-auto sm:px-5" disabled={saving} onClick={() => save(null)}>
                Volver al calculado
              </Button>
            )}
            <Button className="sm:w-auto sm:px-6" loading={saving} disabled={invalid} onClick={() => save(kmNumber)}>
              Guardar km a pagar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
