import { useEffect, useId, useRef, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { FileField } from "../ui/FileField";
import { GlassCard } from "../ui/GlassCard";
import { Select } from "../ui/Select";
import { TextField } from "../ui/TextField";
import { EuroIcon } from "../ui/icons";
import { parseApiError } from "../../lib/api";
import { createCombustibleRequest } from "../../lib/combustible.api";
import { AREA_OPTIONS, readLastUsed, romeNowHHMM, saveLastUsed } from "../../lib/combustible";
import { formatCurrency } from "../../lib/format";
import { createMancatoRequest } from "../../lib/mancato.api";
import { parseCosto, romeToday } from "../../lib/mancato";

// Peajes y comprobantes de combustible que el chofer sube desde dentro del propio servicio: quedan asignados a ESTE servicio (no se adivinan por la hora).
// Los formularios arrancan cerrados y se despliegan con "Agregar". Cada uno se guarda con su boton; "Guardar y salir" (abajo del servicio) guarda los
// que hayan quedado a medias antes de cerrar: para eso cada formulario se registra en submitsRef.

const normalizeTarga = (value) => value.replace(/\s+/g, "").toUpperCase();

// Area de combustible del servicio ("" si no se puede saber: se pregunta).
const areaOfRecord = (record) => {
  const roma = record.extrasPiazzaZona === "ROMA";
  if (record.spedizzione === "DHL") return roma ? "DHL_ROMA" : "DHL_MILANO";
  if (record.spedizzione === "AB_SERVICE") return "AB_SERVICE";
  if (record.spedizzione === "EXTRA_PIAZZA") return roma ? "EXTRAS_PIAZZA_ROMA" : "EXTRAS_PIAZZA_MILANO";
  return "";
};

// Registra la funcion que guarda lo escrito en este formulario (devuelve true si no habia nada o se guardo, false si falta algo).
const useRegisterSubmit = (submitsRef, submit) => {
  const key = useId();
  const ref = useRef(submit);
  ref.current = submit;
  useEffect(() => {
    submitsRef.current.set(key, () => ref.current());
    return () => submitsRef.current.delete(key);
  }, [submitsRef, key]);
};

// Un div y no un form: estos formularios tambien van dentro del formulario de "Terminar servicio" (no se pueden anidar).
const FormShell = ({ title, error, saving, onSubmit, onCancel, submitLabel, children }) => (
  <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-line/10 bg-line/[0.03] p-4">
    <h4 className="text-[14px] font-semibold text-ink-50">{title}</h4>
    <Alert>{error}</Alert>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="ghost" className="sm:w-auto sm:px-5" disabled={saving} onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="button" className="sm:w-auto sm:px-6" loading={saving} onClick={onSubmit}>
        {submitLabel}
      </Button>
    </div>
  </div>
);

export const PeajeForm = ({ record, tramoInicial, tramoFijo = false, submitsRef, onSaved, onCancel }) => {
  const [form, setForm] = useState({ tramo: tramoInicial, numero: "", costo: "", fecha: romeToday(), hora: "" });
  const [foto, setFoto] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const targa = record.vehicle?.targa ?? "";
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const dirty = Boolean(form.numero || form.costo || form.hora || foto);

  const submit = async () => {
    if (!dirty) return true;
    const next = {};
    if (!form.numero.trim()) next.numero = "El numero del aviso es obligatorio";
    if (!form.hora) next.hora = "Indica la hora del transito (la dice el aviso)";
    if (parseCosto(form.costo) == null) next.costo = "Ingresa un importe mayor a 0 (ej. 37,50)";
    if (!foto) next.foto = "Sube la foto del mancato pagamento";
    if (!targa) next.general = "El servicio no tiene vehiculo: no se puede subir el peaje desde aqui";
    setErrors(next);
    if (Object.keys(next).length > 0) return false;
    setSaving(true);
    setError("");
    try {
      await createMancatoRequest(
        { numero: form.numero.trim(), targa: normalizeTarga(targa), fecha: form.fecha, hora: form.hora, costo: String(parseCosto(form.costo)), recordId: record.id, tramo: form.tramo },
        { foto }
      );
      onSaved("Peaje guardado en este servicio");
      return true;
    } catch (err) {
      const parsed = parseApiError(err);
      setError(parsed.message);
      setErrors(parsed.fieldErrors ? Object.fromEntries(Object.entries(parsed.fieldErrors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) : {});
      return false;
    } finally {
      setSaving(false);
    }
  };
  useRegisterSubmit(submitsRef, submit);

  return (
    <FormShell title={tramoFijo ? `Mancato pagamento de ${form.tramo === "VUELTA" ? "vuelta" : "ida"}` : "Agregar peaje (mancato pagamento)"} error={error || errors.general} saving={saving} onSubmit={submit} onCancel={onCancel} submitLabel="Guardar peaje">
      {!tramoFijo && <Select
        id="peaje-tramo"
        label="Tramo"
        options={[
          { value: "IDA", label: "Ida (hasta la entrega)" },
          { value: "VUELTA", label: "Vuelta (despues de la entrega)" },
        ]}
        value={form.tramo}
        onChange={(e) => set("tramo", e.target.value)}
      />}
      <TextField id="peaje-numero" label="Numero del aviso" placeholder="Ej. 1234567890" value={form.numero} onChange={(e) => set("numero", e.target.value)} error={errors.numero} />
      <TextField id="peaje-costo" label="Importe" icon={EuroIcon} inputMode="decimal" placeholder="0,00" value={form.costo} onChange={(e) => set("costo", e.target.value.replace(/[^\d.,]/g, ""))} error={errors.costo} />
      <TextField id="peaje-hora" label="Hora del transito" type="time" value={form.hora} onChange={(e) => set("hora", e.target.value)} error={errors.hora} />
      <TextField id="peaje-fecha" label="Fecha del transito" type="date" max={romeToday()} value={form.fecha} onChange={(e) => set("fecha", e.target.value)} error={errors.fecha} />
      <div className="sm:col-span-2">
        <FileField id="peaje-foto" label="Foto del mancato pagamento" hint="Foto del aviso o PDF, hasta 15 MB" camera required file={foto} onChange={setFoto} error={errors.foto} />
      </div>
    </FormShell>
  );
};

export const CombustibleForm = ({ record, submitsRef, onSaved, onCancel }) => {
  const last = readLastUsed();
  const areaInicial = areaOfRecord(record) || last.area;
  const [form, setForm] = useState({ monto: "", metodo: last.metodo, area: areaInicial, fecha: romeToday(), hora: romeNowHHMM() });
  const [comprobante, setComprobante] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const targa = record.vehicle?.targa ?? "";
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const dirty = Boolean(form.monto || comprobante);
  // Si el servicio no dice el area, se pregunta.
  const preguntarArea = !areaOfRecord(record);

  const submit = async () => {
    if (!dirty) return true;
    const next = {};
    if (parseCosto(form.monto) == null) next.monto = "Ingresa un importe mayor a 0 (ej. 45,50)";
    if (!form.metodo.trim()) next.metodo = "Indica la gasolinera";
    if (!form.area) next.area = "Elige el area";
    if (!form.hora) next.hora = "Indica la hora de la carga";
    if (!comprobante) next.comprobante = "Sube el comprobante de pago";
    if (!targa) next.general = "El servicio no tiene vehiculo: no se puede subir el comprobante desde aqui";
    setErrors(next);
    if (Object.keys(next).length > 0) return false;
    setSaving(true);
    setError("");
    try {
      const fields = { targa: normalizeTarga(targa), monto: String(parseCosto(form.monto)), metodo: form.metodo.trim(), area: form.area, fecha: form.fecha, hora: form.hora, recordId: record.id };
      await createCombustibleRequest(fields, { comprobante });
      saveLastUsed({ area: form.area, metodo: fields.metodo });
      onSaved("Comprobante de combustible guardado en este servicio");
      return true;
    } catch (err) {
      const parsed = parseApiError(err);
      setError(parsed.message);
      setErrors(parsed.fieldErrors ? Object.fromEntries(Object.entries(parsed.fieldErrors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) : {});
      return false;
    } finally {
      setSaving(false);
    }
  };
  useRegisterSubmit(submitsRef, submit);

  return (
    <FormShell title="Agregar comprobante de carburante" error={error || errors.general} saving={saving} onSubmit={submit} onCancel={onCancel} submitLabel="Guardar carburante">
      <TextField id="comb-monto" label="Importe" icon={EuroIcon} inputMode="decimal" placeholder="0,00" value={form.monto} onChange={(e) => set("monto", e.target.value.replace(/[^\d.,]/g, ""))} error={errors.monto} />
      <TextField id="comb-metodo" label="Gasolinera" placeholder="Ej. Eni, Q8, Tamoil" maxLength={80} value={form.metodo} onChange={(e) => set("metodo", e.target.value)} error={errors.metodo} />
      {preguntarArea && <Select id="comb-area" label="Area" placeholder="Elige el area" options={AREA_OPTIONS} value={form.area} onChange={(e) => set("area", e.target.value)} error={errors.area} />}
      <TextField id="comb-hora" label="Hora de la carga" type="time" value={form.hora} onChange={(e) => set("hora", e.target.value)} error={errors.hora} />
      <TextField id="comb-fecha" label="Fecha" type="date" max={romeToday()} value={form.fecha} onChange={(e) => set("fecha", e.target.value)} error={errors.fecha} />
      <div className="sm:col-span-2">
        <FileField id="comb-comprobante" label="Comprobante de pago" hint="Foto del ticket o PDF, hasta 15 MB" camera required file={comprobante} onChange={setComprobante} error={errors.comprobante} />
      </div>
    </FormShell>
  );
};

const addButton = "rounded-full border border-line/20 px-4 py-2 text-[13px] font-medium text-ink-50 transition hover:bg-line/10";

// Tarjeta del servicio (solo el chofer): lo ya subido y los botones "Agregar".
export const SubirDocumentosServicio = ({ record, submitsRef, onSaved }) => {
  // Cada formulario se abre y se cierra por su cuenta: abrir uno no descarta lo escrito en el otro.
  const [peaje, setPeaje] = useState(null); // { tramo } mientras esta abierto
  const [carburante, setCarburante] = useState(false);
  const [ok, setOk] = useState("");

  const mancatos = record.mancatos ?? [];
  const fuel = record.combustible?.comprobantes;
  const saved = (cerrar) => (message) => {
    cerrar();
    setOk(message);
    onSaved();
  };

  return (
    <div>
      <GlassCard>
        <h2 className="text-[17px] font-medium text-ink-50">Peajes y carburante de este servicio</h2>
        <p className="mt-1 text-[13px] text-ink-300">Lo que subas aqui queda guardado dentro de este servicio.</p>

        {ok && (
          <div className="mt-3">
            <Alert variant="success">{ok}</Alert>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 text-[13px] text-ink-200">
          {mancatos.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl glass-surface-sm px-3.5 py-2.5">
              <span>
                Peaje {m.tramo === "VUELTA" ? "de vuelta" : m.tramo === "IDA" ? "de ida" : ""} · aviso {m.numero}
              </span>
              <b>{formatCurrency(m.costo)}</b>
            </div>
          ))}
          {(fuel?.items ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl glass-surface-sm px-3.5 py-2.5">
              <span>Carburante · {c.metodo}</span>
              <b>{formatCurrency(c.monto)}</b>
            </div>
          ))}
          {mancatos.length === 0 && !(fuel?.count > 0) && <p className="text-ink-400">Todavia no subiste peajes ni comprobantes de carburante en este servicio.</p>}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={addButton} onClick={() => { setOk(""); setPeaje((prev) => prev ?? { tramo: "IDA" }); }}>
            + Agregar peaje
          </button>
          <button type="button" className={addButton} onClick={() => { setOk(""); setCarburante(true); }}>
            + Agregar carburante
          </button>
        </div>

        {peaje && <PeajeForm record={record} tramoInicial={peaje.tramo} submitsRef={submitsRef} onSaved={saved(() => setPeaje(null))} onCancel={() => setPeaje(null)} />}
        {carburante && <CombustibleForm record={record} submitsRef={submitsRef} onSaved={saved(() => setCarburante(false))} onCancel={() => setCarburante(false)} />}
      </GlassCard>
    </div>
  );
};
