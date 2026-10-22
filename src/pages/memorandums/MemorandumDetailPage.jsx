import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { PageLoader } from "../../components/ui/PageLoader";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { openPdfFromRequest } from "../../lib/bustaPaga";
import { CARGO_LABELS } from "../../lib/constants";
import { formatDateTime } from "../../lib/format";
import { NIVEL_LABELS, progresoLabel } from "../../lib/memorandums";
import {
  deleteMemorandumRequest,
  getMemorandumEmitidoRequest,
  getMemorandumFileRequest,
  remindMemorandumRequest,
} from "../../lib/memorandums.api";

// Seguimiento de un memorandum emitido: quien ya confirmo (con hora, dispositivo y firma) y quien falta, con el recordatorio a mano.
export const MemorandumDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEmit = user?.cargo === "OWNER" || user?.cargo === "RRHH" || user?.cargo === "ADMIN";

  const [memo, setMemo] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [firmaVista, setFirmaVista] = useState(null);

  const load = useCallback(() => {
    getMemorandumEmitidoRequest(id)
      .then(setMemo)
      .catch((err) => setError(parseApiError(err).message));
  }, [id]);

  useEffect(() => {
    if (canEmit) load();
  }, [canEmit, load]);

  if (!canEmit) return <Navigate to="/memorandums" replace />;
  if (!memo && !error) return <PageLoader />;
  if (!memo) {
    return (
      <div className="flex flex-col gap-4">
        <Link to="/memorandums?tab=emitidos" className="text-[13px] font-medium text-accent-400">← Memorándums</Link>
        <Alert>{error}</Alert>
      </div>
    );
  }

  const pendientes = memo.destinatarios.filter((d) => !d.firmado);
  const nadieFirmo = memo.firmados === 0;

  const handleView = async () => {
    setError("");
    setBusy("ver");
    try {
      await openPdfFromRequest(() => getMemorandumFileRequest(memo.id));
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy("");
    }
  };

  const handleRemind = async () => {
    setError("");
    setInfo("");
    setBusy("recordar");
    try {
      const r = await remindMemorandumRequest(memo.id);
      setInfo(
        r.avisados > 0
          ? `Recordatorio enviado a ${r.avisados} persona(s).`
          : "Ya se les avisó hace menos de 30 minutos. Espera un poco antes de volver a recordarles."
      );
      load();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy("");
    }
  };

  const handleDelete = async () => {
    setError("");
    setBusy("eliminar");
    try {
      await deleteMemorandumRequest(memo.id);
      navigate("/memorandums?tab=emitidos", { replace: true });
    } catch (err) {
      setError(parseApiError(err).message);
      setConfirmDelete(false);
      setBusy("");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/memorandums?tab=emitidos" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
          ← Memorándums
        </Link>
        <p className="mt-3 text-[12px] font-medium uppercase tracking-wide text-ink-400">
          {memo.numero} · {memo.tipoLabel}
        </p>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink-50">{memo.titulo}</h1>
        <p className="mt-1 text-[13px] text-ink-300">
          Emitido el {formatDateTime(memo.createdAt)} por {memo.emisor} ({memo.emisorRol}) · Para: {memo.audiencia} · {NIVEL_LABELS[memo.nivelFirma]}
          {memo.plazoAt ? ` · Confirmar antes del ${formatDateTime(memo.plazoAt)}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" className="!w-auto px-5 py-2.5 text-[14px]" loading={busy === "ver"} onClick={handleView}>
          Ver documento
        </Button>
        {pendientes.length > 0 && (
          <Button className="!w-auto px-5 py-2.5 text-[14px]" loading={busy === "recordar"} onClick={handleRemind}>
            Recordar a quienes faltan ({pendientes.length})
          </Button>
        )}
        {nadieFirmo && !confirmDelete && (
          <Button variant="ghost" className="!w-auto px-5 py-2.5 text-[14px] text-danger-500" onClick={() => setConfirmDelete(true)}>
            Eliminar
          </Button>
        )}
      </div>

      {confirmDelete && (
        <GlassCard>
          <p className="text-[14px] text-ink-50">¿Eliminar este memorándum? Nadie lo ha firmado todavía, así que se borra para todos.</p>
          <div className="mt-3 flex gap-2">
            <Button variant="danger" className="!w-auto px-5 py-2 text-[14px]" loading={busy === "eliminar"} onClick={handleDelete}>
              Sí, eliminar
            </Button>
            <Button variant="ghost" className="!w-auto px-5 py-2 text-[14px]" disabled={busy === "eliminar"} onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
          </div>
        </GlassCard>
      )}

      <Alert>{error}</Alert>
      {info && <Alert variant="success">{info}</Alert>}

      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[17px] font-semibold text-ink-50">Confirmaciones</h2>
          <span
            className={clsx(
              "rounded-full px-3 py-1 text-[12px] font-medium",
              memo.firmados === memo.total ? "bg-success-500/15 text-success-500" : "bg-warning-500/20 text-warning-500"
            )}
          >
            {progresoLabel(memo)}
          </span>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {memo.destinatarios.map((d) => (
            <div key={d.id} className="glass-surface-sm flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3">
              <div className="min-w-0">
                <span className="block text-[15px] font-medium text-ink-50">
                  {d.nombre} <span className="text-[12px] font-normal text-ink-400">· {CARGO_LABELS[d.cargo] ?? d.cargo}</span>
                </span>
                <span className="block text-[12px] text-ink-400">
                  {d.firmado
                    ? `Confirmó el ${formatDateTime(d.firmadoAt)}${d.firmaIp ? ` · IP ${d.firmaIp}` : ""}`
                    : `Pendiente · ${d.avisos} aviso(s)${d.ultimoAvisoAt ? `, el último el ${formatDateTime(d.ultimoAvisoAt)}` : ""}`}
                </span>
                {d.firmado && d.firmaDispositivo && <span className="block max-w-xl truncate text-[11px] text-ink-500">{d.firmaDispositivo}</span>}
              </div>
              {d.firmado ? (
                d.firmaUrl ? (
                  <button type="button" onClick={() => setFirmaVista(firmaVista === d.id ? null : d.id)} className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
                    {firmaVista === d.id ? "Ocultar firma" : "Ver firma"}
                  </button>
                ) : (
                  <span className="rounded-full bg-success-500/15 px-3 py-1 text-[12px] font-medium text-success-500">Confirmado</span>
                )
              ) : (
                <span className="rounded-full bg-warning-500/20 px-3 py-1 text-[12px] font-medium text-warning-500">Pendiente</span>
              )}
              {firmaVista === d.id && d.firmaUrl && <img src={d.firmaUrl} alt={`Firma de ${d.nombre}`} className="w-full max-w-sm rounded-lg bg-white" />}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};
