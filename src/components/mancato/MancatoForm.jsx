import clsx from "clsx";
import { useEffect, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { FileField } from "../ui/FileField";
import { SearchableSelect } from "../ui/SearchableSelect";
import { Switch } from "../ui/Switch";
import { TextField } from "../ui/TextField";
import { Textarea } from "../ui/Textarea";
import { CheckCircleIcon, ClockIcon, EuroIcon } from "../ui/icons";
import { useAuth } from "../../context/AuthContext";
import {
  MANCATO_ESTADO_BY_VALUE,
  MANCATO_PLAZO_DIAS,
  addDaysToDay,
  formatDay,
  parseCosto,
  romeToday,
} from "../../lib/mancato";
import { listUsersRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

const normalizeTarga = (value) => value.replace(/\s+/g, "").toUpperCase();

// Formulario de alta y de edicion de un Mancato Pagamento.
// El estado, la fecha de vencimiento y la fecha/hora de registro NO se editan: los
// calcula el sistema (se muestran solo para que se vea que pasa con lo que se carga).
export const MancatoForm = ({ mode, mancato, onSubmit, onCancel, submitting, error, fieldErrors = {} }) => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const isEdit = mode === "edit";
  // El chofer solo puede tocar estos campos y solo mientras no este pagado (ver backend).
  const lockedForChofer = !isPrivileged;

  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState(() => ({
    numero: mancato?.numero ?? "",
    targa: mancato?.targa ?? (isPrivileged ? "" : (user?.vehiculoAsignado?.targa ?? "")),
    driverId: mancato?.driver?.id ?? (isPrivileged ? "" : user?.id),
    fecha: mancato ? new Date(mancato.fecha).toISOString().slice(0, 10) : romeToday(),
    // Sin valor por defecto a proposito: tiene que ser la hora que dice el aviso.
    hora: mancato?.horaTransito ?? "",
    costo: mancato ? String(mancato.costo).replace(".", ",") : "",
    sitioWeb: mancato?.sitioWeb ?? "",
    comentarios: mancato?.comentarios ?? "",
    pagado: mancato?.pagado ?? false,
  }));
  const [foto, setFoto] = useState(null);
  const [comprobante, setComprobante] = useState(null);
  const [localErrors, setLocalErrors] = useState({});

  useEffect(() => {
    listVehiclesRequest()
      .then(setVehicles)
      .catch(() => {});
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

  const vencimientoDay = addDaysToDay(form.fecha || romeToday(), MANCATO_PLAZO_DIAS);
  const previewEstado = (isEdit ? form.pagado : Boolean(comprobante))
    ? "PAGADO"
    : vencimientoDay < romeToday()
      ? "VENCIDO"
      : "PENDIENTE";
  const estadoInfo = MANCATO_ESTADO_BY_VALUE[previewEstado];

  const errors = { ...fieldErrors, ...localErrors };
  const err = (field) => (Array.isArray(errors[field]) ? errors[field][0] : errors[field]);

  const driverOptions = drivers.map((d) => ({ value: d.id, label: `${d.nombre} ${d.apellido}` }));
  const driverName = mancato?.driver
    ? `${mancato.driver.nombre} ${mancato.driver.apellido}`
    : `${user?.nombre ?? ""} ${user?.apellido ?? ""}`.trim();

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (!isEdit || !lockedForChofer) {
      if (!form.numero.trim()) next.numero = "El numero es obligatorio";
    }
    if ((!isEdit || isPrivileged) && !form.hora) next.hora = "Indica la hora del transito (la dice el aviso)";
    if (!normalizeTarga(form.targa)) next.targa = "La targa es obligatoria";
    if (isPrivileged && !form.driverId) next.driverId = "Elige el chofer";
    if (parseCosto(form.costo) == null) next.costo = "Ingresa un importe mayor a 0 (ej. 37,50)";
    if (!isEdit && !foto) next.foto = "Sube la foto del mancato pagamento";
    setLocalErrors(next);
    if (Object.keys(next).length > 0) return;

    const fields = {
      targa: normalizeTarga(form.targa),
      costo: String(parseCosto(form.costo)),
      sitioWeb: form.sitioWeb.trim(),
      comentarios: form.comentarios.trim(),
    };
    if (!isEdit || isPrivileged) {
      fields.numero = form.numero.trim();
      fields.fecha = form.fecha;
      fields.hora = form.hora;
    }
    if (isPrivileged) fields.driverId = form.driverId;
    if (isEdit && isPrivileged) fields.pagado = String(form.pagado);
    // Al crear, "" en opcionales no hace falta mandarlo.
    if (!isEdit) {
      if (!fields.sitioWeb) delete fields.sitioWeb;
      if (!fields.comentarios) delete fields.comentarios;
    }

    onSubmit(fields, { foto, comprobante });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <Alert>{error}</Alert>

      {isPrivileged && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl glass-surface-sm px-4 py-3">
          <span className="text-[13px] text-ink-300">Estado</span>
          <span
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
              estadoInfo.pill,
            )}
          >
            <span className={clsx("h-1.5 w-1.5 rounded-full", estadoInfo.dot)} />
            {estadoInfo.label}
          </span>
          <span className="text-[12px] text-ink-400">
            {isEdit && isPrivileged
              ? "Se calcula solo; puedes marcarlo como pagado abajo."
              : "Se calcula solo: queda Pagado al subir el comprobante de pago."}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TextField
          id="numero"
          label="N. Mancato Pagamento"
          placeholder="Ej. 2026/123456"
          value={form.numero}
          onChange={(e) => setField("numero", e.target.value)}
          disabled={isEdit && lockedForChofer}
          error={err("numero")}
        />

        <div>
          <TextField
            id="targa"
            label="Targa"
            placeholder="Ej. AB123CD"
            list="mancato-targas"
            autoComplete="off"
            value={form.targa}
            onChange={(e) => setField("targa", e.target.value.toUpperCase())}
            onBlur={handleTargaBlur}
            error={err("targa")}
          />
          <datalist id="mancato-targas">
            {vehicles.map((v) => (
              <option key={v.id} value={v.targa}>
                {v.modelo}
              </option>
            ))}
          </datalist>
        </div>

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
          <TextField id="chofer" label="Chofer" value={driverName} disabled readOnly />
        )}

        <TextField
          id="fecha"
          label="Fecha"
          type="date"
          max={romeToday()}
          value={form.fecha}
          onChange={(e) => setField("fecha", e.target.value)}
          disabled={isEdit && lockedForChofer}
          error={err("fecha")}
        />

        <div>
          <TextField
            id="hora"
            label="Hora del tránsito"
            type="time"
            value={form.hora}
            onChange={(e) => setField("hora", e.target.value)}
            disabled={isEdit && lockedForChofer}
            error={err("hora")}
          />
          <span className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-400">
            <ClockIcon className="h-3.5 w-3.5 shrink-0" />
            La que aparece en el aviso (hora de Roma). Sirve para asignarlo al servicio.
          </span>
        </div>

        {isPrivileged && (
          <div>
            <TextField
              id="fechaVencimiento"
              label="Fecha de vencimiento"
              value={formatDay(vencimientoDay)}
              disabled
              readOnly
            />
            <span className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-400">
              <ClockIcon className="h-3.5 w-3.5 shrink-0" />
              La calcula el sistema: fecha del aviso + {MANCATO_PLAZO_DIAS} dias.
            </span>
          </div>
        )}

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
          <TextField
            id="sitioWeb"
            label="Sitio web de pago"
            placeholder="Direccion web o donde se paga"
            value={form.sitioWeb}
            onChange={(e) => setField("sitioWeb", e.target.value)}
            error={err("sitioWeb")}
          />
          {!isPrivileged && (
            <span className="mt-1.5 block text-[12px] text-ink-400">
              Donde dice el aviso que se paga (direccion web u otra indicacion). Escribelo como figura; es opcional.
            </span>
          )}
        </div>

        <FileField
          id="foto"
          label="Foto del mancato pagamento"
          hint="Imagen o PDF, hasta 15 MB"
          required={!isEdit}
          file={foto}
          onChange={setFoto}
          existing={mancato?.foto}
          error={err("foto")}
        />

        {isPrivileged && (
          <FileField
            id="comprobante"
            label="Comprobante de pago"
            hint="Al subirlo queda como Pagado"
            file={comprobante}
            onChange={setComprobante}
            existing={mancato?.comprobante}
            error={err("comprobante")}
          />
        )}

        <div className="sm:col-span-2">
          <Textarea
            id="comentarios"
            label={isPrivileged ? "Comentarios" : "Comentarios (opcional)"}
            placeholder={
              isPrivileged ? "Ej. donde se pago, que paso, etc." : "Algo que la oficina deba saber (opcional)"
            }
            maxLength={1000}
            value={form.comentarios}
            onChange={(e) => setField("comentarios", e.target.value)}
            error={err("comentarios")}
          />
        </div>
      </div>

      {isEdit && isPrivileged && (
        <div className="rounded-xl glass-surface-sm px-4 py-3">
          <Switch
            id="pagado"
            label="Marcar como pagado"
            description="Sin necesidad de subir el comprobante. Apagalo para reabrirlo."
            checked={form.pagado}
            onChange={(v) => setField("pagado", v)}
          />
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl bg-accent-500/10 px-4 py-3 text-[13px] text-ink-300">
        <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" />
        <span>
          {isEdit && mancato
            ? `Registrado el ${new Date(mancato.registradoAt).toLocaleString("es-AR", { timeZone: "Europe/Rome", hour12: false })} (hora de Roma). No se puede editar.`
            : "El sistema guarda solo el dia y la hora en que registras este mancato pagamento. No se puede editar."}
        </span>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="ghost" className="sm:w-auto sm:px-6" disabled={submitting} onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" className="sm:w-auto sm:px-8" loading={submitting}>
          {isEdit ? "Guardar cambios" : isPrivileged ? "Registrar mancato pagamento" : "Subir mancato pagamento"}
        </Button>
      </div>
    </form>
  );
};
