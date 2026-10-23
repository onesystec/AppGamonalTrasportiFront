import { BackLink } from "../../components/ui/BackLink";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CombustibleForm } from "../../components/combustible/CombustibleForm";
import { CombustibleServicioCard } from "../../components/combustible/CombustibleServicioCard";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { GlassCard } from "../../components/ui/GlassCard";
import { PageLoader } from "../../components/ui/PageLoader";
import { SlideOverPanel } from "../../components/ui/SlideOverPanel";
import { FileTextIcon, LockIcon, PencilIcon, TrashIcon } from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { COMBUSTIBLE_AREA_BY_VALUE } from "../../lib/combustible";
import {
  deleteCombustibleRequest,
  getCombustibleRequest,
  updateCombustibleRequest,
} from "../../lib/combustible.api";
import { formatCurrency, formatDateOnly } from "../../lib/format";

// Fecha y hora siempre en hora de Roma (la operacion es ahi), sin importar donde se mire.
const formatRomeDateTime = (value) =>
  `${new Date(value).toLocaleString("es-AR", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })}`;

const Fact = ({ label, children }) => (
  <div className="min-w-0">
    <span className="block text-[12px] uppercase tracking-wide text-ink-400">{label}</span>
    <span className="mt-0.5 block break-words text-[15px] font-medium text-ink-50">{children}</span>
  </div>
);

export const CombustibleDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refresh } = useDataRefresh("combustible");
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const [registro, setRegistro] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCombustibleRequest(id)
      .then((data) => {
        if (!cancelled) setRegistro(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSave = async (fields, files) => {
    setSaving(true);
    setSaveError("");
    setFieldErrors({});
    try {
      setRegistro(await updateCombustibleRequest(id, fields, files));
      refresh();
      setEditing(false);
    } catch (err) {
      const parsed = parseApiError(err);
      setSaveError(parsed.message);
      setFieldErrors(parsed.fieldErrors || {});
    } finally {
      setSaving(false);
    }
  };

  // Confirmar o cambiar el servicio sin abrir la edicion (OWNER/ADMIN).
  const quickUpdate = async (fields) => {
    setBusy(true);
    setActionError("");
    try {
      setRegistro(await updateCombustibleRequest(id, fields));
      refresh();
    } catch (err) {
      setActionError(parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setActionError("");
    try {
      await deleteCombustibleRequest(id);
      refresh();
      navigate("/finanzas/combustible", { replace: true });
    } catch (err) {
      setActionError(parseApiError(err).message);
      setConfirmDelete(false);
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <SlideOverPanel closeTo="/finanzas/combustible">
        <Alert>{loadError}</Alert>
      </SlideOverPanel>
    );
  }

  if (!registro) {
    return (
      <SlideOverPanel closeTo="/finanzas/combustible">
        <PageLoader />
      </SlideOverPanel>
    );
  }

  const area = COMBUSTIBLE_AREA_BY_VALUE[registro.area];
  const driverName = registro.driver ? `${registro.driver.nombre} ${registro.driver.apellido}` : "-";

  return (
    <SlideOverPanel closeTo="/finanzas/combustible">
      <div className="flex flex-col gap-6">
        <div>
          <BackLink to="/finanzas/combustible" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
            &larr; Registro Combustible
          </BackLink>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-[24px] font-semibold text-ink-50">{formatCurrency(registro.monto)}</h1>
            <p className="mt-1 text-[14px] text-ink-300">
              {registro.metodo} - {registro.targa}
            </p>
          </div>
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-[13px] font-semibold"
            style={{ backgroundColor: area.color, color: area.fg }}
          >
            {area.label}
          </span>
        </div>

        <Alert>{actionError}</Alert>

        {!registro.editable && !isPrivileged && (
          <div className="flex items-start gap-2.5 rounded-xl bg-line/10 px-4 py-3 text-[13px] text-ink-300">
            <LockIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Este registro ya se cerro: solo se puede corregir el mismo dia en que se cargo. Si hay un
              error, pidele a un administrador que lo corrija.
            </span>
          </div>
        )}

        {editing ? (
          <GlassCard>
            <CombustibleForm
              mode="edit"
              registro={registro}
              onSubmit={handleSave}
              onCancel={() => {
                setEditing(false);
                setSaveError("");
                setFieldErrors({});
              }}
              submitting={saving}
              error={saveError}
              fieldErrors={fieldErrors}
            />
          </GlassCard>
        ) : (
          <>
            <GlassCard className="border-l-4" style={{ borderLeftColor: area.color }}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                <Fact label="Fecha">{formatDateOnly(registro.fecha)}</Fact>
                <Fact label="Hora">{registro.horaCarga ?? "-"}</Fact>
                <Fact label="Monto">{formatCurrency(registro.monto)}</Fact>
                <Fact label="Método">{registro.metodo}</Fact>
                <Fact label="Área">{area.label}</Fact>
                <Fact label="Targa">{registro.targa}</Fact>
                <Fact label="Chofer">{driverName}</Fact>
              </div>
            </GlassCard>

            <CombustibleServicioCard
              registro={registro}
              isPrivileged={isPrivileged}
              busy={busy}
              onChange={quickUpdate}
            />

            <GlassCard>
              <span className="mb-2 block text-[13px] font-medium text-ink-300">Comprobante de pago</span>
              {registro.comprobante ? (
                <a
                  href={registro.comprobante.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex min-h-24 items-center justify-center overflow-hidden rounded-xl glass-surface-sm"
                >
                  {registro.comprobante.esPdf ? (
                    <span className="flex items-center gap-2 px-4 py-6 text-[14px] font-medium text-accent-400">
                      <FileTextIcon className="h-5 w-5" />
                      Ver PDF
                    </span>
                  ) : (
                    <img
                      src={registro.comprobante.url}
                      alt="Comprobante de pago"
                      className="max-h-96 w-full object-contain transition-transform group-hover:scale-[1.02]"
                    />
                  )}
                </a>
              ) : (
                <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-line/25 px-4 py-6 text-[13px] text-ink-400">
                  Sin comprobante
                </div>
              )}
            </GlassCard>

            <GlassCard>
              <h2 className="text-[15px] font-semibold text-ink-50">Registro</h2>
              <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <Fact label="Registrado el">{formatRomeDateTime(registro.registradoAt)}</Fact>
                <Fact label="Registrado por">
                  {registro.registradoPor
                    ? `${registro.registradoPor.nombre} ${registro.registradoPor.apellido}`
                    : "-"}
                </Fact>
              </div>
              <p className="mt-3 text-[12px] text-ink-400">
                La fecha y hora de registro las guarda el sistema y no se pueden editar.
              </p>
            </GlassCard>

            {registro.editable && (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
                <Button
                  variant="danger"
                  className="sm:w-auto sm:px-5"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  <TrashIcon className="h-4 w-4" />
                  Eliminar
                </Button>
                <Button className="sm:w-auto sm:px-6" disabled={busy} onClick={() => setEditing(true)}>
                  <PencilIcon className="h-4 w-4" />
                  Editar
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Eliminar carga de combustible"
        description={`Se borra la carga de ${formatCurrency(registro.monto)} (${registro.metodo}) con su comprobante. No se puede deshacer.`}
        confirmLabel="Eliminar"
        loading={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </SlideOverPanel>
  );
};
