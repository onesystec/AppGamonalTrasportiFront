import clsx from "clsx";
import { useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { TextField } from "../ui/TextField";
import { Textarea } from "../ui/Textarea";
import { useT } from "../../i18n/index.jsx";
import { parseApiError } from "../../lib/api";
import { APLICATIVO_OPTIONS, TIPO_PEDIDO_OPTIONS } from "../../lib/constants";
import { formatFechaHora, kmDeSolicitud, SOLICITUD_SERVICIOS, toRomeInput } from "../../lib/solicitudes";
import { createSolicitudRequest, leerTextoClienteRequest, updateSolicitudRequest } from "../../lib/solicitudes.api";

// Extra Piazza se elige por zona (Milano o Roma).
const OPCIONES = SOLICITUD_SERVICIOS.flatMap((s) =>
  s.value === "EXTRA_PIAZZA"
    ? [
        { key: "EXTRA_PIAZZA_MILANO", label: "Extra Piazza Milano", servicio: "EXTRA_PIAZZA", zona: "MILANO" },
        { key: "EXTRA_PIAZZA_ROMA", label: "Extra Piazza Roma", servicio: "EXTRA_PIAZZA", zona: "ROMA" },
      ]
    : [{ key: s.value, label: s.label, servicio: s.value }]
);

const EMPTY = {
  servicio: "DHL_MILANO",
  zona: "MILANO",
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
  shipment: "",
  orderNumero: "",
  tipoPedido: "",
  choferIndicado: "",
  ritiro: "",
};

const fromSolicitud = (s) => ({
  servicio: s.servicio,
  zona: s.zona ?? "MILANO",
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
  shipment: s.shipment ?? "",
  orderNumero: s.orderNumero ?? "",
  tipoPedido: s.tipoPedido ?? "",
  choferIndicado: s.choferIndicado ?? "",
  ritiro: s.ritiro ?? "",
});

const aplicativosDe = (servicio) =>
  servicio === "DHL_MILANO" ? APLICATIVO_OPTIONS.filter((o) => o.value.startsWith("MILANO_")) : servicio === "DHL_ROMA" ? APLICATIVO_OPTIONS.filter((o) => o.value.startsWith("ROMA_")) : [];

// Formulario del registro limitado, con las columnas del Excel mensual de cada servicio: DHL (Milano y Roma: + "Pagato al 50%" en Roma) y AB Service
// (+ Aut. ritiro y el Totale en km). La oficina completa el resto al aceptarlo.
export const SolicitudForm = ({ solicitud, onSaved, onCancel }) => {
  const t = useT();
  const [form, setForm] = useState(() => (solicitud ? fromSolicitud(solicitud) : EMPTY));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  // DHL Milano / DHL Roma / AB Service: el texto que se pega para rellenar la solicitud (todo este proceso va en italiano).
  const [texto, setTexto] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [lectura, setLectura] = useState(null); // { avisos, duplicados, tipoOrigen }

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const onChange = (field) => (e) => set(field, e.target.value);
  const aplicativos = aplicativosDe(form.servicio);
  const esAb = form.servicio === "AB_SERVICE";
  const esRoma = form.servicio === "DHL_ROMA";
  const esMilano = form.servicio === "DHL_MILANO";
  const esExtra = form.servicio === "EXTRA_PIAZZA";
  // DHL Milano, DHL Roma, AB Service y Extra Piazza se pueden rellenar pegando el texto (AB y Extra Piazza ademas localizan los lugares del mensaje).
  const usaTexto = esMilano || esRoma || esAb || esExtra;

  // Lee el texto pegado y rellena lo que encuentra (Shipment, Order, cliente, tipo, ciudad, ETA, km); el resto lo completa quien envia.
  const leerTexto = async () => {
    setLeyendo(true);
    setFormError("");
    try {
      const d = await leerTextoClienteRequest(form.servicio, texto);
      setForm((prev) => ({
        ...prev,
        cliente: d.cliente ?? prev.cliente,
        destinazione: d.ciudad ?? prev.destinazione,
        fechaHora: d.eta ? toRomeInput(d.eta) : prev.fechaHora,
        km: d.km != null ? String(d.km) : prev.km,
        // Extra Piazza no tiene Shipment ni Order.
        shipment: esExtra ? "" : (d.shipment ?? prev.shipment),
        orderNumero: esExtra ? "" : (d.orderNumero ?? prev.orderNumero),
        tipoPedido: d.tipoPedido ?? prev.tipoPedido,
        ritiro: d.ritiro ?? prev.ritiro,
        // El numero de Milano / Roma que dice el mensaje ("ROMA 2", "ASSEGNATO ROMA 4").
        aplicativo: d.aplicativo ?? prev.aplicativo,
        descripcion: d.descripcion,
      }));
      setLectura({ avisos: d.avisos ?? [], duplicados: d.duplicados ?? [], tipoOrigen: d.tipoOrigen ?? null, lugares: d.lugares ?? [] });
    } catch (err) {
      setFormError(parseApiError(err).message);
    } finally {
      setLeyendo(false);
    }
  };

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
      // La descripcion de DHL Milano es el texto de DHL completo (si se pego); en AB Service, la del envio.
      descripcion: usaTexto ? form.descripcion : "",
      pagato50: esRoma ? form.pagato50 : false,
      shipment: usaTexto && !esExtra ? form.shipment : "",
      orderNumero: usaTexto && !esExtra ? form.orderNumero : "",
      tipoPedido: usaTexto && !esExtra ? form.tipoPedido : "",
      ritiro: esExtra ? form.ritiro : "",
      zona: esExtra ? form.zona : "",
      choferIndicado: usaTexto ? form.choferIndicado : "",
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
        <span className="mb-1.5 block text-[13px] font-medium text-ink-300">{t("form.service")}</span>
        <div className="flex flex-wrap gap-2">
          {OPCIONES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setServicio(s.servicio);
                if (s.zona) set("zona", s.zona);
              }}
              className={clsx(
                "rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
                form.servicio === s.servicio && (!s.zona || form.zona === s.zona) ? "bg-brand text-brand-foreground" : "bg-line/10 text-ink-300 hover:text-ink-50"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {fieldErrors.servicio?.[0] && <span className="mt-1.5 block text-[13px] text-danger-500">{fieldErrors.servicio[0]}</span>}
      </div>

      {usaTexto && (
        <div className="rounded-2xl border border-line/15 p-4">
          <Textarea
            id="sol-texto"
            label={esAb ? "Incolla il messaggio di AB Service (facoltativo)" : esExtra ? "Incolla il messaggio dell'Extra Piazza (facoltativo)" : "Incolla il testo di DHL (facoltativo)"}
            placeholder="Shipments: Customer ... Shipment # ... ETA ... Ship To City ... Order # ..."
            rows={5}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              if (lectura) setLectura(null);
            }}
          />
          <div className="mt-3">
            <Button variant="ghost" className="!w-auto px-5 py-2 text-[13px]" onClick={leerTexto} loading={leyendo} disabled={!texto.trim()}>
              Leggi testo
            </Button>
          </div>
          {lectura?.lugares?.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5 rounded-xl border border-line/15 px-3 py-2 text-[12.5px]">
              {lectura.lugares.map((l, i) => (
                <li key={`${l.rol}-${i}`} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                  <span className="shrink-0 font-semibold text-ink-100">{l.rol === "ritiro" ? "Ritiro" : "Consegna"}</span>
                  <span className="text-ink-200">{l.texto}</span>
                  {l.localizado ? (
                    <span className="text-success-500">✓ Localizzato{l.localizado !== l.texto ? `: ${l.localizado}` : ""}</span>
                  ) : (
                    <span className="text-warning-500">⚠ Non localizzato: controlla l'indirizzo</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {lectura?.duplicados.length > 0 && (
            <div className="mt-3 rounded-xl border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-[12.5px] text-ink-100">
              <span className="block font-semibold text-danger-500">Questo ordine sembra già inviato</span>
              {lectura.duplicados.map((d) => (
                <span key={d.id} className="block text-ink-200">{`${d.cliente} · ${formatFechaHora(d.fecha)}`}</span>
              ))}
            </div>
          )}
          {lectura?.avisos.length > 0 && (
            <ul className="mt-3 list-disc rounded-xl border border-warning-500/40 bg-warning-500/10 py-2 pl-7 pr-3 text-[12.5px] text-warning-500">
              {lectura.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {usaTexto && (
          <>
            {/* Extra Piazza (Milano y Roma) no tiene Shipment ni Order: sin esas casillas. */}
            {!esExtra && (
              <>
                <TextField id="sol-shipment" label="Shipment" value={form.shipment} onChange={onChange("shipment")} error={fieldErrors.shipment?.[0]} />
                <TextField id="sol-order" label="Order" value={form.orderNumero} onChange={onChange("orderNumero")} error={fieldErrors.orderNumero?.[0]} />
              </>
            )}
            {esExtra && (
              <TextField className="sm:col-span-2" id="sol-ritiro" label="Ritiro" value={form.ritiro} onChange={onChange("ritiro")} error={fieldErrors.ritiro?.[0]} />
            )}
            {!esExtra && (
            <div className="sm:col-span-2">
              <Select
                id="sol-tipo"
                label="Tipo"
                value={form.tipoPedido}
                onChange={(e) => {
                  set("tipoPedido", e.target.value);
                  setLectura((prev) => (prev ? { ...prev, tipoOrigen: e.target.value ? "manual" : null } : prev));
                }}
                options={[{ value: "", label: "— Scegli il tipo —" }, ...TIPO_PEDIDO_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]}
                error={fieldErrors.tipoPedido?.[0]}
              />
              {lectura?.tipoOrigen === "eta" && <span className="mt-1.5 block text-[12px] text-ink-400">Suggerito in base all'ETA: cambialo se non è così.</span>}
              {lectura?.tipoOrigen === "texto" && <span className="mt-1.5 block text-[12px] text-ink-400">Letto dal testo.</span>}
            </div>
            )}
            <TextField
              id="sol-chofer"
              label="Autista (facoltativo)"
              placeholder="Es. Kevin Fernandez"
              value={form.choferIndicado}
              onChange={onChange("choferIndicado")}
              error={fieldErrors.choferIndicado?.[0]}
            />
            {(esMilano || esRoma) && (
              <label className="block" htmlFor="sol-milano">
                <span className="mb-1.5 block text-[13px] font-medium text-ink-300">{esRoma ? "Numero di Roma (facoltativo)" : "Numero di Milano (facoltativo)"}</span>
                <select
                  id="sol-milano"
                  value={form.aplicativo}
                  onChange={onChange("aplicativo")}
                  className="glass-input w-full rounded-xl px-4 py-3 text-[15px] text-ink-50"
                >
                  <option value="">— Nessuno —</option>
                  {aplicativos.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
        <TextField
          id="sol-cliente"
          label={esExtra ? `${t("form.client")} (facoltativo)` : t("form.client")}
          value={form.cliente}
          onChange={onChange("cliente")}
          error={fieldErrors.cliente?.[0]}
          required={!esExtra}
        />
        <TextField id="sol-fecha" label={t("form.dateTime")} type="datetime-local" value={form.fechaHora} onChange={onChange("fechaHora")} error={fieldErrors.fechaHora?.[0]} required />
        <TextField className="sm:col-span-2" id="sol-destino" label={esExtra ? "Consegna" : "Destinazione"} value={form.destinazione} onChange={onChange("destinazione")} error={fieldErrors.destinazione?.[0]} required />
        {esAb && <TextField id="sol-aut" label="Aut. ritiro" value={form.autRitiro} onChange={onChange("autRitiro")} error={fieldErrors.autRitiro?.[0]} />}
        <TextField id="sol-fornitore" label="Fornitore" value={form.fornitore} onChange={onChange("fornitore")} error={fieldErrors.fornitore?.[0]} />
        <TextField
          id="sol-km"
          label={esAb ? t("form.kmTotal") : t("form.kmDestination")}
          placeholder={esAb ? t("form.kmExampleAb") : t("form.kmExample")}
          value={form.km}
          onChange={onChange("km")}
          error={fieldErrors.km?.[0]}
        />
        <TextField id="sol-pagato" label="Pagato (EUR)" type="number" step="0.01" min="0" value={form.pagato} onChange={onChange("pagato")} error={fieldErrors.pagato?.[0]} />
        <TextField id="sol-varie" label="Varie" placeholder={t("form.varieExample")} value={form.varie} onChange={onChange("varie")} error={fieldErrors.varie?.[0]} />
        <TextField id="sol-varie2" label="Varie 2 (EUR)" type="number" step="0.01" min="0" placeholder={t("form.varie2Example")} value={form.varie2} onChange={onChange("varie2")} error={fieldErrors.varie2?.[0]} />
      </div>

      {esRoma && (
        <label className="flex items-center gap-2.5 text-[14px] text-ink-100">
          <input type="checkbox" checked={form.pagato50} onChange={(e) => set("pagato50", e.target.checked)} className="h-4 w-4 accent-[var(--brand,#22e093)]" />
          Pagato al 50%
        </label>
      )}

      {aplicativos.length > 0 && !usaTexto && (
        <label className="block" htmlFor="sol-aplicativo">
          <span className="mb-1.5 block text-[13px] font-medium text-ink-300">{t("form.numberLabel")}</span>
          <select id="sol-aplicativo" value={form.aplicativo} onChange={onChange("aplicativo")} className="glass-input w-full rounded-xl px-4 py-3 text-[15px] text-ink-50">
            <option value="">{t("form.noNumber")}</option>
            {aplicativos.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {(esAb || esExtra) && (
        <Textarea
          id="sol-descripcion"
          label={t("form.shipmentDescription")}
          rows={7}
          value={form.descripcion}
          onChange={onChange("descripcion")}
          error={fieldErrors.descripcion?.[0]}
        />
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" className="!w-auto px-5 py-2.5" onClick={onCancel} disabled={submitting}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={submitting} className="!w-auto px-6 py-2.5">
          {solicitud ? t("form.saveChanges") : t("form.send")}
        </Button>
      </div>
    </form>
  );
};
