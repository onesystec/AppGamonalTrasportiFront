import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { PasswordField } from "../../components/ui/PasswordField";
import { Select } from "../../components/ui/Select";
import { TextField } from "../../components/ui/TextField";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { useAuth } from "../../context/AuthContext";
import { AREA_OPTIONS } from "../../lib/constants";

const INITIAL_FORM = {
  nombre: "",
  apellido: "",
  area: "",
  fechaNacimiento: "",
  numeroCelular: "",
  correoElectronico: "",
  password: "",
};

export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});
    setLoading(true);

    const result = await register(form);

    setLoading(false);

    if (!result.ok) {
      setFormError(result.error.message);
      setFieldErrors(result.error.fieldErrors || {});
      return;
    }

    navigate("/", { replace: true });
  };

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Únete al equipo de ONE DRIVER Express"
      footer={
        <>
          Ya tienes cuenta?{" "}
          <Link to="/login" className="font-medium text-brand hover:text-brand-light">
            Inicia sesion
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <Alert>{formError}</Alert>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField
            id="nombre"
            label="Nombre"
            autoComplete="given-name"
            placeholder="Mario"
            value={form.nombre}
            onChange={handleChange("nombre")}
            error={fieldErrors.nombre?.[0]}
            required
          />
          <TextField
            id="apellido"
            label="Apellido"
            autoComplete="family-name"
            placeholder="Rossi"
            value={form.apellido}
            onChange={handleChange("apellido")}
            error={fieldErrors.apellido?.[0]}
            required
          />
        </div>

        <Select
          id="area"
          label="Area"
          placeholder="Selecciona tu area"
          options={AREA_OPTIONS}
          value={form.area}
          onChange={handleChange("area")}
          error={fieldErrors.area?.[0]}
          required
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField
            id="fechaNacimiento"
            label="Fecha de nacimiento"
            type="date"
            value={form.fechaNacimiento}
            onChange={handleChange("fechaNacimiento")}
            error={fieldErrors.fechaNacimiento?.[0]}
            required
          />
          <TextField
            id="numeroCelular"
            label="Numero de celular"
            type="tel"
            autoComplete="tel"
            placeholder="+39 333 1234567"
            value={form.numeroCelular}
            onChange={handleChange("numeroCelular")}
            error={fieldErrors.numeroCelular?.[0]}
            required
          />
        </div>

        <TextField
          id="correoElectronico"
          label="Correo electronico"
          type="email"
          autoComplete="email"
          placeholder="tucorreo@ejemplo.com"
          value={form.correoElectronico}
          onChange={handleChange("correoElectronico")}
          error={fieldErrors.correoElectronico?.[0]}
          required
        />

        <PasswordField
          id="password"
          label="Contrasena"
          autoComplete="new-password"
          placeholder="Minimo 8 caracteres"
          value={form.password}
          onChange={handleChange("password")}
          error={fieldErrors.password?.[0]}
          required
        />

        <Button type="submit" loading={loading}>
          Crear cuenta
        </Button>
      </form>

    </AuthLayout>
  );
};
