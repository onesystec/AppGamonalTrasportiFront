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
  registerVehicleKmRequest,
} from "../../lib/vehicles.api";

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
  kmActual: vehicle?.kmActual ?? "",
});

export const MecanicaPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const [vehicles, setVehicles] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [areaFilter, setAreaFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState(null);

  const [form, setForm] = useState({ kmUltimoMantenimiento: "", kmActual: "" });
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

  useEffect(() => {
    setForm(toFormState(selectedVehicle));
    setSaveError("");
    setFieldErrors({});
    setSaveSuccess(false);
    if (selectedVehicle) {
      loadHistorial(selectedVehicle.id);
    } else {
      setHistorial(null);
      setHistorialError("");
    }
  }, [selectedVehicle]);

  if (!isPrivileged) return <Navigate to="/" replace />;

  const handleSelect = (id) => {
    setSelectedId(id);
  };

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const previewStatus = getTagliandoStatus(
    form.kmUltimoMantenimiento === "" ? null : Number(form.kmUltimoMantenimiento),
    form.kmActual === "" ? null : Number(form.kmActual)
  );

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    setSaving(true);
    setSaveError("");
    setFieldErrors({});
    setSaveSuccess(false);

    const payload = {};
    if (form.kmUltimoMantenimiento !== "") payload.kmUltimoMantenimiento = form.kmUltimoMantenimiento;
    if (form.kmActual !== "") payload.kmActual = form.kmActual;

    try {
      const updated = await registerVehicleKmRequest(selectedVehicle.id, payload);
      setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      setSaveSuccess(true);
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
                    label="KM Ultimo Mantenimiento"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={form.kmUltimoMantenimiento}
                    onChange={handleChange("kmUltimoMantenimiento")}
                    error={fieldErrors.kmUltimoMantenimiento?.[0]}
                  />
                  <TextField
                    id="kmActual"
                    label="KM Actual"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={form.kmActual}
                    onChange={handleChange("kmActual")}
                    error={fieldErrors.kmActual?.[0]}
                  />
                </div>

                <Button type="submit" loading={saving} className="sm:w-auto sm:px-8">
                  Guardar KM
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
                              Ultimo mantenimiento: {registro.kmUltimoMantenimiento.toLocaleString("es-AR")} km &middot;
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
