import { useEffect, useId, useRef, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { parseApiError } from "../../lib/api";
import { cierreServicioRequest } from "../../lib/horas.api";

const MIN_CHIPS = [0, 15, 30, 45, 60];

// Espera del servicio ya terminado, editable ahi mismo (antes se abria el formulario de cierre solo para esto). Si queda
// un cambio sin guardar, "Guardar y salir" lo guarda junto con el resto (se registra en submitsRef como los formularios de peaje).
export const EsperaServicio = ({ record, submitsRef, onSaved }) => {
  const actual = record.jornada?.esperaMin ?? 0;
  const [value, setValue] = useState(String(actual));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const dirty = (Number(value) || 0) !== actual;
  const key = useId();

  // Tras guardar (o recargar el servicio) el campo vuelve a mostrar el valor guardado.
  useEffect(() => {
    setValue(String(actual));
  }, [actual]);

  const submit = async () => {
    if (!dirty) return true;
    setSaving(true);
    setError("");
    setAviso("");
    try {
      const cierre = await cierreServicioRequest(record.id, { esperaMin: Number(value) || 0 });
      setAviso(cierre?.esperaEstado === "PENDIENTE" ? "Espera guardada: un responsable la revisa y, cuando la apruebe, se suma a tu pago." : "Espera guardada.");
      onSaved?.();
      return true;
    } catch (err) {
      setError(parseApiError(err).message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const ref = useRef(submit);
  ref.current = submit;
  useEffect(() => {
    if (!submitsRef) return undefined;
    submitsRef.current.set(key, () => ref.current());
    return () => submitsRef.current.delete(key);
  }, [submitsRef, key]);

  return (
    <div className="mt-3 flex flex-col gap-2">
      <TextField
        id="espera-servicio"
        label="Espera declarada (minutos)"
        type="number"
        inputMode="numeric"
        min="0"
        step="5"
        value={value}
        onChange={(e) => {
          setAviso("");
          setValue(e.target.value);
        }}
        className="max-w-[12rem]"
      />
      <div className="flex flex-wrap gap-1.5">
        {MIN_CHIPS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setAviso("");
              setValue(String(m));
            }}
            className={
              Number(value) === m
                ? "rounded-full bg-accent-500/20 px-2.5 py-1 text-[12px] font-medium text-accent-400"
                : "rounded-full glass-surface-sm px-2.5 py-1 text-[12px] text-ink-300 hover:bg-line/10"
            }
          >
            {m === 0 ? "Ninguna" : `${m} min`}
          </button>
        ))}
      </div>
      <Alert>{error}</Alert>
      {aviso && !dirty && <p className="text-[12.5px] text-success-500">{aviso}</p>}
      {dirty && (
        <Button type="button" className="!w-auto self-start !px-5 !py-2 !text-[13px]" loading={saving} onClick={submit}>
          Guardar espera
        </Button>
      )}
    </div>
  );
};
