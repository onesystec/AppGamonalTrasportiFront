import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FirmarMemorandumModal } from "../../components/memorandums/FirmarMemorandumModal";
import { MEMORANDUMS_CHANGED } from "../../components/memorandums/MemorandumsPendientesBanner";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Spinner } from "../../components/ui/Spinner";
import { ChevronRightIcon, FileTextIcon, PlusIcon } from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { openPdfFromRequest } from "../../lib/bustaPaga";
import { formatDateTime } from "../../lib/format";
import { progresoLabel } from "../../lib/memorandums";
import {
  getMemorandumFileRequest,
  listMemorandumsEmitidosRequest,
  listMemorandumsRecibidosRequest,
} from "../../lib/memorandums.api";

const Pill = ({ tone, children }) => (
  <span
    className={clsx(
      "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
      tone === "warning" && "bg-warning-500/20 text-warning-500",
      tone === "danger" && "bg-danger-500/15 text-danger-500",
      tone === "success" && "bg-success-500/15 text-success-500",
      tone === "muted" && "bg-line/10 text-ink-300"
    )}
  >
    {children}
  </span>
);

const Recibido = ({ memo, onOpen, onConfirm, opening }) => {
  const vencido = !memo.firmado && memo.plazoAt && new Date(memo.plazoAt) < new Date();
  return (
    <div className="glass-surface-sm flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium text-ink-400">{memo.numero}</span>
          <Pill tone="muted">{memo.tipoLabel}</Pill>
          {!memo.firmado && <Pill tone={vencido ? "danger" : "warning"}>{vencido ? "Plazo vencido" : "Pendiente"}</Pill>}
        </div>
        <span className="mt-1 block text-[15px] font-medium text-ink-50">{memo.titulo}</span>
        <span className="block text-[12px] text-ink-400">
          De {memo.emisor} ({memo.emisorRol}) · {formatDateTime(memo.createdAt)}
          {!memo.firmado && memo.plazoAt ? ` · confirmar antes del ${formatDateTime(memo.plazoAt)}` : ""}
          {memo.firmado ? ` · confirmado el ${formatDateTime(memo.firmadoAt)}` : ""}
        </span>
      </div>
      {memo.firmado ? (
        <Button variant="ghost" className="!w-auto px-4 py-2 text-[13px]" loading={opening} onClick={() => onOpen(memo)}>
          Ver
        </Button>
      ) : (
        <Button className="!w-auto px-4 py-2 text-[13px]" onClick={() => onConfirm(memo)}>
          {memo.nivelFirma === "FIRMA" ? "Firmar y abrir" : "Confirmar y abrir"}
        </Button>
      )}
    </div>
  );
};

const Emitido = ({ memo }) => (
  <Link
    to={`/memorandums/emitidos/${memo.id}`}
    className="glass-surface-sm flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 transition-colors hover:bg-line/10"
  >
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-medium text-ink-400">{memo.numero}</span>
        <Pill tone="muted">{memo.tipoLabel}</Pill>
        <Pill tone={memo.firmados === memo.total ? "success" : "warning"}>{progresoLabel(memo)}</Pill>
      </div>
      <span className="mt-1 block text-[15px] font-medium text-ink-50">{memo.titulo}</span>
      <span className="block text-[12px] text-ink-400">
        {memo.audiencia} · {formatDateTime(memo.createdAt)}
        {memo.emisor ? ` · ${memo.emisor}` : ""}
      </span>
    </div>
    <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-400" />
  </Link>
);

// Memorandums: lo que recibe cada persona (para abrir cada uno primero confirma o firma) y, para el Admin, Recursos Humanos y los Responsables,
// lo que emitieron con el seguimiento de quien ya confirmo.
export const MemorandumsPage = () => {
  const { user } = useAuth();
  const canEmit = user?.cargo === "OWNER" || user?.cargo === "RRHH" || user?.cargo === "ADMIN";
  const [params, setParams] = useSearchParams();
  const tab = canEmit && params.get("tab") === "emitidos" ? "emitidos" : "recibidos";

  const [recibidos, setRecibidos] = useState(null);
  const [emitidos, setEmitidos] = useState(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(null);
  const [openingId, setOpeningId] = useState(null);

  const loadRecibidos = useCallback(() => {
    listMemorandumsRecibidosRequest()
      .then(setRecibidos)
      .catch((err) => setError(parseApiError(err).message));
  }, []);

  useEffect(() => {
    loadRecibidos();
  }, [loadRecibidos]);

  useEffect(() => {
    if (tab !== "emitidos" || emitidos) return;
    listMemorandumsEmitidosRequest()
      .then(setEmitidos)
      .catch((err) => setError(parseApiError(err).message));
  }, [tab, emitidos]);

  const handleOpen = async (memo) => {
    setError("");
    setOpeningId(memo.id);
    try {
      await openPdfFromRequest(() => getMemorandumFileRequest(memo.id));
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setOpeningId(null);
    }
  };

  const pendientes = recibidos?.filter((m) => !m.firmado) ?? [];
  const confirmados = recibidos?.filter((m) => m.firmado) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink-50">Memorándums</h1>
          <p className="mt-1 text-[14px] text-ink-300">
            Comunicados oficiales de la empresa. Para abrir cada uno tienes que confirmar que lo recibes.
          </p>
        </div>
        {canEmit && (
          <Link
            to="/memorandums/nuevo"
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-[14px] font-semibold text-brand-foreground hover:bg-brand-light"
          >
            <PlusIcon className="h-4 w-4" />
            Nuevo memorándum
          </Link>
        )}
      </div>

      {canEmit && (
        <SegmentedControl
          value={tab}
          onChange={(value) => setParams(value === "emitidos" ? { tab: "emitidos" } : {}, { replace: true })}
          options={[
            { value: "recibidos", label: `Recibidos${pendientes.length ? ` (${pendientes.length})` : ""}` },
            { value: "emitidos", label: "Emitidos" },
          ]}
        />
      )}

      <Alert>{error}</Alert>

      {tab === "recibidos" ? (
        <GlassCard>
          {recibidos === null && !error && <Spinner />}
          {recibidos?.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <FileTextIcon className="h-8 w-8 text-ink-500" />
              <p className="text-[14px] text-ink-400">Todavía no has recibido ningún memorándum.</p>
            </div>
          )}
          {pendientes.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-warning-500">Pendientes de confirmar</h2>
              {pendientes.map((m) => (
                <Recibido key={m.id} memo={m} onOpen={handleOpen} onConfirm={setConfirming} opening={openingId === m.id} />
              ))}
            </div>
          )}
          {confirmados.length > 0 && (
            <div className={clsx("flex flex-col gap-2", pendientes.length > 0 && "mt-6")}>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-400">Historial</h2>
              {confirmados.map((m) => (
                <Recibido key={m.id} memo={m} onOpen={handleOpen} onConfirm={setConfirming} opening={openingId === m.id} />
              ))}
            </div>
          )}
        </GlassCard>
      ) : (
        <GlassCard>
          {emitidos === null && !error && <Spinner />}
          {emitidos?.length === 0 && (
            <p className="py-6 text-center text-[14px] text-ink-400">Todavía no has emitido ningún memorándum.</p>
          )}
          <div className="flex flex-col gap-2">
            {emitidos?.map((m) => (
              <Emitido key={m.id} memo={m} />
            ))}
          </div>
        </GlassCard>
      )}

      {confirming && (
        <FirmarMemorandumModal
          memo={confirming}
          onClose={() => setConfirming(null)}
          onConfirmed={() => {
            setConfirming(null);
            loadRecibidos();
            window.dispatchEvent(new Event(MEMORANDUMS_CHANGED));
          }}
        />
      )}
    </div>
  );
};
