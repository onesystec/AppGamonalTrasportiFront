import clsx from "clsx";
import { useEffect, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { FileField } from "../ui/FileField";
import { SearchableSelect } from "../ui/SearchableSelect";
import { SegmentedControl } from "../ui/SegmentedControl";
import { Switch } from "../ui/Switch";
import { TextField } from "../ui/TextField";
import { Textarea } from "../ui/Textarea";
import { CheckCircleIcon, ClockIcon, EuroIcon } from "../ui/icons";
import { useAuth } from "../../context/AuthContext";
import { AREA_ACCESS_OPTIONS, userAreaKeys } from "../../lib/roles";
import { MULTA_ESTADO_BY_VALUE, MULTA_PLAZO_POR_DEFECTO_DIAS, QUIEN_PAGA_OPTIONS } from "../../lib/multas";
import { suggestMultaDriverRequest } from "../../lib/multas.api";
import { addDaysToDay, parseCosto, romeToday } from "../../lib/mancato";
import { listUsersRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

const normalizeTarga = (value) => value.replace(/\s+/g, "").toUpperCase();

// Quien llevaba la unidad el dia de la infraccion, segun Registros (ver suggestDriversForActor
// en el backend): botones para elegir al chofer con un toque.
const DriverSuggestion = ({ suggestion, selectedId, autoPicked, onPick }) => {
  if (!suggestion) return null;
  if (suggestion.loading) {
    return <p className="mt-1.5 text-[12px] text-ink-400">Buscando quien llevaba esa unidad...</p>;
  }
  const { candidatos, asignados, vehiculoEncontrado } = suggestion.data;

  if (!vehiculoEncontrado) {
    return <p className="mt-1.5 text-[12px] text-ink-400">Esa targa no esta en la flota: elige el chofer a mano.</p>;
  }

  const options =
    candidatos.length > 0
      ? candidatos.map((c) => ({
          id: c.id,
          label: `${c.nombre} ${c.apellido}`,
          detail: `${c.servicios} ${c.servicios === 1 ? "servicio" : "servicios"} (${c.desde}-${c.hasta})`,
        }))
      : asignados.map((c) => ({ id: c.id, label: `${c.nombre} ${c.apellido}`, detail: "chofer habitual" }));

  return (
    <div className="mt-2 rounded-xl bg-accent-500/10 px-3 py-2.5">
      <p className="text-[12px] font-medium text-ink-300">
        {candidatos.length > 0
          ? "Ese dia llevaron la unidad (segun Registros):"
          : "Ese dia no hay servicios de esa unidad en Registros."}
        {candidatos.length === 0 && asignados.length === 0 && " Elige el chofer a mano."}
      </p>
      {options.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onPick(option.id)}
              className={clsx(
                "rounded-full px-3 py-1 text-left text-[12px] font-medium transition-colors",
                selectedId === option.id
                  ? "bg-success-500/20 text-success-500 ring-1 ring-success-500/40"
                  : "glass-input text-ink-50 hover:bg-line/10"
              )}
            >
              {option.label} <span className="font-normal text-ink-400">- {option.detail}</span>
            </button>
          ))}
        </div>
      )}
      {autoPicked && selectedId && (
        <p className="mt-1.5 text-[12px] text-success-500">Se eligio solo: fue el unico chofer de esa unidad ese dia.</p>
      )}
    </div>
  );
};

// Formulario de alta y de edicion de una Multa (solo OWNER/ADMIN). El estado es
// automatico: Pagado si tiene el comprobante o se marca pagada, Vencido si no esta pagada y
// ya paso la fecha de vencimiento, Pendiente el resto.
export const MultaForm = ({ mode, multa, onSubmit, onCancel, submitting, error, fieldErrors = {} }) => {
  const isEdit = mode === "edit";
  const { user } = useAuth();
  // Un Responsable elige entre sus areas (obligatorio); el Admin puede dejarla vacia (solo la ven los Admin).
  const myAreaKeys = userAreaKeys(user);
  const areaOptions = [
    ...(myAreaKeys === null ? [{ value: "", label: "Sin area (solo la ven los Admin)" }] : []),
    ...AREA_ACCESS_OPTIONS.filter((a) => myAreaKeys === null || myAreaKeys.includes(a.key)).map((a) => ({
      value: a.key,
      label: a.label,
    })),
  ];

  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState(() => ({
    numeroVerbale: multa?.numeroVerbale ?? "",
    driverId: multa?.driver?.id ?? "",
    targa: multa?.targa ?? "",
    costo: multa ? String(multa.costo).replace(".", ",") : "",
    quienPaga: multa?.quienPaga ?? "",
    area: multa?.area ?? (myAreaKeys?.length === 1 ? myAreaKeys[0] : ""),
    fechaInfraccion: multa?.fechaInfraccion ? new Date(multa.fechaInfraccion).toISOString().slice(0, 10) : "",
    horaInfraccion: multa?.horaInfraccion ?? "",
    fechaRecepcion: multa ? new Date(multa.fechaRecepcion).toISOString().slice(0, 10) : romeToday(),
    fechaVencimiento: multa ? new Date(multa.fechaVencimiento).toISOString().slice(0, 10) : "",
    comentarios: multa?.comentarios ?? "",
    pagado: multa?.pagado ?? false,
    descontado: multa?.descontado ?? false,
  }));
  // El vencimiento lo dice el verbale: se sugiere recepcion + 60 dias hasta que se toque a mano.
  const [vencimientoTouched, setVencimientoTouched] = useState(isEdit);
  const [archivoMulta, setArchivoMulta] = useState(null);
  const [comprobante, setComprobante] = useState(null);
  const [localErrors, setLocalErrors] = useState({});

  useEffect(() => {
    listVehiclesRequest().then(setVehicles).catch(() => {});
    listUsersRequest()
      .then((users) => setDrivers(users.filter((u) => u.estado === "ACTIVO")))
      .catch(() => {});
  }, []);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  // Con la targa y el dia de la infraccion se busca en Registros quien llevaba esa unidad.
  // Si fue un unico chofer y todavia no se eligio ninguno, se elige solo.
  const [suggestion, setSuggestion] = useState(null);
  const [autoPicked, setAutoPicked] = useState(false);
  useEffect(() => {
    const targa = normalizeTarga(form.targa);
    if (targa.length < 5 || !form.fechaInfraccion) {
      setSuggestion(null);
      return undefined;
    }
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      setSuggestion({ loading: true });
      suggestMultaDriverRequest(targa, form.fechaInfraccion)
        .then((data) => {
          if (cancelled) return;
          setSuggestion({ loading: false, data });
          if (data.candidatos.length === 1) {
            setForm((prev) => {
              if (prev.driverId) return prev;
              setAutoPicked(true);
              return { ...prev, driverId: data.candidatos[0].id };
            });
          }
        })
        .catch(() => {
          if (!cancelled) setSuggestion(null);
        });
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [form.targa, form.fechaInfraccion]);

  const pickDriver = (id) => {
    setField("driverId", id);
    setAutoPicked(false);
  };

  const suggestedVencimiento = addDaysToDay(form.fechaRecepcion || romeToday(), MULTA_PLAZO_POR_DEFECTO_DIAS);
  const vencimiento = vencimientoTouched ? form.fechaVencimiento : suggestedVencimiento;

  // Al elegir una targa, si el vehiculo tiene un unico chofer asignado y todavia no se
  // eligio chofer, se sugiere ese.
  const handleTargaBlur = () => {
    const targa = normalizeTarga(form.targa);
    setField("targa", targa);
    if (form.driverId || !targa) return;
    const vehicle = vehicles.find((v) => normalizeTarga(v.targa) === targa);
    if (vehicle?.conductores?.length === 1) setField("driverId", vehicle.conductores[0].id);
  };

  const isPaid = isEdit ? form.pagado || Boolean(comprobante) : Boolean(comprobante);
  const previewEstado = isPaid ? "PAGADO" : vencimiento && vencimiento < romeToday() ? "VENCIDO" : "PENDIENTE";
  const estadoInfo = MULTA_ESTADO_BY_VALUE[previewEstado];

  const errors = { ...fieldErrors, ...localErrors };
  const err = (field) => (Array.isArray(errors[field]) ? errors[field][0] : errors[field]);
  const driverOptions = drivers.map((d) => ({ value: d.id, label: `${d.nombre} ${d.apellido}` }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.numeroVerbale.trim()) next.numeroVerbale = "El numero de verbale es obligatorio";
    if (!form.driverId && !isEdit) next.driverId = "Elige el chofer responsable";
    if (!normalizeTarga(form.targa)) next.targa = "La targa es obligatoria";
    // Algunas multas importadas no traian el monto (quedaron en 0): se pueden guardar sin tocarlo.
    const costoSinDato = isEdit && Number(multa?.costo) === 0 && (form.costo === "0" || form.costo === "");
    if (parseCosto(form.costo) == null && !costoSinDato) next.costo = "Ingresa un importe mayor a 0 (ej. 173,50)";
    if (!form.quienPaga) next.quienPaga = "Indica si pago el chofer o se descuenta";
    if (myAreaKeys !== null && !form.area) next.area = "Elige el area de la multa";
    if (!form.fechaRecepcion) next.fechaRecepcion = "Indica la fecha de recepcion";
    if (!vencimiento) next.fechaVencimiento = "Indica la fecha de vencimiento";
    else if (form.fechaRecepcion && vencimiento < form.fechaRecepcion) {
      next.fechaVencimiento = "No puede ser anterior a la fecha de recepcion";
    }
    if (form.fechaInfraccion && form.fechaRecepcion && form.fechaInfraccion > form.fechaRecepcion) {
      next.fechaInfraccion = "No puede ser posterior a la fecha de recepcion";
    }
    if (!isEdit && !archivoMulta) next.multa = "Sube la foto o el PDF de la multa";
    setLocalErrors(next);
    if (Object.keys(next).length > 0) return;

    const fields = {
      numeroVerbale: form.numeroVerbale.trim(),
      driverId: form.driverId,
      targa: normalizeTarga(form.targa),
      costo: String(parseCosto(form.costo)),
      quienPaga: form.quienPaga,
      horaInfraccion: form.horaInfraccion,
      // En edicion "" quita el area (solo un Admin); al crear, si esta vacia no se manda.
      area: form.area,
      fechaRecepcion: form.fechaRecepcion,
      fechaVencimiento: vencimiento,
      comentarios: form.comentarios.trim(),
      // En edicion "" borra la fecha; al crear, si esta vacia no se manda.
      fechaInfraccion: form.fechaInfraccion,
    };
    if (costoSinDato) delete fields.costo;
    if (isEdit) {
      fields.pagado = String(form.pagado);
      if (form.quienPaga === "A_DESCONTAR") fields.descontado = String(form.descontado);
    } else {
      if (!fields.comentarios) delete fields.comentarios;
      if (!fields.fechaInfraccion) delete fields.fechaInfraccion;
      if (!fields.horaInfraccion) delete fields.horaInfraccion;
      if (!fields.area) delete fields.area;
    }

    onSubmit(fields, { multa: archivoMulta, comprobante });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <Alert>{error}</Alert>

      <div className="flex flex-wrap items-center gap-3 rounded-xl glass-surface-sm px-4 py-3">
        <span className="text-[13px] text-ink-300">Estado</span>
        <span
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
            estadoInfo.pill
          )}
        >
          <span className={clsx("h-1.5 w-1.5 rounded-full", estadoInfo.dot)} />
          {estadoInfo.label}
        </span>
        <span className="text-[12px] text-ink-400">
          Se calcula solo: Pagado con el comprobante, Vencido pasada la fecha de vencimiento.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TextField
          id="numeroVerbale"
          label="N. Verbale"
          placeholder="Ej. 2026/123456"
          value={form.numeroVerbale}
          onChange={(e) => setField("numeroVerbale", e.target.value)}
          error={err("numeroVerbale")}
        />

        <div>
          <SearchableSelect
            id="driverId"
            label="Chofer responsable"
            placeholder="Escribe para buscar un chofer"
            options={driverOptions}
            value={form.driverId}
            onChange={pickDriver}
            error={err("driverId")}
          />
          <DriverSuggestion
            suggestion={suggestion}
            selectedId={form.driverId}
            autoPicked={autoPicked}
            onPick={pickDriver}
          />
        </div>

        <div>
          <TextField
            id="targa"
            label="Targa"
            placeholder="Ej. AB123CD"
            list="multa-targas"
            autoComplete="off"
            value={form.targa}
            onChange={(e) => setField("targa", e.target.value.toUpperCase())}
            onBlur={handleTargaBlur}
            error={err("targa")}
          />
          <datalist id="multa-targas">
            {vehicles.map((v) => (
              <option key={v.id} value={v.targa}>
                {v.modelo}
              </option>
            ))}
          </datalist>
        </div>

        <TextField
          id="costo"
          label="Costo"
          icon={EuroIcon}
          inputMode="decimal"
          placeholder="0,00"
          value={form.costo}
          onChange={(e) => setField("costo", e.target.value.replace(/[^\d.,]/g, ""))}
          error={err("costo")}
        />

        <div className="sm:col-span-2">
          <SearchableSelect
            id="area"
            label="Area de servicio"
            placeholder="Elige el area a la que se imputa"
            options={areaOptions}
            value={form.area}
            onChange={(v) => setField("area", v)}
            error={err("area")}
          />
          <span className="mt-1.5 block text-[12px] text-ink-400">
            Define quien la ve: los Responsables solo ven las multas de sus areas.
          </span>
        </div>

        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-[13px] font-medium text-ink-300">¿Chofer pago?</span>
          <SegmentedControl
            options={QUIEN_PAGA_OPTIONS}
            value={form.quienPaga}
            onChange={(v) => setField("quienPaga", v)}
            className="w-full sm:w-auto"
          />
          <span className="mt-1.5 block text-[12px] text-ink-400">
            "A descontar": la paga la empresa y despues se le descuenta al chofer.
          </span>
          {err("quienPaga") && <span className="mt-1.5 block text-[13px] text-danger-500">{err("quienPaga")}</span>}
        </div>

        <div>
          <TextField
            id="fechaInfraccion"
            label="Fecha de la infraccion (opcional)"
            type="date"
            max={form.fechaRecepcion || romeToday()}
            value={form.fechaInfraccion}
            onChange={(e) => setField("fechaInfraccion", e.target.value)}
            error={err("fechaInfraccion")}
          />
          <span className="mt-1.5 block text-[12px] text-ink-400">
            Con la targa y este dia, el sistema te dice quien llevaba la unidad.
          </span>
        </div>

        <div>
          <TextField
            id="horaInfraccion"
            label="Hora de la infraccion (opcional)"
            type="time"
            value={form.horaInfraccion}
            onChange={(e) => setField("horaInfraccion", e.target.value)}
            error={err("horaInfraccion")}
            disabled={!form.fechaInfraccion}
          />
          <span className="mt-1.5 block text-[12px] text-ink-400">
            Si el verbale dice la hora, se sabe que servicio estaba en curso.
          </span>
        </div>

        <TextField
          id="fechaRecepcion"
          label="Fecha de recepcion"
          type="date"
          max={romeToday()}
          value={form.fechaRecepcion}
          onChange={(e) => setField("fechaRecepcion", e.target.value)}
          error={err("fechaRecepcion")}
        />

        <div>
          <TextField
            id="fechaVencimiento"
            label="Fecha de vencimiento"
            type="date"
            min={form.fechaRecepcion || undefined}
            value={vencimiento}
            onChange={(e) => {
              setVencimientoTouched(true);
              setField("fechaVencimiento", e.target.value);
            }}
            error={err("fechaVencimiento")}
          />
          <span className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-400">
            <ClockIcon className="h-3.5 w-3.5 shrink-0" />
            {vencimientoTouched
              ? "Cargada a mano segun el verbale."
              : `Sugerida: ${MULTA_PLAZO_POR_DEFECTO_DIAS} dias desde la recepcion. Copia la del verbale si es otra.`}
          </span>
        </div>

        <div className="sm:col-span-2">
          <Textarea
            id="comentarios"
            label="Comentarios"
            placeholder="Ej. infraccion, lugar, a quien se comunico, etc."
            maxLength={1000}
            value={form.comentarios}
            onChange={(e) => setField("comentarios", e.target.value)}
            error={err("comentarios")}
          />
        </div>

        <FileField
          id="multa"
          label="Foto o PDF de la multa"
          hint="Imagen o PDF, hasta 15 MB"
          camera
          required={!isEdit}
          file={archivoMulta}
          onChange={setArchivoMulta}
          existing={multa?.multa}
          error={err("multa")}
        />

        <FileField
          id="comprobante"
          label="Comprobante de pago"
          hint="Al subirlo queda como Pagado"
          camera
          file={comprobante}
          onChange={setComprobante}
          existing={multa?.comprobante}
          error={err("comprobante")}
        />
      </div>

      {isEdit && (
        <div className="flex flex-col gap-4 rounded-xl glass-surface-sm px-4 py-3">
          <Switch
            id="pagado"
            label="Marcar como pagada"
            description="Sin necesidad de subir el comprobante. Apagalo para reabrirla."
            checked={form.pagado}
            onChange={(v) => setField("pagado", v)}
          />
          {form.quienPaga === "A_DESCONTAR" && (
            <Switch
              id="descontado"
              label="Ya se descontó al chofer"
              description="Marcalo cuando el descuento ya se aplico en su pago."
              checked={form.descontado}
              onChange={(v) => setField("descontado", v)}
            />
          )}
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl bg-accent-500/10 px-4 py-3 text-[13px] text-ink-300">
        <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" />
        <span>
          {isEdit && multa
            ? `Cargada el ${new Date(multa.registradoAt).toLocaleString("es-AR", { timeZone: "Europe/Rome", hour12: false })} (hora de Roma). No se puede editar.`
            : "El sistema guarda solo el dia y la hora en que cargas esta multa. No se puede editar."}
        </span>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="ghost" className="sm:w-auto sm:px-6" disabled={submitting} onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" className="sm:w-auto sm:px-8" loading={submitting}>
          {isEdit ? "Guardar cambios" : "Registrar multa"}
        </Button>
      </div>
    </form>
  );
};
