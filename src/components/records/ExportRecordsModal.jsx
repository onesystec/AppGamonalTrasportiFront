import { useEffect, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { SearchableSelect } from "../ui/SearchableSelect";
import { TextField } from "../ui/TextField";
import { RECORD_STATUS_OPTIONS, ZONA_OPTIONS } from "../../lib/constants";
import { parseApiError } from "../../lib/api";
import { listClientsRequest } from "../../lib/clients.api";
import { exportFullRecordsRequest } from "../../lib/records.api";
import { listUsersRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";
import { buildFullCsv, downloadCsv } from "../../lib/csv";

const SECCION_OPTIONS = [
  { value: "EXTRA_PIAZZA", label: "Extras Piazza" },
  { value: "DHL", label: "DHL" },
  { value: "AB_SERVICE", label: "AB Service" },
  { value: "EXTRAS_STEFANIA", label: "Extras Stefania" },
];

const INITIAL_FORM = {
  from: "",
  to: "",
  fromTime: "",
  toTime: "",
  driverId: "",
  clientId: "",
  vehicleId: "",
  secciones: [],
  zonas: [],
  estados: [],
};

// Grupo de checkboxes generico (Seccion/Zona/Estado) - ninguno marcado = sin filtro
// (se exporta cualquier valor), igual que el resto de los filtros vacios del modal.
const CheckboxGroup = ({ label, options, values, onToggle }) => (
  <div>
    <span className="mb-1.5 block text-[13px] font-medium text-ink-300">{label}</span>
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {options.map((opt) => (
        <label key={opt.value} className="flex cursor-pointer items-center gap-1.5 text-[13px] text-ink-100">
          <input
            type="checkbox"
            checked={values.includes(opt.value)}
            onChange={() => onToggle(opt.value)}
            className="h-4 w-4 rounded border-line/20 bg-transparent accent-accent-500"
          />
          {opt.label}
        </label>
      ))}
    </div>
  </div>
);

// Modal de export CSV de Registros (boton al lado de sincronizar) - todos los filtros
// son opcionales, sin ninguno exporta el historico completo. Mismo esqueleto visual
// que AsignarServicioFuturoModal.jsx (backdrop + card centrada).
export const ExportRecordsModal = ({ open, onClose }) => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [drivers, setDrivers] = useState(null);
  const [clients, setClients] = useState(null);
  const [vehicles, setVehicles] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(INITIAL_FORM);
    setExportError("");
    Promise.all([listUsersRequest(), listClientsRequest(), listVehiclesRequest()])
      .then(([usersData, clientsData, vehiclesData]) => {
        setDrivers(usersData.filter((u) => u.cargo === "CHOFER"));
        setClients(clientsData);
        setVehicles(vehiclesData);
      })
      .catch(() => setLoadError("No se pudieron cargar los filtros. Reintenta."));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !exporting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, exporting, onClose]);

  if (!open) return null;

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const toggleInList = (field) => (value) =>
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value) ? prev[field].filter((v) => v !== value) : [...prev[field], value],
    }));

  const loaded = drivers && clients && vehicles;

  const handleExport = async (e) => {
    e.preventDefault();
    setExporting(true);
    setExportError("");

    const filters = {
      from: form.from || undefined,
      to: form.to || undefined,
      fromTime: form.fromTime || undefined,
      toTime: form.toTime || undefined,
      driverId: form.driverId || undefined,
      clientId: form.clientId || undefined,
      vehicleId: form.vehicleId || undefined,
      secciones: form.secciones.length ? form.secciones.join(",") : undefined,
      zonas: form.zonas.length ? form.zonas.join(",") : undefined,
      estados: form.estados.length ? form.estados.join(",") : undefined,
    };

    try {
      const csv = await exportFullRecordsRequest(filters);
      if (csv.filas.length === 0) {
        setExportError("No hay registros que coincidan con esos filtros.");
        return;
      }
      const rango = form.from || form.to ? `_${form.from || "inicio"}_a_${form.to || "hoy"}` : "";
      downloadCsv(`registros${rango}.csv`, buildFullCsv(csv));
      onClose();
    } catch (err) {
      // parseApiError trae "details" (fieldErrors) ademas del message generico - sin
      // esto un 400 de validacion solo mostraba "Datos invalidos" sin decir cual campo,
      // imposible de diagnosticar desde la UI.
      const parsed = parseApiError(err);
      const detail = parsed.fieldErrors
        ? Object.entries(parsed.fieldErrors)
            .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
            .join(" | ")
        : null;
      setExportError(detail ? `${parsed.message} (${detail})` : parsed.message);
    } finally {
      setExporting(false);
    }
  };

  const driverOptions = (drivers ?? []).map((d) => ({ value: d.id, label: `${d.nombre} ${d.apellido}` }));
  const clientOptions = (clients ?? []).map((c) => ({ value: c.id, label: c.nombre }));
  const vehicleOptions = (vehicles ?? []).map((v) => ({ value: v.id, label: `${v.targa} - ${v.modelo}` }));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => !exporting && onClose()}
        className="absolute inset-0 bg-backdrop backdrop-blur-sm"
      />

      <div className="glass-surface relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-background p-6">
        <h2 className="text-[17px] font-semibold text-ink-50">Exportar registros a CSV</h2>
        <p className="mt-2 text-[14px] text-ink-300">
          Todos los filtros son opcionales. Sin ninguno, se exporta el historico completo.
        </p>

        <Alert>{loadError}</Alert>
        <Alert>{exportError}</Alert>

        {!loaded && !loadError ? (
          <p className="mt-6 text-[13px] text-ink-300">Cargando filtros...</p>
        ) : (
          <form onSubmit={handleExport} className="mt-4 flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                id="export-from"
                label="Fecha desde"
                type="date"
                value={form.from}
                onChange={(e) => setField("from", e.target.value)}
              />
              <TextField
                id="export-to"
                label="Fecha hasta"
                type="date"
                value={form.to}
                onChange={(e) => setField("to", e.target.value)}
              />
              <TextField
                id="export-fromTime"
                label="Hora desde (ETA)"
                type="time"
                value={form.fromTime}
                onChange={(e) => setField("fromTime", e.target.value)}
              />
              <TextField
                id="export-toTime"
                label="Hora hasta (ETA)"
                type="time"
                value={form.toTime}
                onChange={(e) => setField("toTime", e.target.value)}
              />
            </div>

            <SearchableSelect
              id="export-driver"
              label="Chofer (opcional)"
              placeholder="Escribe para buscar un chofer"
              options={driverOptions}
              value={form.driverId}
              onChange={(v) => setField("driverId", v)}
            />

            <SearchableSelect
              id="export-client"
              label="Cliente (opcional)"
              placeholder="Escribe para buscar un cliente"
              options={clientOptions}
              value={form.clientId}
              onChange={(v) => setField("clientId", v)}
            />

            <SearchableSelect
              id="export-vehicle"
              label="Vehiculo (opcional)"
              placeholder="Escribe para buscar un vehiculo"
              options={vehicleOptions}
              value={form.vehicleId}
              onChange={(v) => setField("vehicleId", v)}
            />

            <CheckboxGroup
              label="Seccion"
              options={SECCION_OPTIONS}
              values={form.secciones}
              onToggle={toggleInList("secciones")}
            />
            <CheckboxGroup label="Zona" options={ZONA_OPTIONS} values={form.zonas} onToggle={toggleInList("zonas")} />
            <CheckboxGroup
              label="Estado"
              options={RECORD_STATUS_OPTIONS}
              values={form.estados}
              onToggle={toggleInList("estados")}
            />

            <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" className="sm:w-auto sm:px-6" disabled={exporting} onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" className="sm:w-auto sm:px-6" loading={exporting}>
                Descargar CSV
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
