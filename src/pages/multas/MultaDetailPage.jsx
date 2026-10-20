import { BackLink } from "../../components/ui/BackLink";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MancatoBadge } from "../../components/mancato/MancatoBadge";
import { MultaChoferCard } from "../../components/chofer/MultaChoferCard";
import { MultaForm } from "../../components/multas/MultaForm";
import { SugerenciaPanel } from "../../components/multas/MultaSugerencia";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { GlassCard } from "../../components/ui/GlassCard";
import { PageLoader } from "../../components/ui/PageLoader";
import { SlideOverPanel } from "../../components/ui/SlideOverPanel";
import { CameraPickButton } from "../../components/ui/CameraPickButton";
import { Spinner } from "../../components/ui/Spinner";
import {
  AlertTriangleIcon,
  CameraIcon,
  CheckCircleIcon,
  FileTextIcon,
  PencilIcon,
  TrashIcon,
} from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { formatCurrency, formatDateOnly } from "../../lib/format";
import { AREA_LABEL_BY_KEY } from "../../lib/roles";
import { MULTA_ESTADO_BY_VALUE, quienPagaLabel } from "../../lib/multas";
import { deleteMultaRequest, getMultaRequest, updateMultaRequest } from "../../lib/multas.api";

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

// Adjunto (multa o comprobante de pago): imagen con vista ampliada o PDF.
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

const MultaOficinaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refresh } = useDataRefresh("multas");
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const [multa, setMulta] = useState(null);
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
    getMultaRequest(id)
      .then((data) => {
        if (!cancelled) setMulta(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const applyUpdate = (updated) => {
    setMulta(updated);
    refresh();
  };

  const handleSave = async (fields, files) => {
    setSaving(true);
    setSaveError("");
    setFieldErrors({});
    try {
      applyUpdate(await updateMultaRequest(id, fields, files));
      setEditing(false);
    } catch (err) {
      const parsed = parseApiError(err);
      setSaveError(parsed.message);
      setFieldErrors(parsed.fieldErrors || {});
    } finally {
      setSaving(false);
    }
  };

  // Acciones rapidas (subir comprobante, marcar pagada / descontada) sin abrir la edicion.
  const quickUpdate = async (fields, files) => {
    setBusy(true);
    setActionError("");
    try {
      applyUpdate(await updateMultaRequest(id, fields, files));
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
      await deleteMultaRequest(id);
      refresh();
      navigate("/finanzas/multas", { replace: true });
    } catch (err) {
      setActionError(parseApiError(err).message);
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <SlideOverPanel closeTo="/finanzas/multas">
        <Alert>{loadError}</Alert>
      </SlideOverPanel>
    );
  }

  if (!multa) {
    return (
      <SlideOverPanel closeTo="/finanzas/multas">
        <PageLoader />
      </SlideOverPanel>
    );
  }

  const estado = MULTA_ESTADO_BY_VALUE[multa.estado];
  const quien = quienPagaLabel(multa);

  return (
    <SlideOverPanel closeTo="/finanzas/multas">
      <div className="flex flex-col gap-6">
        <div>
          <BackLink to="/finanzas/multas" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
            &larr; Multas
          </BackLink>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-[24px] font-semibold text-ink-50">Verbale {multa.numeroVerbale}</h1>
            <p className="mt-1 text-[14px] text-ink-300">
              {multa.targa}
              {multa.driver && ` - ${multa.driver.nombre} ${multa.driver.apellido}`}
            </p>
          </div>
          <MancatoBadge mancato={multa} plazo className="text-[13px]" />
        </div>

        <Alert>{actionError}</Alert>

        {multa.comprobantePendiente && (
          <div className="flex items-start gap-2.5 rounded-xl bg-accent-500/10 px-4 py-3 text-[13px] text-ink-50">
            <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" />
            <span>
              El chofer subio su comprobante de pago el {formatRomeDateTime(multa.comprobanteChoferAt)}. Revisalo y, si
              esta bien, marca la multa como pagada.
            </span>
          </div>
        )}

        {multa.estado === "VENCIDO" && (
          <div className="flex items-start gap-2.5 rounded-xl bg-danger-500/10 px-4 py-3 text-[13px] text-danger-500">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Esta multa esta vencida y todavia no figura como pagada.</span>
          </div>
        )}
        {multa.pagadoFueraDePlazo && (
          <div className="flex items-start gap-2.5 rounded-xl bg-warning-500/10 px-4 py-3 text-[13px] text-warning-500">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Se pago despues de la fecha de vencimiento.</span>
          </div>
        )}

        {editing ? (
          <GlassCard>
            <MultaForm
              mode="edit"
              multa={multa}
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
            <GlassCard className={clsx("border-l-4", estado.edge)}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                {multa.fechaInfraccion && (
                  <Fact label="Infraccion">
                    {formatDateOnly(multa.fechaInfraccion)}
                    {multa.horaInfraccion && <span className="block text-[12px] font-normal text-ink-400">{multa.horaInfraccion} hs</span>}
                  </Fact>
                )}
                <Fact label="Recepcion">{formatDateOnly(multa.fechaRecepcion)}</Fact>
                <Fact label="Vence">{formatDateOnly(multa.fechaVencimiento)}</Fact>
                <Fact label="Costo">{formatCurrency(multa.costo)}</Fact>
                <Fact label="Targa">{multa.targa}</Fact>
                <Fact label="Area">{AREA_LABEL_BY_KEY[multa.area] ?? "Sin area (solo Admin)"}</Fact>
                <Fact label="Chofer responsable">
                  {multa.driver ? `${multa.driver.nombre} ${multa.driver.apellido}` : "-"}
                </Fact>
                <Fact label="¿Chofer pago?">
                  <span
                    className={clsx(
                      "inline-flex rounded-full px-2.5 py-1 text-[13px] font-medium",
                      quien.tone === "warning" && "bg-warning-500/20 text-warning-500",
                      quien.tone === "success" && "bg-success-500/15 text-success-500",
                      quien.tone === "neutral" && "bg-ink-500/15 text-ink-300",
                    )}
                  >
                    {multa.quienPaga === "CHOFER_PAGO" ? "Si, pago el chofer" : quien.text}
                  </span>
                  {multa.descontado && multa.descontadoAt && (
                    <span className="mt-1 block text-[12px] font-normal text-ink-400">
                      Descontado el {formatDateOnly(multa.descontadoAt)}
                    </span>
                  )}
                </Fact>
              </div>

              {!multa.driver && (
                <div className="mt-5">
                  <SugerenciaPanel multaId={multa.id} disabled={busy} onAssign={(driverId) => quickUpdate({ driverId })} />
                </div>
              )}

              {multa.comentarios && (
                <div className="mt-5 border-t border-line/10 pt-4">
                  <span className="block text-[12px] uppercase tracking-wide text-ink-400">Comentarios</span>
                  <p className="mt-1 whitespace-pre-wrap text-[14px] text-ink-50">{multa.comentarios}</p>
                </div>
              )}
            </GlassCard>

            <GlassCard>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Attachment title="Multa (foto o PDF)" file={multa.multa} emptyText="Sin archivo" />
                <Attachment
                  title={
                    multa.comprobante
                      ? "Comprobante de pago"
                      : multa.comprobanteChofer
                        ? "Comprobante del chofer"
                        : "Comprobante de pago"
                  }
                  file={multa.comprobante ?? multa.comprobanteChofer}
                  emptyText="Todavia no se subio el comprobante"
                  action={
                    isPrivileged && (
                      <span className="flex flex-wrap items-center gap-2">
                        <CameraPickButton
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full glass-input px-3 py-1 text-[12px] font-medium text-ink-50 hover:bg-line/10"
                          onChange={handleComprobante}
                          disabled={busy}
                        />
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full glass-input px-3 py-1 text-[12px] font-medium text-ink-50 hover:bg-line/10">
                          {busy ? <Spinner className="h-3.5 w-3.5" /> : <CameraIcon className="h-3.5 w-3.5" />}
                          {multa.comprobante ? "Reemplazar" : "Subir comprobante"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            className="hidden"
                            onChange={handleComprobante}
                            disabled={busy}
                          />
                        </label>
                      </span>
                    )
                  }
                />
              </div>
            </GlassCard>

            <GlassCard>
              <h2 className="text-[15px] font-semibold text-ink-50">Registro</h2>
              <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <Fact label="Cargada el">{formatRomeDateTime(multa.registradoAt)}</Fact>
                <Fact label="Cargada por">
                  {multa.registradoPor ? `${multa.registradoPor.nombre} ${multa.registradoPor.apellido}` : "-"}
                </Fact>
                {multa.pagadoAt && <Fact label="Pagada el">{formatRomeDateTime(multa.pagadoAt)}</Fact>}
              </div>
              <p className="mt-3 text-[12px] text-ink-400">
                La fecha y hora de carga las guarda el sistema y no se pueden editar.
              </p>
            </GlassCard>

            {isPrivileged && (
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
                {multa.quienPaga === "A_DESCONTAR" && (
                  <Button
                    variant="ghost"
                    className="sm:w-auto sm:px-5"
                    disabled={busy}
                    onClick={() => quickUpdate({ descontado: String(!multa.descontado) })}
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    {multa.descontado ? "Quitar marca de descontado" : "Marcar como descontado"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="sm:w-auto sm:px-5"
                  disabled={busy}
                  onClick={() => quickUpdate({ pagado: String(!multa.pagado) })}
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  {multa.pagado ? "Reabrir (marcar pendiente)" : "Marcar como pagada"}
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
        title="Eliminar multa"
        description={`Se borra el verbale ${multa.numeroVerbale} con su archivo y comprobante. No se puede deshacer.`}
        confirmLabel="Eliminar"
        loading={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </SlideOverPanel>
  );
};

// Detalle simple para el chofer: la misma tarjeta de su lista.
const MultaChoferDetail = () => {
  const { id } = useParams();
  const { refresh } = useDataRefresh("multas");
  const [multa, setMulta] = useState(null);
  const [error, setError] = useState("");

  const load = () =>
    getMultaRequest(id)
      .then(setMulta)
      .catch((err) => setError(parseApiError(err).message));

  useEffect(() => {
    load();
  }, [id]);

  return (
    <SlideOverPanel closeTo="/finanzas/multas">
      <div className="flex flex-col gap-5">
        <BackLink to="/finanzas/multas" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
          &larr; Multas
        </BackLink>
        <Alert>{error}</Alert>
        {!multa && !error && <PageLoader />}
        {multa && (
          <MultaChoferCard
            multa={multa}
            onChanged={() => {
              refresh();
              load();
            }}
          />
        )}
      </div>
    </SlideOverPanel>
  );
};

export const MultaDetailPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  return isPrivileged ? <MultaOficinaDetail /> : <MultaChoferDetail />;
};
