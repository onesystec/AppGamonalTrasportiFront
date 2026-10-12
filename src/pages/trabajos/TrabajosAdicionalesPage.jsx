import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { PageLoader } from "../../components/ui/PageLoader";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { TextField } from "../../components/ui/TextField";
import { Textarea } from "../../components/ui/Textarea";
import { PlusIcon } from "../../components/ui/icons";
import { TrabajoAdicionalForm } from "../../components/trabajos/TrabajoAdicionalForm";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { formatRomeDateTime, toRomeDateTimeInputValue } from "../../lib/format";
import { formatHours } from "../../lib/horas";
import {
  createTrabajoAdicionalRequest,
  deleteTrabajoAdicionalRequest,
  listTrabajosAdicionalesRequest,
  reviewTrabajoAdicionalRequest,
  updateTrabajoAdicionalRequest,
} from "../../lib/trabajosAdicionales.api";

const ESTADO = {
  PENDIENTE: { label: "En revision", tone: "bg-warning-500/20 text-warning-500" },
  APROBADO: { label: "Aprobado", tone: "bg-success-500/15 text-success-500" },
  DEVUELTO: { label: "Devuelto", tone: "bg-danger-500/15 text-danger-500" },
};

const EstadoChip = ({ estado }) => (
  <span className={clsx("inline-flex rounded-full px-2.5 py-1 text-[12px] font-medium", ESTADO[estado].tone)}>{ESTADO[estado].label}</span>
);

const Fact = ({ label, children }) => (
  <div className="min-w-0">
    <span className="block text-[11px] uppercase tracking-wide text-ink-400">{label}</span>
    <span className="block text-[14px] font-medium text-ink-50">{children}</span>
  </div>
);

// Datos del trabajo (los mismos para el chofer y para quien revisa).
const Detalle = ({ t, showDriver }) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        {showDriver && t.driver && <p className="text-[15px] font-semibold text-ink-50">{t.driver.nombre} {t.driver.apellido}</p>}
        <p className="text-[14px] font-medium text-ink-50">{t.areaLabel}</p>
      </div>
      <EstadoChip estado={t.estado} />
    </div>
    <p className="whitespace-pre-wrap text-[14px] text-ink-200">{t.descripcion}</p>
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
      <Fact label="Inicio">{formatRomeDateTime(t.inicio)}</Fact>
      <Fact label="Fin">{formatRomeDateTime(t.fin)}</Fact>
      <Fact label="Horas">
        {formatHours(t.horas)}
        <span className="block text-[12px] font-normal text-ink-400">dia {formatHours(t.horasDia)} - noche {formatHours(t.horasNoche)}</span>
      </Fact>
      {t.pausaMin > 0 && <Fact label="Pausa">{t.pausaMin} min</Fact>}
      <Fact label="Vehiculo">{t.sinVehiculo ? "Sin vehiculo" : `${t.targa}${t.km != null ? ` - ${t.km} km` : ""}`}</Fact>
      {t.solicitadoPor && <Fact label="Lo pidio">{t.solicitadoPor}</Fact>}
      <Fact label="Cargado el">{formatRomeDateTime(t.creadoAt)}</Fact>
    </div>
    {t.ajustado && (
      <p className="text-[12px] text-ink-400">
        El chofer declaro {formatRomeDateTime(t.inicioDeclarado)} a {formatRomeDateTime(t.finDeclarado)}; se ajusto al revisar.
      </p>
    )}
    {t.foto && (
      <a href={t.foto.url} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
        Ver {t.foto.esPdf ? "PDF" : "foto"} adjunta
      </a>
    )}
    {t.avisos?.map((a) => (
      <p key={a} className="rounded-lg bg-warning-500/15 px-3 py-2 text-[12px] text-warning-500">{a}</p>
    ))}
    {t.nota && (
      <p className={clsx("rounded-lg px-3 py-2 text-[13px]", t.estado === "DEVUELTO" ? "bg-danger-500/10 text-danger-500" : "bg-line/10 text-ink-200")}>
        {t.estado === "DEVUELTO" ? "Devuelto: " : "Nota del responsable: "}{t.nota}
      </p>
    )}
  </div>
);

// ---------------------------------------------------------------- chofer
const ChoferView = () => {
  const { user } = useAuth();
  const { refresh } = useDataRefresh();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // null = cerrado, "new" o el trabajo a corregir
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    listTrabajosAdicionalesRequest()
      .then((d) => setItems(d.items))
      .catch((err) => setError(parseApiError(err).message));
  }, []);
  useEffect(load, [load]);

  const handleSubmit = async (fields, foto) => {
    setSaving(true);
    setSaveError("");
    setFieldErrors({});
    try {
      const saved = editing === "new" ? await createTrabajoAdicionalRequest(fields, foto) : await updateTrabajoAdicionalRequest(editing.id, fields, foto);
      setNotice(saved.avisos?.length ? `Enviado. ${saved.avisos.join(" ")}` : "Enviado: tu responsable lo va a revisar.");
      setEditing(null);
      load();
      refresh?.();
    } catch (err) {
      const parsed = parseApiError(err);
      setSaveError(parsed.message);
      setFieldErrors(parsed.fieldErrors ?? {});
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t) => {
    try {
      await deleteTrabajoAdicionalRequest(t.id);
      load();
    } catch (err) {
      setError(parseApiError(err).message);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[14px] text-ink-300">
          Tareas que hiciste fuera de tus servicios (por ejemplo en Farmacia). Tu responsable las revisa y, cuando las aprueba, cuentan en tus horas.
        </p>
        {!editing && (
          <Button className="sm:w-auto sm:px-5" onClick={() => { setNotice(""); setEditing("new"); }}>
            <PlusIcon className="h-4 w-4" /> Nuevo trabajo adicional
          </Button>
        )}
      </div>
      <Alert>{error}</Alert>
      {notice && <p className="rounded-xl bg-success-500/15 px-4 py-3 text-[14px] text-success-500">{notice}</p>}

      {editing && (
        <GlassCard>
          <h2 className="mb-4 text-[18px] font-semibold text-ink-50">{editing === "new" ? "Nuevo trabajo adicional" : "Corregir trabajo adicional"}</h2>
          <TrabajoAdicionalForm
            trabajo={editing === "new" ? null : editing}
            defaultTarga={user?.vehiculoAsignado?.targa ?? ""}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
            submitting={saving}
            error={saveError}
            fieldErrors={fieldErrors}
          />
        </GlassCard>
      )}

      {!items && !error && <PageLoader />}
      {items?.length === 0 && !editing && <p className="px-1 py-6 text-[14px] text-ink-400">Todavia no cargaste ningun trabajo adicional.</p>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {items?.map((t) => (
          <GlassCard key={t.id}>
            <Detalle t={t} />
            {t.estado !== "APROBADO" && (
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button variant="ghost" className="sm:w-auto sm:px-4" onClick={() => { setNotice(""); setEditing(t); }}>
                  {t.estado === "DEVUELTO" ? "Corregir" : "Editar"}
                </Button>
                <Button variant="ghost" className="sm:w-auto sm:px-4" onClick={() => handleDelete(t)}>Borrar</Button>
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- responsable / admin
const ReviewCard = ({ t, onDone }) => {
  const [mode, setMode] = useState(null); // null | "ajustar" | "devolver"
  const [nota, setNota] = useState("");
  const [inicio, setInicio] = useState(toRomeDateTimeInputValue(t.inicio));
  const [fin, setFin] = useState(toRomeDateTimeInputValue(t.fin));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async (body) => {
    setBusy(true);
    setError("");
    try {
      await reviewTrabajoAdicionalRequest(t.id, body);
      onDone();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassCard>
      <Detalle t={t} showDriver />
      {t.estado === "PENDIENTE" ? (
        <div className="mt-4 flex flex-col gap-3">
          <Alert>{error}</Alert>
          {mode && (
            <div className="flex flex-col gap-3 rounded-xl bg-line/10 p-3">
              {mode === "ajustar" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField id={`i-${t.id}`} label="Inicio" type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} />
                  <TextField id={`f-${t.id}`} label="Fin" type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} />
                </div>
              )}
              <Textarea id={`n-${t.id}`} label={mode === "devolver" ? "¿Que debe corregir?" : "Motivo del ajuste"} value={nota} onChange={(e) => setNota(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" className="sm:w-auto sm:px-4" onClick={() => setMode(null)}>Cancelar</Button>
                <Button
                  className="sm:w-auto sm:px-5"
                  loading={busy}
                  onClick={() => (mode === "devolver" ? send({ accion: "DEVOLVER", nota }) : send({ accion: "APROBAR", nota, inicio, fin }))}
                >
                  {mode === "devolver" ? "Devolver" : "Aprobar con ajuste"}
                </Button>
              </div>
            </div>
          )}
          {!mode && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" className="sm:w-auto sm:px-4" onClick={() => setMode("devolver")}>Devolver</Button>
              <Button variant="ghost" className="sm:w-auto sm:px-4" onClick={() => setMode("ajustar")}>Ajustar tiempos</Button>
              <Button className="sm:w-auto sm:px-5" loading={busy} onClick={() => send({ accion: "APROBAR" })}>Aprobar</Button>
            </div>
          )}
        </div>
      ) : null}
    </GlassCard>
  );
};

const FILTERS = [
  { value: "PENDIENTE", label: "En revision" },
  { value: "DEVUELTO", label: "Devueltos" },
  { value: "APROBADO", label: "Aprobados" },
];

const OficinaView = () => {
  const [estado, setEstado] = useState("PENDIENTE");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    listTrabajosAdicionalesRequest({ estado })
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(parseApiError(err).message));
    return () => {
      cancelled = true;
    };
  }, [estado, version]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[14px] text-ink-300">
          Tareas fuera de servicio que cargaron los choferes. Solo las aprobadas cuentan en sus horas y en su paga.
        </p>
        <SegmentedControl options={FILTERS} value={estado} onChange={setEstado} />
      </div>
      <Alert>{error}</Alert>
      {!data && !error && <PageLoader />}
      {data?.items.length === 0 && <p className="px-1 py-6 text-[14px] text-ink-400">No hay trabajos adicionales en este estado.</p>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {data?.items.map((t) => (
          <ReviewCard key={`${t.id}-${t.estado}`} t={t} onDone={() => setVersion((v) => v + 1)} />
        ))}
      </div>
    </div>
  );
};

export const TrabajosAdicionalesPage = () => {
  const { user } = useAuth();
  const office = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[28px] font-semibold leading-tight text-ink-50">Trabajos adicionales</h1>
      {office ? <OficinaView /> : <ChoferView />}
    </div>
  );
};
