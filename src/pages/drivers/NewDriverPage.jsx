import { BackLink } from "../../components/ui/BackLink";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { PasswordField } from "../../components/ui/PasswordField";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { SlideOverPanel } from "../../components/ui/SlideOverPanel";
import { TextField } from "../../components/ui/TextField";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { AREA_OPTIONS, GRUPO_OPTIONS } from "../../lib/constants";
import { createUserRequest } from "../../lib/users.api";
import { APP_URL, enlaceWhatsapp, mensajeCuenta } from "../../lib/cuentaWhatsapp";

const INITIAL_FORM = {
  nombre: "",
  apellido: "",
  correoElectronico: "",
  password: "",
  numeroCelular: "",
  area: "",
  grupo: "",
  fechaNacimiento: "",
};

export const NewDriverPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Las cuentas las crea solo el Admin (el backend tambien lo exige).
  const isAdmin = user?.cargo === "OWNER";
  const { refresh: refreshDrivers } = useDataRefresh("drivers");

  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  // Cuenta recien creada: se muestra con el boton para mandarle el acceso por WhatsApp.
  const [creado, setCreado] = useState(null);

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    setFieldErrors({});

    try {
      // grupo es opcional en el backend, pero solo si no se manda: "" no matchea
      // ningun valor del enum y tira 400 (ver z.enum(...).optional() en
      // user.validator.js) - se omite en vez de mandarlo vacio si no se eligio.
      const payload = { ...form, cargo: "CHOFER" };
      if (!payload.grupo) delete payload.grupo;
      const nuevo = await createUserRequest(payload);
      refreshDrivers();
      setCreado({ ...nuevo, password: form.password });
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.message);
      setFieldErrors(parsed.fieldErrors || {});
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdmin) return <Navigate to="/choferes" replace />;

  return (
    <SlideOverPanel closeTo="/choferes">
    <div className="flex flex-col gap-6">
      <div>
        <BackLink to="/choferes" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
          &larr; Choferes
        </BackLink>
      </div>

      <div>
        <h1 className="text-[24px] font-semibold text-ink-50">Nuevo chofer</h1>
        <p className="mt-1 text-[14px] text-ink-300">
          Se crea con cargo Chofer y puede iniciar sesion con estos datos.
        </p>
      </div>

      {creado ? (
      <GlassCard>
        <div className="flex flex-col gap-4">
          <Alert variant="success">Cuenta creada. Mándale ahora sus datos de acceso por WhatsApp.</Alert>
          <div className="rounded-xl glass-surface-sm px-4 py-3 text-[14px] text-ink-100">
            <p><span className="text-ink-400">Usuario:</span> {creado.correoElectronico}</p>
            <p><span className="text-ink-400">Contraseña:</span> {creado.password}</p>
            <p><span className="text-ink-400">App:</span> {APP_URL}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={enlaceWhatsapp(creado.numeroCelular, mensajeCuenta({ nombre: creado.nombre, correo: creado.correoElectronico, password: creado.password }))}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-[15px] font-semibold text-[#0b2e1a] transition hover:brightness-95 active:scale-[0.98]"
            >
              Enviar acceso por WhatsApp
            </a>
            <Button variant="ghost" className="sm:w-auto sm:px-6" onClick={() => navigate("/choferes", { replace: true })}>
              Listo
            </Button>
          </div>
        </div>
      </GlassCard>
      ) : (
      <GlassCard>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <Alert>{formError}</Alert>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField
              id="nombre"
              label="Nombre"
              value={form.nombre}
              onChange={handleChange("nombre")}
              error={fieldErrors.nombre?.[0]}
              required
            />
            <TextField
              id="apellido"
              label="Apellido"
              value={form.apellido}
              onChange={handleChange("apellido")}
              error={fieldErrors.apellido?.[0]}
              required
            />
            <TextField
              id="correoElectronico"
              label="Correo electronico"
              type="email"
              value={form.correoElectronico}
              onChange={handleChange("correoElectronico")}
              error={fieldErrors.correoElectronico?.[0]}
              required
            />
            <PasswordField
              id="password"
              label="Contrasena"
              placeholder="Minimo 8 caracteres"
              value={form.password}
              onChange={handleChange("password")}
              error={fieldErrors.password?.[0]}
              required
            />
            <TextField
              id="numeroCelular"
              label="Numero de celular"
              type="tel"
              value={form.numeroCelular}
              onChange={handleChange("numeroCelular")}
              error={fieldErrors.numeroCelular?.[0]}
              required
            />
            <SearchableSelect
              id="area"
              label="Area"
              placeholder="Escribe para buscar un area"
              options={AREA_OPTIONS}
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
            <TextField
              id="fechaNacimiento"
              label="Fecha de nacimiento"
              type="date"
              value={form.fechaNacimiento}
              onChange={handleChange("fechaNacimiento")}
              error={fieldErrors.fechaNacimiento?.[0]}
              required
            />
          </div>

          <Button type="submit" loading={submitting} className="sm:w-auto sm:px-8">
            Crear chofer
          </Button>
        </form>
      </GlassCard>
      )}
    </div>
    </SlideOverPanel>
  );
};
