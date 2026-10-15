import { BackLink } from "../../components/ui/BackLink";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MancatoForm } from "../../components/mancato/MancatoForm";
import { GlassCard } from "../../components/ui/GlassCard";
import { SlideOverPanel } from "../../components/ui/SlideOverPanel";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { createMancatoRequest } from "../../lib/mancato.api";

export const NewMancatoPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const location = useLocation();
  const { refresh } = useDataRefresh("mancato");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (fields, files) => {
    setSubmitting(true);
    setError("");
    setFieldErrors({});
    try {
      const mancato = await createMancatoRequest(fields, files);
      refresh();
      // Se preserva backgroundLocation (ver App.jsx) para que el detalle tambien se
      // muestre como overlay sobre la lista.
      navigate(`/finanzas/mancato/${mancato.id}`, {
        replace: true,
        state: { backgroundLocation: location.state?.backgroundLocation },
      });
    } catch (err) {
      const parsed = parseApiError(err);
      setError(parsed.message);
      setFieldErrors(parsed.fieldErrors || {});
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SlideOverPanel closeTo="/finanzas/mancato">
      <div className="flex flex-col gap-6">
        <div>
          <BackLink to="/finanzas/mancato" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
            &larr; Mancato Pagamento
          </BackLink>
        </div>

        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">
            {isPrivileged ? "Nuevo Mancato Pagamento" : "Subir mancato pagamento"}
          </h1>
          <p className="mt-1 text-[14px] text-ink-300">
            {isPrivileged
              ? "Vence 13 dias despues de la fecha del aviso."
              : "Sube la foto del aviso y copia sus datos. De lo demas se encarga la empresa."}
          </p>
        </div>

        <GlassCard>
          <MancatoForm
            mode="create"
            onSubmit={handleSubmit}
            submitting={submitting}
            error={error}
            fieldErrors={fieldErrors}
          />
        </GlassCard>
      </div>
    </SlideOverPanel>
  );
};
