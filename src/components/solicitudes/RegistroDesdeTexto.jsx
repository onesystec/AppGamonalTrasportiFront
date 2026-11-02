import clsx from "clsx";
import { useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";
import { parseApiError } from "../../lib/api";
import { formatFechaHora, SOLICITUD_SERVICIOS } from "../../lib/solicitudes";
import { registrarDesdeTextoClienteRequest } from "../../lib/solicitudes.api";

// Nueva registracion del portal de Piazza (todo en italiano): el cliente elige el servicio, pega TODO el texto y pulsa "Registra". Se lee y se crea la fila en la
// hoja con lo que se pudo leer; lo que falte queda en rojo para completarlo ahi mismo, en la propia hoja.
export const RegistroDesdeTexto = ({ servicioInicial = "DHL_MILANO", onRegistered, onCancel }) => {
  const [servicio, setServicio] = useState(servicioInicial);
  const [texto, setTexto] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicados, setDuplicados] = useState(null); // ya hay una solicitud con ese Shipment / Order: se pide confirmar

  const registrar = async (confirmar = false) => {
    setSaving(true);
    setError("");
    try {
      const res = await registrarDesdeTextoClienteRequest({ servicio, texto, confirmar });
      if (!res.creada) {
        setDuplicados(res.duplicados);
        return;
      }
      onRegistered(res.solicitud, res.avisos ?? []);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Alert>{error}</Alert>

      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-ink-300">Servizio</span>
        <div className="flex flex-wrap gap-2">
          {SOLICITUD_SERVICIOS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                setServicio(s.value);
                setDuplicados(null);
              }}
              className={clsx(
                "rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
                servicio === s.value ? "bg-brand text-brand-foreground" : "bg-line/10 text-ink-300 hover:text-ink-50"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Textarea
        id="registro-texto"
        label="Incolla qui tutto il testo del servizio"
        placeholder="Il messaggio completo: portale DHL (Shipment, Customer, ETA, Ship To City, Order...) o il messaggio del servizio."
        rows={12}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setDuplicados(null);
        }}
      />
      <p className="text-[12px] text-ink-400">I dati che non si riescono a leggere restano in rosso nella tabella: li completi direttamente lì.</p>

      {duplicados && (
        <div className="rounded-xl border border-danger-500/40 bg-danger-500/10 px-3 py-2.5 text-[13px] text-ink-100">
          <span className="block font-semibold text-danger-500">Questo ordine sembra già registrato</span>
          {duplicados.map((d) => (
            <span key={d.id} className="mt-0.5 block text-ink-200">
              {[d.cliente, d.destinazione].filter(Boolean).join(" · ") || "Senza dati"} · {formatFechaHora(d.fecha)}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" className="!w-auto px-5 py-2.5" onClick={onCancel} disabled={saving}>
          Annulla
        </Button>
        {duplicados ? (
          <Button className="!w-auto px-6 py-2.5" loading={saving} onClick={() => registrar(true)}>
            Registra comunque
          </Button>
        ) : (
          <Button className="!w-auto px-6 py-2.5" loading={saving} disabled={!texto.trim()} onClick={() => registrar(false)}>
            Registra
          </Button>
        )}
      </div>
    </div>
  );
};
