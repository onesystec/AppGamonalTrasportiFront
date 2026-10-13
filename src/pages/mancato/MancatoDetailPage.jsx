import { BackLink } from "../../components/ui/BackLink";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MancatoBadge } from "../../components/mancato/MancatoBadge";
import { MancatoForm } from "../../components/mancato/MancatoForm";
import { MancatoServicioCard } from "../../components/mancato/MancatoServicioCard";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { GlassCard } from "../../components/ui/GlassCard";
import { PageLoader } from "../../components/ui/PageLoader";
import { SlideOverPanel } from "../../components/ui/SlideOverPanel";
import { Spinner } from "../../components/ui/Spinner";
import {
  AlertTriangleIcon,
  CameraIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
  FileTextIcon,
  PencilIcon,
  TrashIcon,
} from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { formatCurrency, formatDateOnly } from "../../lib/format";
import { MANCATO_ESTADO_BY_VALUE, sitioWebHref } from "../../lib/mancato";
import { deleteMancatoRequest, getMancatoRequest, updateMancatoRequest } from "../../lib/mancato.api";

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
  })} (hora de Roma)`;

const Fact = ({ label, children }) => (
  <div className="min-w-0">
    <span className="block text-[12px] uppercase tracking-wide text-ink-400">{label}</span>
    <span className="mt-0.5 block break-words text-[15px] font-medium text-ink-50">{children}</span>
  </div>
);

// Adjunto (foto del aviso o comprobante de pago): imagen con vista ampliada o PDF.
const Attachment = ({ title, file, emptyText, action }) => (
  <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[13px] font-medium text-ink-300">{title}</span>
      {action}
    </div>
    {file ? (
      <a
        href={file.url}
        target="_blank"
        rel="noreferrer"
        className="group flex min-h-24 items-center justify-center overflow-hidden rounded-xl glass-surface-sm"
      >
        {file.esPdf ? (
          <span className="flex items-center gap-2 px-4 py-6 text-[14px] font-medium text-accent-400">
            <FileTextIcon className="h-5 w-5" />
            Ver PDF
          </span>
        ) : (
          <img
            src={file.url}
            alt={title}
            className="max-h-64 w-full object-contain transition-transform group-hover:scale-[1.02]"
          />
        )}
      </a>
    ) : (
      <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-line/25 px-4 py-6 text-[13px] text-ink-400">
        {emptyText}
      </div>
    )}
  </div>
);

export const MancatoDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refresh } = useDataRefresh("mancato");
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const [mancato, setMancato] = useState(null);
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
    getMancatoRequest(id)
      .then((data) => {
        if (!cancelled) setMancato(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const applyUpdate = (updated) => {
    setMancato(updated);
    refresh();
  };

  const handleSave = async (fields, files) => {
    setSaving(true);
    setSaveError("");
    setFieldErrors({});
    try {
      applyUpdate(await updateMancatoRequest(id, fields, files));
      setEditing(false);
    } catch (err) {
      const parsed = parseApiError(err);
      setSaveError(parsed.message);
      setFieldErrors(parsed.fieldErrors || {});
    } finally {
      setSaving(false);
    }
  };

  // Acciones rapidas (subir comprobante, marcar pagado / reabrir) sin abrir la edicion.
  const quickUpdate = async (fields, files) => {
    setBusy(true);
    setActionError("");
    try {
      applyUpdate(await updateMancatoRequest(id, fields, files));
    } catch (err) {
      setActionError(parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const handleComprobante = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) quickUpdate({}, { comprobante: file });
  };

  const handleDelete = async () => {
    setBusy(true);
    setActionError("");
    try {
      await deleteMancatoRequest(id);
      refresh();
      navigate("/finanzas/mancato", { replace: true });
    } catch (err) {
      setActionError(parseApiError(err).message);
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <SlideOverPanel closeTo="/finanzas/mancato">
        <Alert>{loadError}</Alert>
      </SlideOverPanel>
    );
  }

  if (!mancato) {
    return (
      <SlideOverPanel closeTo="/finanzas/mancato">
        <PageLoader />
      </SlideOverPanel>
    );
  }

  const estado = MANCATO_ESTADO_BY_VALUE[mancato.estado];
  // El chofer puede editar lo suyo mientras no este pagado; OWNER/ADMIN siempre. Al chofer el servidor
  // no le dice si esta pagado, solo si todavia lo puede corregir ("editable").
  const canEdit = isPrivileged || (mancato.editable ?? !mancato.pagado);
  const canUploadComprobante = canEdit;

  return (
    <SlideOverPanel closeTo="/finanzas/mancato">
      <div className="flex flex-col gap-6">
        <div>
          <BackLink to="/finanzas/mancato" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
            &larr; Mancato Pagamento
          </BackLink>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-[24px] font-semibold text-ink-50">N. {mancato.numero}</h1>
            <p className="mt-1 text-[14px] text-ink-300">
              {mancato.targa}
              {mancato.driver && ` - ${mancato.driver.nombre} ${mancato.driver.apellido}`}
            </p>
          </div>
          {isPrivileged && <MancatoBadge mancato={mancato} plazo className="text-[13px]" />}
        </div>

        <Alert>{actionError}</Alert>

        {isPrivileged && mancato.fueraDePlazo && (
          <div className="flex items-start gap-2.5 rounded-xl bg-danger-500/10 px-4 py-3 text-[13px] text-danger-500">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Se registro en el sistema {mancato.diasTarde} {mancato.diasTarde === 1 ? "dia" : "dias"} despues de la
              fecha de vencimiento.
            </span>
          </div>
        )}
        {mancato.subidoTarde && (
          <div className="flex items-start gap-2.5 rounded-xl bg-danger-500/10 px-4 py-3 text-[13px] text-danger-500">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {isPrivileged ? "El chofer lo subio" : "Lo subiste"} {mancato.horasHastaSubida} horas despues del aviso
              (mas de 48 horas).
            </span>
          </div>
        )}
        {isPrivileged && mancato.pagadoFueraDePlazo && (
          <div className="flex items-start gap-2.5 rounded-xl bg-warning-500/10 px-4 py-3 text-[13px] text-warning-500">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Se pago despues de la fecha de vencimiento.</span>
          </div>
        )}

        {editing ? (
          <GlassCard>
            <MancatoForm
              mode="edit"
              mancato={mancato}
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
            <GlassCard className={clsx(isPrivileged && ["border-l-4", estado.edge])}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                <Fact label={isPrivileged ? "Fecha" : "Fecha del aviso"}>{formatDateOnly(mancato.fecha)}</Fact>
                <Fact label="Hora del tránsito">{mancato.horaTransito ?? "-"}</Fact>
                {isPrivileged ? (
                  <Fact label="Vence">{formatDateOnly(mancato.fechaVencimiento)}</Fact>
                ) : (
                  <Fact label="Subido el">{formatRomeDateTime(mancato.registradoAt).replace(" (hora de Roma)", "")}</Fact>
                )}
                <Fact label="Costo">{formatCurrency(mancato.costo)}</Fact>
                <Fact label="Targa">{mancato.targa}</Fact>
                <Fact label="Chofer">
                  {mancato.driver ? `${mancato.driver.nombre} ${mancato.driver.apellido}` : "-"}
                </Fact>
                <Fact label="Sitio web">
                  {mancato.sitioWeb ? (
                    sitioWebHref(mancato.sitioWeb) ? (
                      <a
                        href={sitioWebHref(mancato.sitioWeb)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 break-all text-accent-400 hover:text-accent-300"
                      >
                        {isPrivileged ? "Pagar" : "Abrir enlace"}
                        <ExternalLinkIcon className="h-4 w-4 shrink-0" />
                      </a>
                    ) : (
                      <span className="break-words">{mancato.sitioWeb}</span>
                    )
                  ) : (
                    "-"
                  )}
                </Fact>
              </div>

              {mancato.comentarios && (
                <div className="mt-5 border-t border-line/10 pt-4">
                  <span className="block text-[12px] uppercase tracking-wide text-ink-400">Comentarios</span>
                  <p className="mt-1 whitespace-pre-wrap text-[14px] text-ink-50">{mancato.comentarios}</p>
                </div>
              )}
            </GlassCard>

            <MancatoServicioCard
              mancato={mancato}
              isPrivileged={isPrivileged}
              busy={busy}
              onChange={(fields) => quickUpdate(fields)}
            />

            <GlassCard>
              <div className={clsx("grid grid-cols-1 gap-5", isPrivileged && "sm:grid-cols-2")}>
                <Attachment title="Foto del mancato pagamento" file={mancato.foto} emptyText="Sin foto" />
                {isPrivileged && (
                  <Attachment
                    title="Comprobante de pago"
                    file={mancato.comprobante}
                    emptyText="Todavia no se subio el comprobante"
                    action={
                      canUploadComprobante && (
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full glass-input px-3 py-1 text-[12px] font-medium text-ink-50 hover:bg-line/10">
                          {busy ? <Spinner className="h-3.5 w-3.5" /> : <CameraIcon className="h-3.5 w-3.5" />}
                          {mancato.comprobante ? "Reemplazar" : "Subir comprobante"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            className="hidden"
                            onChange={handleComprobante}
                            disabled={busy}
                          />
                        </label>
                      )
                    }
                  />
                )}
              </div>
            </GlassCard>

            <GlassCard>
              <h2 className="text-[15px] font-semibold text-ink-50">Registro</h2>
              <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <Fact label="Registrado el">{formatRomeDateTime(mancato.registradoAt)}</Fact>
                <Fact label="Registrado por">
                  {mancato.registradoPor ? `${mancato.registradoPor.nombre} ${mancato.registradoPor.apellido}` : "-"}
                </Fact>
                {isPrivileged && mancato.pagadoAt && (
                  <Fact label="Pagado el">{formatRomeDateTime(mancato.pagadoAt)}</Fact>
                )}
              </div>
              <p className="mt-3 text-[12px] text-ink-400">
                La fecha y hora de registro las guarda el sistema y no se pueden editar.
              </p>
            </GlassCard>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
              {isPrivileged && (
                <Button
                  variant="danger"
                  className="sm:w-auto sm:px-5"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  <TrashIcon className="h-4 w-4" />
                  Eliminar
                </Button>
              )}
              {isPrivileged && (
                <Button
                  variant="ghost"
                  className="sm:w-auto sm:px-5"
                  disabled={busy}
                  onClick={() => quickUpdate({ pagado: String(!mancato.pagado) })}
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  {mancato.pagado ? "Reabrir (marcar pendiente)" : "Marcar como pagado"}
                </Button>
              )}
              {canEdit && (
                <Button className="sm:w-auto sm:px-6" disabled={busy} onClick={() => setEditing(true)}>
                  <PencilIcon className="h-4 w-4" />
                  Editar
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Eliminar mancato pagamento"
        description={`Se borra el N. ${mancato.numero} con su foto y comprobante. No se puede deshacer.`}
        confirmLabel="Eliminar"
        loading={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </SlideOverPanel>
  );
};
