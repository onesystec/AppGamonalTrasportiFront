import { useEffect, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { FileField } from "../ui/FileField";
import { Select } from "../ui/Select";
import { TextField } from "../ui/TextField";
import { Textarea } from "../ui/Textarea";
import { parseApiError } from "../../lib/api";
import { SOLLECITO_ESTADOS, createSollecitoRequest, updateSollecitoRequest } from "../../lib/sollecito.api";

const EMISORES = ["SATAP - Autostrada A4 Torino-Milano", "Milano Serravalle - Milano Tangenziali", "Autostrade per l'Italia"];

const emptyForm = (s) => ({
  emisor: s?.emisor ?? "",
  numeroAtto: s?.numeroAtto ?? "",
  fechaCarta: s?.fechaCarta ?? "",
  fechaTransito: s?.fechaTransito ?? "",
  targa: s?.targa ?? "",
  numerosMancato: (s?.numerosMancato ?? []).join(", "),
  importe: s?.importe != null ? String(s.importe).replace(".", ",") : "",
  sitioPago: s?.sitioPago ?? "",
  estado: s?.estado ?? "POR_PAGAR",
  comentarios: s?.comentarios ?? "",
});

// Alta y edicion de un sollecito: datos de la carta, el PDF y (si ya se pago) el comprobante.
export const SollecitoFormModal = ({ open, sollecito, onClose, onSaved }) => {
  const [form, setForm] = useState(() => emptyForm(sollecito));
  const [archivo, setArchivo] = useState(null);
  const [comprobante, setComprobante] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(sollecito));
    setArchivo(null);
    setComprobante(null);
    setError("");
    setFieldErrors({});
  }, [open, sollecito]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const err = (field) => fieldErrors[field]?.[0];

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.emisor.trim()) next.emisor = ["El emisor es obligatorio"];
    if (!form.numeroAtto.trim()) next.numeroAtto = ["El numero de atto es obligatorio"];
    setFieldErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    setError("");
    try {
      const files = { archivo, comprobante };
      const saved = sollecito
        ? await updateSollecitoRequest(sollecito.id, form, files)
        : await createSollecitoRequest(form, files);
      onSaved(saved);
    } catch (apiError) {
      const parsed = parseApiError(apiError);
      setError(parsed.message);
      if (parsed.fieldErrors) setFieldErrors(parsed.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => !saving && onClose()}
        className="absolute inset-0 bg-backdrop backdrop-blur-sm"
      />
      <form
        onSubmit={onSubmit}
        className="glass-surface relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-t-3xl bg-background p-5 sm:rounded-3xl sm:p-6"
      >
        <h2 className="text-[18px] font-semibold text-ink-50">{sollecito ? "Editar sollecito" : "Nuevo sollecito"}</h2>
        <Alert>{error}</Alert>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              id="sol-emisor"
              label="Emisor (autopista)"
              list="sol-emisores"
              placeholder="Ej. SATAP - Autostrada A4 Torino-Milano"
              value={form.emisor}
              onChange={set("emisor")}
              error={err("emisor")}
            />
            <datalist id="sol-emisores">
              {EMISORES.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </div>
          <TextField
            id="sol-atto"
            label="N. de atto / procedimiento"
            placeholder="Ej. 14/2026/011802"
            value={form.numeroAtto}
            onChange={set("numeroAtto")}
            error={err("numeroAtto")}
          />
          <TextField
            id="sol-importe"
            label="Importe total (EUR)"
            inputMode="decimal"
            placeholder="Ej. 7,95"
            value={form.importe}
            onChange={set("importe")}
            error={err("importe")}
          />
          <TextField id="sol-fecha" label="Fecha de la carta" type="date" value={form.fechaCarta} onChange={set("fechaCarta")} error={err("fechaCarta")} />
          <TextField
            id="sol-transito"
            label="Fecha del transito"
            type="date"
            value={form.fechaTransito}
            onChange={set("fechaTransito")}
            error={err("fechaTransito")}
          />
          <TextField
            id="sol-targa"
            label="Targa"
            placeholder="Ej. EX030XG"
            value={form.targa}
            onChange={(e) => setForm((prev) => ({ ...prev, targa: e.target.value.toUpperCase() }))}
            error={err("targa")}
          />
          <Select
            id="sol-estado"
            label="Estado"
            options={SOLLECITO_ESTADOS.map((e) => ({ value: e.value, label: e.label }))}
            value={form.estado}
            onChange={set("estado")}
          />
          <div className="sm:col-span-2">
            <TextField
              id="sol-mancatos"
              label="N. de mancato pagamento que reclama"
              placeholder="Separados por coma. Ej. 3195086644, 3195086645"
              value={form.numerosMancato}
              onChange={set("numerosMancato")}
              error={err("numerosMancato")}
            />
          </div>
          <div className="sm:col-span-2">
            <TextField
              id="sol-sitio"
              label="Donde se paga"
              placeholder="Web, IBAN o bollettino"
              value={form.sitioPago}
              onChange={set("sitioPago")}
              error={err("sitioPago")}
            />
          </div>
          <FileField
            id="sol-archivo"
            label="PDF del sollecito"
            hint="PDF o foto, hasta 15 MB"
            file={archivo}
            onChange={setArchivo}
            existing={sollecito?.archivo}
          />
          <FileField
            id="sol-comprobante"
            label="Comprobante de pago"
            hint="Si ya se pago"
            file={comprobante}
            onChange={setComprobante}
            existing={sollecito?.comprobante}
          />
          <div className="sm:col-span-2">
            <Textarea id="sol-comentarios" label="Comentarios" value={form.comentarios} onChange={set("comentarios")} />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" className="sm:w-auto sm:px-6" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="sm:w-auto sm:px-6" loading={saving}>
            Guardar
          </Button>
        </div>
      </form>
    </div>
  );
};
