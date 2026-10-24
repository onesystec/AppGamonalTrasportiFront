import clsx from "clsx";
import { useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { Textarea } from "../ui/Textarea";
import { parseApiError } from "../../lib/api";
import { APLICATIVO_OPTIONS } from "../../lib/constants";
import { kmDeSolicitud, SOLICITUD_SERVICIOS, toRomeInput } from "../../lib/solicitudes";
import { createSolicitudRequest, updateSolicitudRequest } from "../../lib/solicitudes.api";

const EMPTY = {
  servicio: "DHL_MILANO",
  cliente: "",
  destinazione: "",
  fechaHora: "",
  autRitiro: "",
  fornitore: "Gamonal",
  km: "",
  pagato: "",
  pagato50: false,
  varie: "",
  varie2: "",
  descripcion: "",
  aplicativo: "",
};

const fromSolicitud = (s) => ({
  servicio: s.servicio,
  cliente: s.cliente,
  destinazione: s.destinazione,
  fechaHora: toRomeInput(s.fechaHora),
  autRitiro: s.autRitiro ?? "",
  fornitore: s.fornitore ?? "Gamonal",
  km: kmDeSolicitud(s)?.replace(",", ".") ?? "",
  pagato: s.pagato != null ? String(s.pagato) : "",
  pagato50: Boolean(s.pagato50),
  varie: s.varie ?? "",
  varie2: s.varie2 != null ? String(s.varie2) : "",
  descripcion: s.descripcion ?? "",
  aplicativo: s.aplicativo ?? "",
});

const aplicativosDe = (servicio) =>
  servicio === "DHL_MILANO" ? APLICATIVO_OPTIONS.filter((o) => o.value.startsWith("MILANO_")) : servicio === "DHL_ROMA" ? APLICATIVO_OPTIONS.filter((o) => o.value.startsWith("ROMA_")) : [];

// Formulario del registro limitado, con las columnas del Excel mensual de cada servicio: DHL (Milano y Roma: + "Pagato al 50%" en Roma) y AB Service
// (+ Aut. ritiro y el Totale en km). La oficina completa el resto al aceptarlo.
export const SolicitudForm = ({ solicitud, onSaved, onCancel }) => {
  const [form, setForm] = useState(() => (solicitud ? fromSolicitud(solicitud) : EMPTY));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const onChange = (field) => (e) => set(field, e.target.value);
  const aplicativos = aplicativosDe(form.servicio);
  const esAb = form.servicio === "AB_SERVICE";
  const esRoma = form.servicio === "DHL_ROMA";

  // AB Service es siempre del cliente AB: se rellena solo al elegirlo si todavia no se escribio uno.
  const setServicio = (servicio) =>
    setForm((prev) => ({
      ...prev,
      servicio,
      cliente: servicio === "AB_SERVICE" && !prev.cliente.trim() ? "AB" : prev.cliente,
      aplicativo: aplicativosDe(servicio).some((o) => o.value === prev.aplicativo) ? prev.aplicativo : "",
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    setFieldErrors({});
    // Lo que no corresponde al servicio elegido no se manda (queda vacio).
    const payload = {
      ...form,
      autRitiro: esAb ? form.autRitiro : "",
      descripcion: esAb ? form.descripcion : "",
      pagato50: esRoma ? form.pagato50 : false,
    };
    try {
      const saved = solicitud ? await updateSolicitudRequest(solicitud.id, payload) : await createSolicitudRequest(payload);
      onSaved(saved);
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.message);
      setFieldErrors(parsed.fieldErrors || {});
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Alert>{formError}</Alert>

      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-ink-300">Servicio</span>
        <div className="flex flex-wrap gap-2">
          {SOLICITUD_SERVICIOS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setServicio(s.value)}
              className={clsx(
                "rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
                form.servicio === s.value ? "bg-brand text-brand-foreground" : "bg-line/10 text-ink-300 hover:text-ink-50"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {fieldErrors.servicio?.[0] && <span className="mt-1.5 block text-[13px] text-danger-500">{fieldErrors.servicio[0]}</span>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField id="sol-cliente" label="Cliente" value={form.cliente} onChange={onChange("cliente")} error={fieldErrors.cliente?.[0]} required />
        <TextField id="sol-fecha" label="Fecha y hora" type="datetime-local" value={form.fechaHora} onChange={onChange("fechaHora")} error={fieldErrors.fechaHora?.[0]} required />
        <TextField className="sm:col-span-2" id="sol-destino" label="Destinazione" value={form.destinazione} onChange={onChange("destinazione")} error={fieldErrors.destinazione?.[0]} required />
        {esAb && <TextField id="sol-aut" label="Aut. ritiro" value={form.autRitiro} onChange={onChange("autRitiro")} error={fieldErrors.autRitiro?.[0]} />}
        <TextField id="sol-fornitore" label="Fornitore" value={form.fornitore} onChange={onChange("fornitore")} error={fieldErrors.fornitore?.[0]} />
        <TextField
          id="sol-km"
          label={esAb ? "Totale (km)" : "KM destino"}
          placeholder={esAb ? "Ej: 430" : "Ej: 25 KM, 68 o NAVETTA HP"}
          value={form.km}
          onChange={onChange("km")}
          error={fieldErrors.km?.[0]}
        />
        <TextField id="sol-pagato" label="Pagato (EUR)" type="number" step="0.01" min="0" value={form.pagato} onChange={onChange("pagato")} error={fieldErrors.pagato?.[0]} />
        <TextField id="sol-varie" label="Varie" placeholder="Ej: 1 H ONSITE" value={form.varie} onChange={onChange("varie")} error={fieldErrors.varie?.[0]} />
        <TextField id="sol-varie2" label="Varie 2 (EUR)" type="number" step="0.01" min="0" placeholder="Ej: 10 (lo cobrado por el onsite)" value={form.varie2} onChange={onChange("varie2")} error={fieldErrors.varie2?.[0]} />
      </div>

      {esRoma && (
        <label className="flex items-center gap-2.5 text-[14px] text-ink-100">
          <input type="checkbox" checked={form.pagato50} onChange={(e) => set("pagato50", e.target.checked)} className="h-4 w-4 accent-[var(--brand,#22e093)]" />
          Pagato al 50%
        </label>
      )}

      {aplicativos.length > 0 && (
        <label className="block" htmlFor="sol-aplicativo">
          <span className="mb-1.5 block text-[13px] font-medium text-ink-300">Numero (opcional, para el mensaje de WhatsApp)</span>
          <select id="sol-aplicativo" value={form.aplicativo} onChange={onChange("aplicativo")} className="glass-input w-full rounded-xl px-4 py-3 text-[15px] text-ink-50">
            <option value="">Sin numero</option>
            {aplicativos.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {esAb && (
        <Textarea
          id="sol-descripcion"
          label="Descripcion del envio (Customer, Shipment, Ship To... para el mensaje de WhatsApp)"
          rows={7}
          value={form.descripcion}
          onChange={onChange("descripcion")}
          error={fieldErrors.descripcion?.[0]}
        />
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" className="!w-auto px-5 py-2.5" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" loading={submitting} className="!w-auto px-6 py-2.5">
          {solicitud ? "Guardar cambios" : "Enviar solicitud"}
        </Button>
      </div>
    </form>
  );
};
