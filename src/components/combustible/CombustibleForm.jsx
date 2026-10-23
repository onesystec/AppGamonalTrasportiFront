import { useEffect, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { FileField } from "../ui/FileField";
import { SearchableSelect } from "../ui/SearchableSelect";
import { Select } from "../ui/Select";
import { TextField } from "../ui/TextField";
import { CheckCircleIcon, ClockIcon, EuroIcon } from "../ui/icons";
import { useAuth } from "../../context/AuthContext";
import { AREA_OPTIONS, readLastUsed, romeNowHHMM, saveLastUsed } from "../../lib/combustible";
import { listCombustibleMetodosRequest } from "../../lib/combustible.api";
import { parseCosto, romeToday } from "../../lib/mancato";
import { listUsersRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

const normalizeTarga = (value) => value.replace(/\s+/g, "").toUpperCase();

// Formulario de alta y de edicion de una carga de combustible.
// El chofer se asigna solo (es quien sube el comprobante); solo OWNER/ADMIN pueden
// cambiarlo. La fecha y hora de registro la guarda el sistema y no se editan.
export const CombustibleForm = ({
  mode,
  registro,
  onSubmit,
  onCancel,
  onForce,
  submitting,
  error,
  fieldErrors = {},
}) => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const isEdit = mode === "edit";

  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [metodos, setMetodos] = useState([]);
  const [form, setForm] = useState(() => {
    // Al crear arranca con la ultima area y gasolinera que uso este chofer.
    const last = isEdit ? { area: "", metodo: "" } : readLastUsed();
    return {
      driverId: registro?.driver?.id ?? (isPrivileged ? "" : user?.id),
      targa: registro?.targa ?? (isPrivileged ? "" : (user?.vehiculoAsignado?.targa ?? "")),
      monto: registro ? String(registro.monto).replace(".", ",") : "",
      metodo: registro?.metodo ?? last.metodo,
      area: registro?.area ?? last.area,
      fecha: registro ? new Date(registro.fecha).toISOString().slice(0, 10) : romeToday(),
      // Al crear arranca con la hora actual (el chofer sube el comprobante al cargar); editable.
      hora: registro?.horaCarga ?? romeNowHHMM(),
    };
  });
  const [comprobante, setComprobante] = useState(null);
  const [localErrors, setLocalErrors] = useState({});

  useEffect(() => {
    listVehiclesRequest().then(setVehicles).catch(() => {});
    listCombustibleMetodosRequest().then(setMetodos).catch(() => {});
    if (isPrivileged) {
      listUsersRequest()
        .then((users) => setDrivers(users.filter((u) => u.estado === "ACTIVO")))
        .catch(() => {});
    }
  }, [isPrivileged]);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  // Al elegir una targa, si el vehiculo tiene un unico chofer asignado y todavia no se
  // eligio chofer, se sugiere ese (solo OWNER/ADMIN; el chofer siempre es el mismo).
  const handleTargaBlur = () => {
    const targa = normalizeTarga(form.targa);
    setField("targa", targa);
    if (!isPrivileged || form.driverId || !targa) return;
    const vehicle = vehicles.find((v) => normalizeTarga(v.targa) === targa);
    if (vehicle?.conductores?.length === 1) setField("driverId", vehicle.conductores[0].id);
  };

  const errors = { ...fieldErrors, ...localErrors };
  const err = (field) => (Array.isArray(errors[field]) ? errors[field][0] : errors[field]);

  const driverOptions = drivers.map((d) => ({ value: d.id, label: `${d.nombre} ${d.apellido}` }));
  const driverName = registro?.driver
    ? `${registro.driver.nombre} ${registro.driver.apellido}`
    : `${user?.nombre ?? ""} ${user?.apellido ?? ""}`.trim();

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (isPrivileged && !form.driverId) next.driverId = "Elige el chofer";
    if (!normalizeTarga(form.targa)) next.targa = "La targa es obligatoria";
    if (parseCosto(form.monto) == null) next.monto = "Ingresa un importe mayor a 0 (ej. 45,50)";
    if (!form.metodo.trim()) next.metodo = "Indica la gasolinera";
    if (!form.area) next.area = "Elige el area";
    if (!form.fecha) next.fecha = "Indica la fecha";
    if (!form.hora) next.hora = "Indica la hora de la carga";
    if (!isEdit && !comprobante) next.comprobante = "Sube el comprobante de pago";
    setLocalErrors(next);
    if (Object.keys(next).length > 0) return;

    const fields = {
      targa: normalizeTarga(form.targa),
      monto: String(parseCosto(form.monto)),
      metodo: form.metodo.trim(),
      area: form.area,
      fecha: form.fecha,
      hora: form.hora,
    };
    if (isPrivileged) fields.driverId = form.driverId;
    if (!isEdit) saveLastUsed({ area: form.area, metodo: fields.metodo });

    onSubmit(fields, { comprobante });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <Alert>{error}</Alert>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {isPrivileged ? (
          <SearchableSelect
            id="driverId"
            label="Chofer"
            placeholder="Escribe para buscar un chofer"
            options={driverOptions}
            value={form.driverId}
            onChange={(v) => setField("driverId", v)}
            error={err("driverId")}
          />
        ) : (
          <div>
            <TextField id="chofer" label="Chofer" value={driverName} disabled readOnly />
            <span className="mt-1.5 block text-[12px] text-ink-400">Se asigna solo: eres tu quien carga.</span>
          </div>
        )}

        <div>
          <TextField
            id="targa"
            label="Targa"
            placeholder="Ej. AB123CD"
            list="combustible-targas"
            autoComplete="off"
            value={form.targa}
            onChange={(e) => setField("targa", e.target.value.toUpperCase())}
            onBlur={handleTargaBlur}
            error={err("targa")}
          />
          <datalist id="combustible-targas">
            {vehicles.map((v) => (
              <option key={v.id} value={v.targa}>
                {v.modelo}
              </option>
            ))}
          </datalist>
        </div>

        <TextField
          id="monto"
          label="Monto"
          icon={EuroIcon}
          inputMode="decimal"
          placeholder="0,00"
          value={form.monto}
          onChange={(e) => setField("monto", e.target.value.replace(/[^\d.,]/g, ""))}
          error={err("monto")}
        />

        <div>
          <TextField
            id="metodo"
            label="Método (gasolinera)"
            placeholder="Ej. Eni, Q8, Tamoil"
            list="combustible-metodos"
            autoComplete="off"
            maxLength={80}
            value={form.metodo}
            onChange={(e) => setField("metodo", e.target.value)}
            error={err("metodo")}
          />
          <datalist id="combustible-metodos">
            {metodos.map((m) => (
              <option key={m.nombre} value={m.nombre} />
            ))}
          </datalist>
        </div>

        <Select
          id="area"
          label="Área"
          placeholder="Elige el área"
          options={AREA_OPTIONS}
          value={form.area}
          onChange={(e) => setField("area", e.target.value)}
          error={err("area")}
        />

        <TextField
          id="fecha"
          label="Fecha"
          type="date"
          max={romeToday()}
          value={form.fecha}
          onChange={(e) => setField("fecha", e.target.value)}
          error={err("fecha")}
        />

        <div>
          <TextField
            id="hora"
            label="Hora de la carga"
            type="time"
            value={form.hora}
            onChange={(e) => setField("hora", e.target.value)}
            error={err("hora")}
          />
          <span className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-400">
            <ClockIcon className="h-3.5 w-3.5 shrink-0" />
            Sirve para asignar la carga al servicio correcto.
          </span>
        </div>

        <div className="sm:col-span-2">
          <FileField
            id="comprobante"
            label="Comprobante de pago"
            hint="Foto del ticket o PDF, hasta 15 MB"
            camera
            required={!isEdit}
            file={comprobante}
            onChange={setComprobante}
            existing={registro?.comprobante}
            error={err("comprobante")}
          />
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl bg-accent-500/10 px-4 py-3 text-[13px] text-ink-300">
        <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" />
        <span>
          {isEdit && registro
            ? `Registrado el ${new Date(registro.registradoAt).toLocaleString("es-AR", { timeZone: "Europe/Rome", hour12: false })}. No se puede editar.`
            : "El sistema guarda solo el dia y la hora en que registras la carga. No se puede editar."}
        </span>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onForce && (
          <Button variant="ghost" className="sm:w-auto sm:px-6" disabled={submitting} onClick={onForce}>
            Es otra carga: registrar igual
          </Button>
        )}
        {onCancel && (
          <Button variant="ghost" className="sm:w-auto sm:px-6" disabled={submitting} onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" className="sm:w-auto sm:px-8" loading={submitting}>
          {isEdit ? "Guardar cambios" : "Registrar carga"}
        </Button>
      </div>
    </form>
  );
};
