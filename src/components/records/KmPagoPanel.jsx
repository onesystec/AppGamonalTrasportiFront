import { useEffect, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";
import { TextField } from "../ui/TextField";
import { parseApiError } from "../../lib/api";
import { formatKmValue } from "../../lib/compactado";
import { fijarKmPagoRequest } from "../../lib/records.api";

// Lee los km escritos a mano: "2272", "2.272" (punto de miles), "2272,5" o "2.272,5". Un punto con 3 cifras detras es de miles, no un decimal.
export const parseKm = (text) => {
  const t = String(text ?? "").trim().replace(/\s/g, "");
  if (!t) return null;
  let normalized = t;
  if (t.includes(",")) normalized = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) normalized = t.replace(/\./g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
};

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
  // Un valor muy por debajo del calculado casi siempre es un error de tipeo: pide confirmar antes de guardarlo.
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    setKm(fijado?.km != null ? String(fijado.km) : "");
    setNota(fijado?.nota ?? "");
    setError("");
    setConfirmar(false);
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

  const kmNumber = parseKm(km);
  const invalid = kmNumber == null || !Number.isFinite(kmNumber) || kmNumber <= 0 || kmNumber > 10000;
  const muyBajo = !invalid && calculado > 0 && kmNumber < calculado * 0.5;

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
            type="text"
            inputMode="decimal"
            value={km}
            disabled={saving}
            onChange={(e) => {
              setKm(e.target.value);
              setConfirmar(false);
            }}
            placeholder="Ej.: 2272"
          />
          {!invalid && <p className="-mt-2 text-[13px] font-medium text-ink-100">Se pagaran {formatKmValue(kmNumber)} por todo el servicio o viaje.</p>}
          {muyBajo && (
            <p className="-mt-1 rounded-lg bg-warning-500/10 px-3 py-1.5 text-[12px] text-warning-500">
              Es mucho menos que los km calculados ({formatKmValue(calculado)}). Revisa que no falten cifras: 2272 o 2.272 son dos mil doscientos setenta y dos.
            </p>
          )}
          <Textarea id="km-pago-nota" label="Motivo (opcional)" value={nota} maxLength={300} disabled={saving} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: km del GPS, el chofer dio la vuelta cerca de Singen" />
          <Alert>{error}</Alert>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {fijado && (
              <Button variant="ghost" className="sm:w-auto sm:px-5" disabled={saving} onClick={() => save(null)}>
                Volver al calculado
              </Button>
            )}
            <Button
              className="sm:w-auto sm:px-6"
              loading={saving}
              disabled={invalid}
              onClick={() => {
                if (muyBajo && !confirmar) {
                  setConfirmar(true);
                  return;
                }
                save(kmNumber);
              }}
            >
              {muyBajo && confirmar ? "Si, guardar igual" : "Guardar km a pagar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
