import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MonthSelector } from "../../components/finanzas/MonthSelector";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { FileField } from "../../components/ui/FileField";
import { GlassCard } from "../../components/ui/GlassCard";
import { PageLoader } from "../../components/ui/PageLoader";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Select } from "../../components/ui/Select";
import { TextField } from "../../components/ui/TextField";
import { Textarea } from "../../components/ui/Textarea";
import { PlusIcon } from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { currentMonth } from "../../lib/finanzas";
import { formatCurrency } from "../../lib/format";
import {
  createOtroGastoRequest,
  deleteOtroGastoRequest,
  listOtrosGastosRequest,
  reviewOtroGastoRequest,
  updateOtroGastoRequest,
} from "../../lib/otrosGastos.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

const CONCEPTOS = [
  { value: "ACEITE", label: "Aceite" },
  { value: "REFRIGERANTE", label: "Liquido refrigerante" },
  { value: "LAVADO", label: "Lavado" },
  { value: "NEUMATICOS", label: "Neumaticos" },
  { value: "REPUESTO", label: "Repuesto" },
  { value: "OTRO", label: "Otro" },
];

const ESTADO = {
  PENDIENTE: { label: "En revision", tone: "bg-warning-500/20 text-warning-500" },
  REEMBOLSADO: { label: "Reembolsado", tone: "bg-success-500/15 text-success-500" },
  RECHAZADO: { label: "Rechazado", tone: "bg-danger-500/15 text-danger-500" },
};

const EstadoChip = ({ estado }) => (
  <span className={clsx("inline-flex rounded-full px-2.5 py-1 text-[12px] font-medium", ESTADO[estado].tone)}>{ESTADO[estado].label}</span>
);

// "2026-10-28" -> "28/10/2026" (sin pasar por Date: un dia sin hora no debe moverse por la zona horaria).
const fechaTexto = (fecha) => fecha.split("-").reverse().join("/");
const todayRome = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
const normalizeTarga = (v) => v.replace(/\s+/g, "").toUpperCase();
const errorOf = (errors, field) => (Array.isArray(errors?.[field]) ? errors[field][0] : errors?.[field]);

// Formulario basico: que compraste, cuanto, cuando y (si quieres) el vehiculo y el comprobante.
const GastoForm = ({ gasto, defaultTarga, onSubmit, onCancel, submitting, error, fieldErrors }) => {
  const [vehicles, setVehicles] = useState([]);
  const [comprobante, setComprobante] = useState(null);
  const [quitar, setQuitar] = useState(false);
  const [localErrors, setLocalErrors] = useState({});
  const [form, setForm] = useState(() => ({
    concepto: gasto?.concepto ?? "",
    descripcion: gasto?.descripcion ?? "",
    monto: gasto ? String(gasto.monto) : "",
    fecha: gasto?.fecha ?? todayRome(),
    targa: gasto?.vehiculo ? normalizeTarga(gasto.vehiculo.targa) : gasto ? "" : normalizeTarga(defaultTarga ?? ""),
  }));
  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    listVehiclesRequest().then(setVehicles).catch(() => {});
  }, []);
  const targaOptions = useMemo(
    () => [{ value: "", label: "Sin vehiculo" }, ...vehicles.map((v) => ({ value: normalizeTarga(v.targa), label: `${v.targa}${v.modelo ? ` - ${v.modelo}` : ""}` }))],
    [vehicles]
  );

  const errors = { ...fieldErrors, ...localErrors };
  const err = (field) => errorOf(errors, field);

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.concepto) next.concepto = "Elige que compraste";
    if (form.concepto === "OTRO" && !form.descripcion.trim()) next.descripcion = "Cuenta brevemente que compraste";
    if (!(Number(String(form.monto).replace(",", ".")) > 0)) next.monto = "Pon el importe";
    if (!form.fecha) next.fecha = "Indica la fecha";
    setLocalErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit(
      {
        concepto: form.concepto,
        descripcion: form.descripcion.trim(),
        monto: form.monto,
        fecha: form.fecha,
        targa: form.targa,
        ...(gasto ? { quitarComprobante: String(quitar && !comprobante) } : {}),
      },
      comprobante
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Alert>{error}</Alert>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select id="concepto" label="¿Que compraste?" placeholder="Elige una opcion" options={CONCEPTOS} value={form.concepto} onChange={(e) => setField("concepto", e.target.value)} error={err("concepto")} />
        <TextField id="monto" label="Importe (EUR)" type="number" inputMode="decimal" min="0" step="0.01" value={form.monto} onChange={(e) => setField("monto", e.target.value)} error={err("monto")} />
        <TextField id="fecha" label="Fecha de la compra" type="date" max={todayRome()} value={form.fecha} onChange={(e) => setField("fecha", e.target.value)} error={err("fecha")} />
        <Select id="targa" label="Vehiculo (opcional)" options={targaOptions} value={form.targa} onChange={(e) => setField("targa", e.target.value)} error={err("targa")} />
      </div>
      <Textarea
        id="descripcion"
        label={form.concepto === "OTRO" ? "¿Que compraste?" : "Detalle (opcional)"}
        value={form.descripcion}
        onChange={(e) => setField("descripcion", e.target.value)}
        error={err("descripcion")}
        maxLength={300}
        placeholder="Ej. 2 litros de aceite 5W30"
      />
      <FileField
        id="comprobante"
        label="Foto del ticket (opcional)"
        hint="Imagen o PDF"
        camera
        file={comprobante}
        onChange={(f) => {
          setComprobante(f);
          if (f) setQuitar(false);
        }}
        existing={quitar ? null : gasto?.comprobante}
        error={err("comprobante")}
      />
      {gasto?.comprobante && !comprobante && !quitar && (
        <button type="button" onClick={() => setQuitar(true)} className="-mt-2 self-start text-[13px] font-medium text-danger-500 hover:underline">
          Quitar el ticket guardado
        </button>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" className="sm:w-auto sm:px-4" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="sm:w-auto sm:px-5" loading={submitting}>{gasto ? "Guardar" : "Enviar gasto"}</Button>
      </div>
    </form>
  );
};

const Fact = ({ label, children }) => (
  <div className="min-w-0">
    <span className="block text-[11px] uppercase tracking-wide text-ink-400">{label}</span>
    <span className="block text-[14px] font-medium text-ink-50">{children}</span>
  </div>
);

// Datos del gasto (los mismos para el chofer y para la oficina).
const Detalle = ({ g, showDriver }) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        {showDriver && g.driver && <p className="text-[15px] font-semibold text-ink-50">{g.driver.nombre} {g.driver.apellido}</p>}
        <p className="text-[14px] font-medium text-ink-50">{g.conceptoLabel}</p>
      </div>
      <EstadoChip estado={g.estado} />
    </div>
    {g.descripcion && <p className="whitespace-pre-wrap text-[14px] text-ink-200">{g.descripcion}</p>}
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
      <Fact label="Importe">{formatCurrency(g.monto)}</Fact>
      <Fact label="Fecha">{fechaTexto(g.fecha)}</Fact>
      <Fact label="Vehiculo">{g.vehiculo ? g.vehiculo.targa : "-"}</Fact>
    </div>
    {g.comprobante && (
      <a href={g.comprobante.url} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
        Ver {g.comprobante.esPdf ? "PDF" : "foto"} del ticket
      </a>
    )}
    {g.nota && (
      <p className={clsx("rounded-lg px-3 py-2 text-[13px]", g.estado === "RECHAZADO" ? "bg-danger-500/10 text-danger-500" : "bg-line/10 text-ink-200")}>
        {g.estado === "RECHAZADO" ? "Rechazado: " : "Nota: "}{g.nota}
      </p>
    )}
  </div>
);

// ---------------------------------------------------------------- chofer
const ChoferView = () => {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // null = cerrado, "new" o el gasto a corregir
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    // driverId: el Admin en modo chofer solo ve los suyos (para un chofer el servidor ya filtra igual).
    listOtrosGastosRequest({ driverId: user?.id, month })
      .then(setData)
      .catch((err) => setError(parseApiError(err).message));
  }, [user?.id, month]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const handleSubmit = async (fields, comprobante) => {
    setSaving(true);
    setSaveError("");
    setFieldErrors({});
    try {
      if (editing === "new") await createOtroGastoRequest(fields, comprobante);
      else await updateOtroGastoRequest(editing.id, fields, comprobante);
      setNotice("Enviado: la oficina lo va a revisar.");
      setEditing(null);
      load();
    } catch (err) {
      const parsed = parseApiError(err);
      setSaveError(parsed.message);
      setFieldErrors(parsed.fieldErrors ?? {});
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (g) => {
    try {
      await deleteOtroGastoRequest(g.id);
      load();
    } catch (err) {
      setError(parseApiError(err).message);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[14px] text-ink-300">
          Compras que hiciste para el vehiculo y que no son combustible ni peajes (aceite, liquido refrigerante, lavado...). Carga el importe y la foto del ticket; la oficina lo revisa y te lo reembolsa.
        </p>
        {!editing && (
          <Button className="sm:w-auto sm:px-5" onClick={() => { setNotice(""); setEditing("new"); }}>
            <PlusIcon className="h-4 w-4" /> Nuevo gasto
          </Button>
        )}
      </div>
      <Alert>{error}</Alert>
      {notice && <p className="rounded-xl bg-success-500/15 px-4 py-3 text-[14px] text-success-500">{notice}</p>}

      {editing && (
        <GlassCard>
          <h2 className="mb-4 text-[18px] font-semibold text-ink-50">{editing === "new" ? "Nuevo gasto" : "Corregir gasto"}</h2>
          <GastoForm
            gasto={editing === "new" ? null : editing}
            defaultTarga={user?.vehiculoAsignado?.targa ?? ""}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
            submitting={saving}
            error={saveError}
            fieldErrors={fieldErrors}
          />
        </GlassCard>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthSelector month={month} onChange={setMonth} />
        {data && data.items.length > 0 && (
          <p className="text-[13px] text-ink-300">
            Total del mes: <b className="text-ink-50">{formatCurrency(data.total)}</b>
          </p>
        )}
      </div>

      {!data && !error && <PageLoader />}
      {data?.items.length === 0 && !editing && <p className="px-1 py-6 text-[14px] text-ink-400">No cargaste ningun gasto en este mes.</p>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {data?.items.map((g) => (
          <GlassCard key={g.id}>
            <Detalle g={g} />
            {g.estado !== "REEMBOLSADO" && (
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button variant="ghost" className="sm:w-auto sm:px-4" onClick={() => { setNotice(""); setEditing(g); }}>
                  {g.estado === "RECHAZADO" ? "Corregir" : "Editar"}
                </Button>
                <Button variant="ghost" className="sm:w-auto sm:px-4" onClick={() => handleDelete(g)}>Borrar</Button>
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- oficina (Admin / Responsable)
const ReviewCard = ({ g, onDone }) => {
  const [rechazando, setRechazando] = useState(false);
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async (body) => {
    setBusy(true);
    setError("");
    try {
      await reviewOtroGastoRequest(g.id, body);
      onDone();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassCard>
      <Detalle g={g} showDriver />
      {g.estado === "PENDIENTE" && (
        <div className="mt-4 flex flex-col gap-3">
          <Alert>{error}</Alert>
          {rechazando ? (
            <div className="flex flex-col gap-3 rounded-xl bg-line/10 p-3">
              <Textarea id={`n-${g.id}`} label="Motivo del rechazo" value={nota} onChange={(e) => setNota(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" className="sm:w-auto sm:px-4" onClick={() => setRechazando(false)}>Cancelar</Button>
                <Button className="sm:w-auto sm:px-5" loading={busy} onClick={() => send({ accion: "RECHAZAR", nota })}>Rechazar</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" className="sm:w-auto sm:px-4" onClick={() => setRechazando(true)}>Rechazar</Button>
              <Button className="sm:w-auto sm:px-5" loading={busy} onClick={() => send({ accion: "REEMBOLSAR" })}>Marcar reembolsado</Button>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
};

const FILTERS = [
  { value: "PENDIENTE", label: "En revision" },
  { value: "REEMBOLSADO", label: "Reembolsados" },
  { value: "RECHAZADO", label: "Rechazados" },
];

const OficinaView = () => {
  const [estado, setEstado] = useState("PENDIENTE");
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    // Los pendientes se ven todos (sin importar el mes) para que ninguno quede olvidado.
    listOtrosGastosRequest({ estado, month: estado === "PENDIENTE" ? undefined : month })
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(parseApiError(err).message));
    return () => {
      cancelled = true;
    };
  }, [estado, month, version]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[14px] text-ink-300">
          Gastos que cargaron los choferes (aceite, liquido refrigerante, lavado...). Revisa el ticket y marca cada uno como reembolsado, o recházalo con el motivo.
        </p>
        <SegmentedControl options={FILTERS} value={estado} onChange={setEstado} />
      </div>
      {estado !== "PENDIENTE" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MonthSelector month={month} onChange={setMonth} />
          {data && data.items.length > 0 && <p className="text-[13px] text-ink-300">Total: <b className="text-ink-50">{formatCurrency(data.total)}</b></p>}
        </div>
      )}
      <Alert>{error}</Alert>
      {!data && !error && <PageLoader />}
      {data?.items.length === 0 && <p className="px-1 py-6 text-[14px] text-ink-400">No hay gastos en este estado.</p>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {data?.items.map((g) => (
          <ReviewCard key={`${g.id}-${g.estado}`} g={g} onDone={() => setVersion((v) => v + 1)} />
        ))}
      </div>
    </div>
  );
};

export const OtrosGastosPage = () => {
  const { user } = useAuth();
  const office = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  return office ? <OficinaView /> : <ChoferView />;
};
