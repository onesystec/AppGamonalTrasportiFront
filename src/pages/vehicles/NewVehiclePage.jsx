import { BackLink } from "../../components/ui/BackLink";
import { useState } from "react";
import { CATEGORIA_VEHICULO_OPTIONS } from "../../lib/vehiculos";
import { Navigate, useNavigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { SlideOverPanel } from "../../components/ui/SlideOverPanel";
import { Switch } from "../../components/ui/Switch";
import { TextField } from "../../components/ui/TextField";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { GRUPO_OPTIONS, VEHICLE_AREA_OPTIONS, VEHICLE_STATUS_OPTIONS } from "../../lib/constants";
import { createVehicleRequest } from "../../lib/vehicles.api";

const INITIAL_FORM = {
  targa: "",
  modelo: "",
  area: "",
  grupo: "",
  estado: "DISPONIBLE",
  categoria: "",
  poliza: "",
  rTecnica: "",
  autorizadoAreaC: false,
  mostrarEnMapa: true,
};

const FILE_FIELDS = [
  { name: "imagen", label: "Foto del vehiculo", accept: "image/jpeg,image/png,image/webp" },
  { name: "libreto", label: "Libreto (PDF)", accept: "application/pdf" },
  { name: "assicurazione", label: "Assicurazione (PDF)", accept: "application/pdf" },
];

export const NewVehiclePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN" || user?.cargo === "RRHH";
  const { refresh: refreshVehicles } = useDataRefresh("vehicles");

  const [form, setForm] = useState(INITIAL_FORM);
  const [files, setFiles] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleFileChange = (field) => (e) =>
    setFiles((prev) => ({ ...prev, [field]: e.target.files?.[0] ?? null }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    setFieldErrors({});

    const formData = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value !== "") formData.append(key, value);
    });
    Object.entries(files).forEach(([key, file]) => {
      if (file) formData.append(key, file);
    });

    try {
      const vehicle = await createVehicleRequest(formData);
      refreshVehicles();
      navigate(`/vehiculos`, { replace: true, state: { createdTarga: vehicle.targa } });
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.message);
      setFieldErrors(parsed.fieldErrors || {});
    } finally {
      setSubmitting(false);
    }
  };

  if (!isPrivileged) return <Navigate to="/" replace />;

  return (
    <SlideOverPanel closeTo="/vehiculos">
    <div className="flex flex-col gap-6">
      <div>
        <BackLink to="/vehiculos" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
          &larr; Vehiculos
        </BackLink>
      </div>

      <div>
        <h1 className="text-[24px] font-semibold text-ink-50">Nuevo vehiculo</h1>
        <p className="mt-1 text-[14px] text-ink-300">Completa los datos de la unidad.</p>
      </div>

      <GlassCard>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <Alert>{formError}</Alert>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField
              id="targa"
              label="Targa"
              placeholder="Ej: FM342HY"
              value={form.targa}
              onChange={handleChange("targa")}
              error={fieldErrors.targa?.[0]}
              required
            />
            <TextField
              id="modelo"
              label="Modelo"
              placeholder="Ej: Iveco Daily"
              value={form.modelo}
              onChange={handleChange("modelo")}
              error={fieldErrors.modelo?.[0]}
              required
            />
            <SearchableSelect
              id="area"
              label="Area"
              placeholder="Escribe para buscar un area"
              options={VEHICLE_AREA_OPTIONS}
              value={form.area}
              onChange={(v) => setField("area", v)}
              error={fieldErrors.area?.[0]}
            />
            <SearchableSelect
              id="grupo"
              label="Grupo"
              placeholder="Escribe para buscar un grupo"
              options={GRUPO_OPTIONS}
              value={form.grupo}
              onChange={(v) => setField("grupo", v)}
              error={fieldErrors.grupo?.[0]}
            />
            <SearchableSelect
              id="estado"
              label="Estado"
              placeholder="Escribe para buscar un estado"
              options={VEHICLE_STATUS_OPTIONS}
              value={form.estado}
              onChange={(v) => setField("estado", v)}
              error={fieldErrors.estado?.[0]}
            />
            <SearchableSelect
              id="categoria"
              label="Categoria de consumo (para estimar carburante)"
              placeholder="Elige la categoria del vehiculo"
              options={CATEGORIA_VEHICULO_OPTIONS}
              value={form.categoria}
              onChange={(v) => setField("categoria", v)}
              error={fieldErrors.categoria?.[0]}
            />
            <TextField
              id="poliza"
              label="Vencimiento poliza"
              type="date"
              value={form.poliza}
              onChange={handleChange("poliza")}
              error={fieldErrors.poliza?.[0]}
            />
            <TextField
              id="rTecnica"
              label="Vencimiento revision tecnica"
              type="date"
              value={form.rTecnica}
              onChange={handleChange("rTecnica")}
              error={fieldErrors.rTecnica?.[0]}
            />
          </div>

          <label className="flex w-fit cursor-pointer items-center gap-2 text-[13px] text-ink-200">
            <input
              type="checkbox"
              checked={form.autorizadoAreaC}
              onChange={(e) => setField("autorizadoAreaC", e.target.checked)}
              className="h-3.5 w-3.5 accent-accent-500"
            />
            Autorizado para circular en Area C (permiso ZTL de Milano)
          </label>

          <Switch
            id="mostrarEnMapa"
            label="Mostrar en el mapa"
            description="Si está apagado, este vehículo no aparece en el Mapa."
            checked={form.mostrarEnMapa}
            onChange={(value) => setField("mostrarEnMapa", value)}
          />

          <div className="border-t border-line/10 pt-5">
            <h3 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-ink-400">
              Documentos (opcional)
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {FILE_FIELDS.map(({ name, label, accept }) => (
                <label
                  key={name}
                  className="flex cursor-pointer flex-col gap-1 rounded-xl glass-input px-4 py-3 text-[13px] text-ink-50 hover:bg-line/10"
                >
                  <span className="font-medium">{label}</span>
                  <span className="truncate text-ink-400">
                    {files[name]?.name ?? "Ningun archivo"}
                  </span>
                  <input
                    type="file"
                    accept={accept}
                    className="hidden"
                    onChange={handleFileChange(name)}
                  />
                </label>
              ))}
            </div>
          </div>

          <Button type="submit" loading={submitting} className="sm:w-auto sm:px-8">
            Crear vehiculo
          </Button>
        </form>
      </GlassCard>
    </div>
    </SlideOverPanel>
  );
};
