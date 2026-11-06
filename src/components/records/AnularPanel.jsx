import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { TextField } from "../ui/TextField";

// Panel que aparece bajo "Estado" al marcar un servicio como Anulado: los km totales que el chofer ya recorrio antes de la anulacion.
// Con km, el servicio anulado se factura y se paga por esos km y se puede compactar con otro servicio; sin km queda anulado sin pago.
export const emptyAnular = () => ({ km: "", soloIda: false, nota: "" });

// Mensaje si los km no son validos ("" = todo en orden; vacio vale 0).
export const anularError = (a) => {
  const km = a.km.trim() === "" ? 0 : Number(a.km.replace(",", "."));
  return Number.isFinite(km) && km >= 0 && km <= 5000 ? "" : "Anulacion: los km recorridos tienen que estar entre 0 y 5000";
};

export const buildAnularBody = (a) => ({
  kmRecorridos: a.km.trim() === "" ? 0 : Number(a.km.replace(",", ".")),
  soloIda: Boolean(a.soloIda),
  nota: a.nota.trim() || null,
});

// Total de km que se facturan y se pagan: los indicados, o el doble si son solo de ida.
export const kmTotalAnular = (a) => {
  const km = a.km.trim() === "" ? 0 : Number(a.km.replace(",", "."));
  return Number.isFinite(km) ? Math.round(km * (a.soloIda ? 2 : 1) * 10) / 10 : 0;
};

export const KM_MODO_OPTIONS = [
  { value: "total", label: "Ida y vuelta (total recorrido)" },
  { value: "ida", label: "Solo ida (se cuenta tambien la vuelta)" },
];

export const AnularPanel = ({ record, value, onChange, disabled }) => {
  const planificados = record.kmFacturables ?? 0;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-danger-500/30 bg-danger-500/5 p-4">
      <TextField
        id="anular-km"
        label="Km recorridos antes de anular"
        type="number"
        inputMode="decimal"
        min="0"
        max="5000"
        step="0.1"
        value={value.km}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, km: e.target.value })}
        placeholder="Si el chofer no salio, deja vacio"
      />
      <Select
        id="anular-modo"
        label="Esos km son"
        options={KM_MODO_OPTIONS}
        value={value.soloIda ? "ida" : "total"}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, soloIda: e.target.value === "ida" })}
      />
      {value.soloIda && kmTotalAnular(value) > 0 && (
        <p className="-mt-1 text-[13px] font-medium text-ink-100">Se facturan y se pagan {kmTotalAnular(value)} km (ida y vuelta).</p>
      )}
      <p className="-mt-1 text-[12px] text-ink-400">
        Con km, el servicio anulado se <b>factura y se paga</b> por esos km y se puede compactar con otro servicio.
        {planificados > 0 ? ` El servicio tiene ${planificados} km planificados.` : ""} Sin km queda anulado como siempre (sin pago ni facturacion).
      </p>
      <Textarea
        id="anular-nota"
        label="Nota (opcional)"
        value={value.nota}
        maxLength={300}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, nota: e.target.value })}
        placeholder="Ej.: el cliente cancelo en camino"
      />
    </div>
  );
};
