import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { PasswordField } from "../../components/ui/PasswordField";
import { TextField } from "../../components/ui/TextField";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { ArrowRightIcon, LockIcon, MailIcon } from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ correoElectronico: "", password: "" });
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

    const result = await login(form);

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
      title="Bienvenido"
      subtitle="Inicia sesión en ONE DRIVER Express"
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link to="/register" className="font-medium text-brand hover:text-brand-light">
            Crea una
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {location.state?.resetSuccess && (
          <Alert variant="success">
            Tu contraseña se actualizó correctamente. Inicia sesión con tus nuevos datos.
          </Alert>
        )}
        <Alert>{formError}</Alert>

        <TextField
          id="correoElectronico"
          label="Correo electrónico"
          icon={MailIcon}
          type="email"
          autoComplete="email"
          placeholder="tucorreo@ejemplo.com"
          value={form.correoElectronico}
          onChange={handleChange("correoElectronico")}
          error={fieldErrors.correoElectronico?.[0]}
          required
        />

        <div>
          <PasswordField
            id="password"
            label="Contraseña"
            icon={LockIcon}
            autoComplete="current-password"
            placeholder="••••••••"
            value={form.password}
            onChange={handleChange("password")}
            error={fieldErrors.password?.[0]}
            required
          />
          <div className="mt-2 text-right">
            <Link
              to="/forgot-password"
              className="text-[13px] font-medium text-brand hover:text-brand-light"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>

        <Button type="submit" loading={loading}>
          Iniciar sesión
          <ArrowRightIcon />
        </Button>
      </form>
    </AuthLayout>
  );
};
