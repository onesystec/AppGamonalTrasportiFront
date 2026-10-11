import { BackLink } from "../../components/ui/BackLink";
import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CombustibleForm } from "../../components/combustible/CombustibleForm";
import { GlassCard } from "../../components/ui/GlassCard";
import { SlideOverPanel } from "../../components/ui/SlideOverPanel";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { createCombustibleRequest } from "../../lib/combustible.api";

export const NewCombustiblePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useDataRefresh("combustible");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  // Cuando el backend avisa de un posible duplicado (409), la oficina puede registrarla igual.
  const [duplicate, setDuplicate] = useState(false);
  const lastSubmit = useRef(null);

  const handleSubmit = async (fields, files, { force = false } = {}) => {
    lastSubmit.current = { fields, files };
    setSubmitting(true);
    setError("");
    setFieldErrors({});
    setDuplicate(false);
    try {
      const registro = await createCombustibleRequest(force ? { ...fields, forzar: "true" } : fields, files);
      refresh();
      // Se preserva backgroundLocation (ver App.jsx) para que el detalle tambien se
      // muestre como overlay sobre la lista.
      navigate(`/finanzas/combustible/${registro.id}`, {
        replace: true,
        state: { backgroundLocation: location.state?.backgroundLocation },
      });
    } catch (err) {
      const parsed = parseApiError(err);
      setError(parsed.message);
      setFieldErrors(parsed.fieldErrors || {});
      if (err?.response?.status === 409) setDuplicate(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SlideOverPanel closeTo="/finanzas/combustible">
      <div className="flex flex-col gap-6">
        <div>
          <BackLink to="/finanzas/combustible" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
            &larr; Registro Combustible
          </BackLink>
        </div>

        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">Nueva carga de combustible</h1>
          <p className="mt-1 text-[14px] text-ink-300">
            Sube la foto del comprobante y completa los datos. Podras corregirlos hasta el final del dia.
          </p>
        </div>

        <GlassCard>
          <CombustibleForm
            mode="create"
            onSubmit={handleSubmit}
            onForce={
              duplicate && isPrivileged
                ? () => handleSubmit(lastSubmit.current.fields, lastSubmit.current.files, { force: true })
                : undefined
            }
            submitting={submitting}
            error={error}
            fieldErrors={fieldErrors}
          />
        </GlassCard>
      </div>
    </SlideOverPanel>
  );
};
