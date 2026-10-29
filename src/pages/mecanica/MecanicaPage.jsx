import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { GlassCard } from "../../components/ui/GlassCard";
import { PageLoader } from "../../components/ui/PageLoader";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Spinner } from "../../components/ui/Spinner";
import { TextField } from "../../components/ui/TextField";
import { useAuth } from "../../context/AuthContext";
import { getNotificationScopeRequest, vehicleInScope } from "../../lib/notifications.api";
import { parseApiError } from "../../lib/api";
import { TAGLIANDO_INTERVALO_KM, VEHICLE_AREA_OPTIONS, getTagliandoStatus } from "../../lib/constants";
import { formatDateTime } from "../../lib/format";
import {
  deleteVehicleMantenimientoRequest,
  listVehicleMantenimientosRequest,
  listVehiclesRequest,
  refreshVehicleKmGpsRequest,
  registerVehicleKmRequest,
} from "../../lib/vehicles.api";

const todayRome = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
const fechaTexto = (day) => (day ? day.split("-").reverse().join("/") : "");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const km = (value) => `${Math.round(value).toLocaleString("es-AR")} km`;

const AREA_FILTER_OPTIONS = [
  { value: "ALL", label: "Todas" },
  ...VEHICLE_AREA_OPTIONS.map((opt) => ({
    value: opt.value,
    label: opt.value === "DHL" ? "DHL - AB Service" : opt.label,
  })),
];

const STATUS_DOT_CLASSES = {
  ok: "bg-success-500",
  recordatorio: "bg-status-rischedulato",
  urgente: "bg-danger-500",
};

// Punto de color junto a cada vehiculo de la lista, para ver de un vistazo el estado
// de mantenimiento sin tener que abrir cada uno. Gris si todavia no se cargaron los KM.
const StatusDot = ({ status }) => (
  <span
    className={clsx(
      "h-2.5 w-2.5 shrink-0 rounded-full",
      status ? STATUS_DOT_CLASSES[status.level] : "bg-ink-400/40"
    )}
    aria-hidden="true"
  />
);

const TrashIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

const VehicleListItem = ({ vehicle, status, selected, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    className={clsx(
      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
      selected ? "bg-line/15" : "hover:bg-line/10"
    )}
  >
    <StatusDot status={status} />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[14px] font-medium text-ink-50">{vehicle.targa}</span>
      <span className="block truncate text-[12px] text-ink-400">{vehicle.modelo}</span>
    </span>
  </button>
);

const toFormState = (vehicle) => ({
  kmUltimoMantenimiento: vehicle?.kmUltimoMantenimiento ?? "",
  fechaUltimoMantenimiento: vehicle?.fechaUltimoMantenimiento ?? "",
  kmActual: vehicle?.kmActual ?? "",
});

// Los km actuales los cuenta solos el GPS cuando el vehiculo tiene el tagliando cargado con su fecha y esta en el GPS (OneSystec).
const cuentaConGps = (vehicle) => Boolean(vehicle?.fechaLecturaBase) && vehicle.kmGpsEstado !== "SIN_GPS";

export const MecanicaPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const [vehicles, setVehicles] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [areaFilter, setAreaFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState(null);

  const [form, setForm] = useState({ kmUltimoMantenimiento: "", fechaUltimoMantenimiento: "", kmActual: "" });
  // Conteo de km con el GPS del vehiculo elegido: { loading, estado, pendientes }, y si se esta corrigiendo el odometro a mano.
  const [gps, setGps] = useState({ loading: false, estado: null, pendientes: 0 });
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [historial, setHistorial] = useState(null);
  const [historialError, setHistorialError] = useState("");

  const [registroToDelete, setRegistroToDelete] = useState(null);
  const [deletingRegistro, setDeletingRegistro] = useState(false);
  const [deleteRegistroError, setDeleteRegistroError] = useState("");

  // Un Responsable solo ve (y recibe avisos de) los vehiculos de su asignacion; el Admin, todos.
  useEffect(() => {
    if (!isPrivileged) return;
    Promise.all([listVehiclesRequest(), getNotificationScopeRequest(user?.id).catch(() => ({ todo: true }))])
      .then(([list, scope]) => setVehicles(list.filter((v) => vehicleInScope(scope, v.id))))
      .catch((err) => setLoadError(parseApiError(err).message));
  }, [isPrivileged, user?.id]);

  const filteredVehicles = useMemo(() => {
    if (!vehicles) return [];
    if (areaFilter === "ALL") return vehicles;
    return vehicles.filter((v) => v.area === areaFilter);
  }, [vehicles, areaFilter]);

  const selectedVehicle = useMemo(
    () => vehicles?.find((v) => v.id === selectedId) ?? null,
    [vehicles, selectedId]
  );

  const loadHistorial = (vehicleId) => {
    setHistorial(null);
    setHistorialError("");
    listVehicleMantenimientosRequest(vehicleId)
      .then(setHistorial)
      .catch((err) => setHistorialError(parseApiError(err).message));
  };

  // Al elegir otro vehiculo se rearma el formulario (no cada vez que llegan km nuevos del GPS: se perderia lo que se esta escribiendo).
  useEffect(() => {
    setForm(toFormState(selectedVehicle));
    setSaveError("");
    setFieldErrors({});
    setSaveSuccess(false);
    setCorrigiendo(false);
    if (selectedVehicle) {
      loadHistorial(selectedVehicle.id);
    } else {
      setHistorial(null);
      setHistorialError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Cuenta los km del GPS del vehiculo elegido: al abrirlo (y despues de guardar el tagliando) se piden los dias que faltan y, mientras queden, se
  // vuelve a pedir cada pocos segundos hasta completar.
  const [gpsTick, setGpsTick] = useState(0);
  const hasBase = Boolean(selectedVehicle?.fechaLecturaBase);
  useEffect(() => {
    if (!selectedId || !hasBase) {
      setGps({ loading: false, estado: null, pendientes: 0 });
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setGps((prev) => ({ ...prev, loading: true }));
      for (let attempt = 0; attempt < 40 && !cancelled; attempt += 1) {
        try {
          const result = await refreshVehicleKmGpsRequest(selectedId);
          if (cancelled) return;
          setVehicles((prev) => prev.map((v) => (v.id === result.vehicle.id ? result.vehicle : v)));
          const incompleto = result.gps.pendientes > 0 || ["PENDIENTE", "ERROR", "OCUPADO"].includes(result.gps.estado);
          setGps({ loading: incompleto, estado: result.gps.estado, pendientes: result.gps.pendientes });
          if (!incompleto) return;
        } catch {
          if (cancelled) return;
          setGps({ loading: true, estado: "ERROR", pendientes: 0 });
        }
        await sleep(4000);
      }
      if (!cancelled) setGps((prev) => ({ ...prev, loading: false }));
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, hasBase, gpsTick]);

  if (!isPrivileged) return <Navigate to="/" replace />;

  const handleSelect = (id) => {
    setSelectedId(id);
  };

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const gpsMode = cuentaConGps(selectedVehicle);
  // Con el GPS contando, los km actuales son los del vehiculo (no se escriben); si se corrige el odometro, lo que se escribe.
  const kmActualParaEstado = gpsMode && !corrigiendo ? selectedVehicle?.kmActual ?? null : form.kmActual === "" ? null : Number(form.kmActual);
  const previewStatus = getTagliandoStatus(form.kmUltimoMantenimiento === "" ? null : Number(form.kmUltimoMantenimiento), kmActualParaEstado);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    setSaving(true);
    setSaveError("");
    setFieldErrors({});
    setSaveSuccess(false);

    const payload = {};
    if (form.kmUltimoMantenimiento !== "") payload.kmUltimoMantenimiento = form.kmUltimoMantenimiento;
    if (form.fechaUltimoMantenimiento !== "") payload.fechaUltimoMantenimiento = form.fechaUltimoMantenimiento;
    // Los km actuales solo se mandan a mano si no los cuenta el GPS (o si se esta corrigiendo el odometro).
    if ((!gpsMode || corrigiendo) && form.kmActual !== "") payload.kmActual = form.kmActual;

    try {
      const updated = await registerVehicleKmRequest(selectedVehicle.id, payload);
      setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      setForm(toFormState(updated));
      setCorrigiendo(false);
      setSaveSuccess(true);
      setGpsTick((n) => n + 1);
      loadHistorial(selectedVehicle.id);
    } catch (err) {
      const parsed = parseApiError(err);
      setSaveError(parsed.message);
      setFieldErrors(parsed.fieldErrors || {});
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRegistro = async () => {
    if (!selectedVehicle || !registroToDelete) return;

    setDeletingRegistro(true);
    setDeleteRegistroError("");

    try {
      await deleteVehicleMantenimientoRequest(selectedVehicle.id, registroToDelete.id);
      setHistorial((prev) => prev?.filter((r) => r.id !== registroToDelete.id) ?? prev);
      setRegistroToDelete(null);
    } catch (err) {
      setDeleteRegistroError(parseApiError(err).message);
    } finally {
      setDeletingRegistro(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[24px] font-semibold text-ink-50">Mecanica</h1>
        <p className="mt-1 text-[14px] text-ink-300">
          Seguimiento de Tagliando de la flota (intervalo de {TAGLIANDO_INTERVALO_KM.toLocaleString("es-AR")} km).
        </p>
      </div>

      <Alert>{loadError}</Alert>

      {vehicles === null && !loadError && <PageLoader />}

      {vehicles !== null && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
          <GlassCard className="!p-5">
            <SegmentedControl
              options={AREA_FILTER_OPTIONS}
              value={areaFilter}
              onChange={setAreaFilter}
              className="w-full flex-wrap justify-center"
            />

            <div className="mt-4 flex flex-col gap-1">
              {filteredVehicles.length === 0 && (
                <p className="py-6 text-center text-[13px] text-ink-400">
                  No hay vehiculos en esta area.
                </p>
              )}
              {filteredVehicles.map((vehicle) => (
                <VehicleListItem
                  key={vehicle.id}
                  vehicle={vehicle}
                  status={getTagliandoStatus(vehicle.kmUltimoMantenimiento, vehicle.kmActual)}
                  selected={vehicle.id === selectedId}
                  onSelect={() => handleSelect(vehicle.id)}
                />
              ))}
            </div>
          </GlassCard>

          <GlassCard className="!p-6 sm:!p-8">
            {!selectedVehicle ? (
              <p className="py-16 text-center text-[14px] text-ink-300">
                Elegi un vehiculo de la lista para cargar sus KM.
              </p>
            ) : (
              <form className="flex flex-col gap-5" onSubmit={handleSave}>
                <div>
                  <span className="block text-[12px] uppercase tracking-wide text-ink-400">
                    Vehiculo seleccionado
                  </span>
                  <span className="block text-[18px] font-semibold text-ink-50">
                    {selectedVehicle.targa} &middot; {selectedVehicle.modelo}
                  </span>
                </div>

                {saveSuccess && <Alert variant="success">Cambios guardados correctamente.</Alert>}
                <Alert>{saveError}</Alert>

                {previewStatus?.level === "urgente" && (
                  <Alert variant="error">
                    Aviso urgente: este vehiculo lleva {previewStatus.usado.toLocaleString("es-AR")} km desde el
                    ultimo mantenimiento. Debe ir al Tagliando cuanto antes.
                  </Alert>
                )}
                {previewStatus?.level === "recordatorio" && (
                  <Alert variant="warning">
                    Recordatorio: quedan {previewStatus.restante.toLocaleString("es-AR")} km para el Tagliando.
                    Conviene ir pidiendo los repuestos.
                  </Alert>
                )}
                {previewStatus?.level === "ok" && (
                  <Alert variant="success">
                    Vehiculo al dia: quedan {previewStatus.restante.toLocaleString("es-AR")} km para el Tagliando.
                  </Alert>
                )}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <TextField
                    id="kmUltimoMantenimiento"
                    label="KM del ultimo tagliando"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={form.kmUltimoMantenimiento}
                    onChange={handleChange("kmUltimoMantenimiento")}
                    error={fieldErrors.kmUltimoMantenimiento?.[0]}
                  />
                  <TextField
                    id="fechaUltimoMantenimiento"
                    label="Fecha del ultimo tagliando"
                    type="date"
                    max={todayRome()}
                    value={form.fechaUltimoMantenimiento}
                    onChange={handleChange("fechaUltimoMantenimiento")}
                    error={fieldErrors.fechaUltimoMantenimiento?.[0]}
                  />
                </div>

                {gpsMode && !corrigiendo ? (
                  <div className="rounded-2xl border border-line/10 bg-line/[0.04] px-4 py-3.5">
                    <span className="block text-[12px] uppercase tracking-wide text-ink-400">KM actual (contados con el GPS)</span>
                    <span className="block text-[28px] font-semibold leading-tight text-ink-50">
                      {selectedVehicle.kmActual != null ? km(selectedVehicle.kmActual) : "-"}
                    </span>
                    <span className="block text-[13px] text-ink-300">
                      {selectedVehicle.kmLecturaBase != null && selectedVehicle.kmActual != null
                        ? `+${km(selectedVehicle.kmActual - selectedVehicle.kmLecturaBase)} desde el ${fechaTexto(selectedVehicle.fechaLecturaBase)} (partiendo de ${km(selectedVehicle.kmLecturaBase)})`
                        : ""}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-400">
                      {gps.loading ? (
                        <span className="flex items-center gap-1.5 text-warning-500">
                          <Spinner className="h-3.5 w-3.5 border-warning-500/30 border-t-warning-500" />
                          {gps.estado === "ERROR"
                            ? "El GPS no respondio; se reintenta solo"
                            : `Contando los km del GPS${gps.pendientes > 0 ? ` (faltan ${gps.pendientes} ${gps.pendientes === 1 ? "dia" : "dias"})` : ""}...`}
                        </span>
                      ) : selectedVehicle.kmGpsActualizadoAt ? (
                        <span>Actualizado {formatDateTime(selectedVehicle.kmGpsActualizadoAt)}</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setCorrigiendo(true);
                          setForm((prev) => ({ ...prev, kmActual: selectedVehicle.kmActual ?? "" }));
                        }}
                        className="font-medium text-accent-400 hover:text-accent-300"
                      >
                        Corregir con el odometro
                      </button>
                    </span>
                  </div>
                ) : (
                  <div>
                    <TextField
                      id="kmActual"
                      label={corrigiendo ? "KM actual del odometro (desde hoy el GPS cuenta a partir de aqui)" : "KM actual"}
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={form.kmActual}
                      onChange={handleChange("kmActual")}
                      error={fieldErrors.kmActual?.[0]}
                    />
                    {corrigiendo && (
                      <button type="button" onClick={() => setCorrigiendo(false)} className="mt-1.5 text-[12px] font-medium text-accent-400 hover:text-accent-300">
                        Cancelar la correccion
                      </button>
                    )}
                    {!corrigiendo && selectedVehicle.kmGpsEstado === "SIN_GPS" && (
                      <p className="mt-1.5 text-[12px] text-ink-400">Este vehiculo no esta en el GPS: los km actuales se cargan a mano.</p>
                    )}
                    {!corrigiendo && selectedVehicle.kmGpsEstado !== "SIN_GPS" && !selectedVehicle.fechaLecturaBase && (
                      <p className="mt-1.5 text-[12px] text-ink-400">
                        Pon los km y la fecha del ultimo tagliando y el GPS contara los km actuales solo, desde el dia siguiente.
                      </p>
                    )}
                  </div>
                )}

                <Button type="submit" loading={saving} className="sm:w-auto sm:px-8">
                  {corrigiendo ? "Guardar correccion" : "Guardar tagliando"}
                </Button>

                <div className="border-t border-line/10 pt-5">
                  <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-ink-400">
                    Historial de cargas
                  </h3>

                  <Alert>{historialError}</Alert>

                  {historial === null && !historialError && (
                    <div className="flex justify-center py-6">
                      <Spinner className="h-5 w-5 border-line/20 border-t-line" />
                    </div>
                  )}

                  {historial?.length === 0 && (
                    <p className="text-[13px] text-ink-400">Todavia no hay cargas registradas.</p>
                  )}

                  {historial?.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {historial.map((registro) => (
                        <div
                          key={registro.id}
                          className="flex flex-wrap items-center justify-between gap-2 glass-surface-sm rounded-xl px-4 py-2.5 text-[13px]"
                        >
                          <span className="min-w-0">
                            <span className="block text-ink-50">
                              Ultimo mantenimiento: {registro.kmUltimoMantenimiento.toLocaleString("es-AR")} km
                              {registro.fechaMantenimiento ? ` (${fechaTexto(registro.fechaMantenimiento)})` : ""} &middot;
                              {" "}Actual: {registro.kmActual.toLocaleString("es-AR")} km
                            </span>
                            <span className="block text-ink-400">
                              {formatDateTime(registro.createdAt)}
                              {registro.usuario ? ` · ${registro.usuario}` : ""}
                            </span>
                          </span>
                          <button
                            type="button"
                            aria-label="Eliminar registro"
                            title="Eliminar registro"
                            onClick={() => {
                              setDeleteRegistroError("");
                              setRegistroToDelete(registro);
                            }}
                            className="shrink-0 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-danger-500/10 hover:text-danger-500"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            )}
          </GlassCard>
        </div>
      )}

      <ConfirmModal
        open={Boolean(registroToDelete)}
        title="Eliminar registro de mantenimiento"
        description="Esta accion no se puede deshacer. El registro se va a borrar del historial."
        confirmLabel="Eliminar"
        error={deleteRegistroError}
        loading={deletingRegistro}
        onConfirm={handleDeleteRegistro}
        onCancel={() => setRegistroToDelete(null)}
      />
    </div>
  );
};
