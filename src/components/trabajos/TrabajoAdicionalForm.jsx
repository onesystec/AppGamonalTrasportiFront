import { useEffect, useMemo, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { FileField } from "../ui/FileField";
import { Select } from "../ui/Select";
import { Switch } from "../ui/Switch";
import { TextField } from "../ui/TextField";
import { Textarea } from "../ui/Textarea";
import { toRomeDateTimeInputValue } from "../../lib/format";
import { listVehiclesRequest } from "../../lib/vehicles.api";

export const AREA_OPTIONS = [
  { value: "DHL", label: "DHL" },
  { value: "EXTRAS", label: "Extras" },
  { value: "FARMACIA", label: "Farmacia" },
  { value: "OTROS", label: "Otros" },
];
const ZONA_OPTIONS = [
  { value: "MILANO", label: "Milano" },
  { value: "ROMA", label: "Roma" },
];

const normalizeTarga = (v) => v.replace(/\s+/g, "").toUpperCase();
const errorOf = (errors, field) => (Array.isArray(errors?.[field]) ? errors[field][0] : errors?.[field]);

// Duracion trabajada (sin la pausa) en "X h Y min", para que el chofer vea lo que va a declarar.
const durationText = (inicio, fin, pausa) => {
  if (!inicio || !fin) return null;
  const minutes = (new Date(fin) - new Date(inicio)) / 60000 - (Number(pausa) || 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return `${Math.floor(minutes / 60)} h ${Math.round(minutes % 60)} min trabajados`;
};

// Formulario del chofer para cargar (o corregir) un trabajo adicional. La fecha de creacion la pone el servidor.
export const TrabajoAdicionalForm = ({ trabajo, defaultTarga, onSubmit, onCancel, submitting, error, fieldErrors }) => {
  const [vehicles, setVehicles] = useState([]);
  const [localErrors, setLocalErrors] = useState({});
  const [foto, setFoto] = useState(null);
  const [form, setForm] = useState(() => ({
    areaTipo: trabajo?.areaTipo ?? "",
    zona: trabajo?.zona ?? "",
    areaOtros: trabajo?.areaOtros ?? "",
    inicio: trabajo ? toRomeDateTimeInputValue(trabajo.inicioDeclarado) : "",
    fin: trabajo ? toRomeDateTimeInputValue(trabajo.finDeclarado) : "",
    pausaMin: trabajo ? String(trabajo.pausaMin || "") : "",
    descripcion: trabajo?.descripcion ?? "",
    solicitadoPor: trabajo?.solicitadoPor ?? "",
    sinVehiculo: trabajo?.sinVehiculo ?? false,
    targa: trabajo?.targa ?? defaultTarga ?? "",
    km: trabajo?.km != null ? String(trabajo.km) : "",
  }));
  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    listVehiclesRequest().then(setVehicles).catch(() => {});
  }, []);
  const targaOptions = useMemo(() => vehicles.map((v) => ({ value: normalizeTarga(v.targa), label: `${v.targa}${v.modelo ? ` - ${v.modelo}` : ""}` })), [vehicles]);

  const errors = { ...fieldErrors, ...localErrors };
  const err = (field) => errorOf(errors, field);
  const needsZona = form.areaTipo === "DHL" || form.areaTipo === "EXTRAS";

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.areaTipo) next.areaTipo = "Elige el area";
    if (needsZona && !form.zona) next.zona = "Elige Milano o Roma";
    if (form.areaTipo === "OTROS" && !form.areaOtros.trim()) next.areaOtros = "Especifica el area";
    if (!form.inicio) next.inicio = "Indica cuando empezaste";
    if (!form.fin) next.fin = "Indica cuando terminaste";
    else if (form.inicio && form.fin <= form.inicio) next.fin = "Debe ser posterior al inicio";
    if (form.descripcion.trim().length < 3) next.descripcion = "Cuenta brevemente que hiciste";
    if (!form.sinVehiculo && !form.targa) next.targa = "Elige la targa o marca que no usaste vehiculo";
    setLocalErrors(next);
    if (Object.keys(next).length > 0) return;

    onSubmit(
      {
        areaTipo: form.areaTipo,
        zona: needsZona ? form.zona : "",
        areaOtros: form.areaTipo === "OTROS" ? form.areaOtros.trim() : "",
        inicio: form.inicio,
        fin: form.fin,
        pausaMin: form.pausaMin,
        descripcion: form.descripcion.trim(),
        solicitadoPor: form.solicitadoPor.trim(),
        sinVehiculo: String(form.sinVehiculo),
        targa: form.sinVehiculo ? "" : form.targa,
        km: form.sinVehiculo ? "" : form.km,
      },
      foto
    );
  };

  const duracion = durationText(form.inicio, form.fin, form.pausaMin);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Alert>{error}</Alert>

      <Select
        id="areaTipo"
        label="Area"
        placeholder="Elige el area"
        options={AREA_OPTIONS}
        value={form.areaTipo}
        onChange={(e) => setField("areaTipo", e.target.value)}
        error={err("areaTipo")}
      />
      {err("areaTipo") && <span className="-mt-3 text-[13px] text-danger-500">{err("areaTipo")}</span>}
      {needsZona && (
        <Select id="zona" label="Zona" placeholder="Milano o Roma" options={ZONA_OPTIONS} value={form.zona} onChange={(e) => setField("zona", e.target.value)} error={err("zona")} />
      )}
      {needsZona && err("zona") && <span className="-mt-3 text-[13px] text-danger-500">{err("zona")}</span>}
      {form.areaTipo === "OTROS" && (
        <TextField id="areaOtros" label="Especifica el area" value={form.areaOtros} onChange={(e) => setField("areaOtros", e.target.value)} error={err("areaOtros")} placeholder="Ej. taller, oficina, mudanza" />
      )}
      {form.areaTipo === "OTROS" && err("areaOtros") && <span className="-mt-3 text-[13px] text-danger-500">{err("areaOtros")}</span>}

      <Textarea
        id="descripcion"
        label="¿Que trabajo hiciste?"
        value={form.descripcion}
        onChange={(e) => setField("descripcion", e.target.value)}
        error={err("descripcion")}
        placeholder="Ej. Entrega de pedidos de farmacia en Rozzano"
      />
      {err("descripcion") && <span className="-mt-3 text-[13px] text-danger-500">{err("descripcion")}</span>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField id="inicio" label="Inicio (fecha y hora)" type="datetime-local" value={form.inicio} onChange={(e) => setField("inicio", e.target.value)} error={err("inicio")} />
        <TextField id="fin" label="Fin (fecha y hora)" type="datetime-local" value={form.fin} onChange={(e) => setField("fin", e.target.value)} error={err("fin")} />
      </div>
      {(err("inicio") || err("fin")) && <span className="-mt-3 text-[13px] text-danger-500">{err("inicio") || err("fin")}</span>}
      <TextField id="pausaMin" label="Pausa o descanso, en minutos (opcional)" type="number" min="0" value={form.pausaMin} onChange={(e) => setField("pausaMin", e.target.value)} />
      {duracion && <p className="-mt-2 text-[13px] font-medium text-accent-300">{duracion}</p>}

      <Switch id="sinVehiculo" label="No use vehiculo" description="Lo hice a pie o en transporte publico." checked={form.sinVehiculo} onChange={(v) => setField("sinVehiculo", v)} />
      {!form.sinVehiculo && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Select id="targa" label="Targa del vehiculo" placeholder="Elige la targa" options={targaOptions} value={form.targa} onChange={(e) => setField("targa", e.target.value)} error={err("targa")} />
            {err("targa") && <span className="mt-1.5 block text-[13px] text-danger-500">{err("targa")}</span>}
          </div>
          <TextField id="km" label="Km en total (opcional)" type="number" min="0" step="0.1" value={form.km} onChange={(e) => setField("km", e.target.value)} error={err("km")} />
        </div>
      )}

      <TextField id="solicitadoPor" label="¿Quien te lo pidio? (opcional)" value={form.solicitadoPor} onChange={(e) => setField("solicitadoPor", e.target.value)} />
      <FileField id="foto" label="Foto o comprobante (opcional)" hint="Ticket, parte firmado o foto del trabajo" file={foto} onChange={setFoto} existing={trabajo?.foto ?? null} />

      <p className="text-[12px] text-ink-400">
        Tu responsable lo revisa antes de que cuente en tus horas. La fecha de carga se guarda sola y no se puede cambiar.
      </p>
      <div className="flex flex-wrap justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="ghost" className="sm:w-auto sm:px-5" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" className="sm:w-auto sm:px-6" loading={submitting}>
          {trabajo ? "Guardar y reenviar" : "Enviar para aprobacion"}
        </Button>
      </div>
    </form>
  );
};
