import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";
import { ClipboardListIcon, CloseIcon } from "../ui/icons";
import { EstadoPill, SolicitudDetalle } from "./SolicitudDetalle";
import { SolicitudWhatsappButton } from "./SolicitudWhatsappButton";
import { parseApiError } from "../../lib/api";
import { startVisibleInterval } from "../../lib/polling";
import { AREAS_BY_KEY } from "../../lib/recordAreas";
import { SOLICITUDES_CHANGED_EVENT } from "../../lib/solicitudes";
import { listSolicitudesOficinaRequest, rechazarSolicitudRequest } from "../../lib/solicitudes.api";

const REFRESH_MS = 60 * 1000;

// Area del registro real donde se carga cada tipo de solicitud (Extra Piazza arranca en Milano; la zona se cambia en el formulario).
const AREA_POR_SERVICIO = { DHL_MILANO: "dhl-milano", DHL_ROMA: "dhl-roma", AB_SERVICE: "ab-service", EXTRA_PIAZZA: "piazza-milano" };

const SolicitudCard = ({ solicitud, onComplete, onRejected }) => {
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pendiente = solicitud.estado === "PENDIENTE";

  const handleReject = async () => {
    setSaving(true);
    setError("");
    try {
      await rechazarSolicitudRequest(solicitud.id, motivo.trim());
      onRejected();
    } catch (err) {
      setError(parseApiError(err).message);
      setSaving(false);
    }
  };

  return (
    <li className="glass-surface-sm rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[15px] font-semibold text-ink-50">{solicitud.cliente}</span>
        <EstadoPill estado={solicitud.estado} />
      </div>
      <SolicitudDetalle solicitud={solicitud} />
      <Alert>{error}</Alert>
      <div className="mt-4 flex flex-wrap items-start gap-2">
        {pendiente && (
          <Button className="!w-auto px-4 py-2 text-[13px]" onClick={() => onComplete(solicitud)}>
            Completar y aceptar
          </Button>
        )}
        <SolicitudWhatsappButton solicitud={solicitud} />
        {pendiente && !rechazando && (
          <Button variant="ghost" className="!w-auto px-4 py-2 text-[13px] text-danger-500" onClick={() => setRechazando(true)}>
            Rechazar
          </Button>
        )}
      </div>
      {pendiente && rechazando && (
        <div className="mt-3 flex flex-col gap-2">
          <Textarea id={`motivo-${solicitud.id}`} label="Motivo (lo ve el cliente)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="!w-auto px-4 py-2 text-[13px]" onClick={() => setRechazando(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="danger" className="!w-auto px-4 py-2 text-[13px]" loading={saving} onClick={handleReject}>
              Confirmar rechazo
            </Button>
          </div>
        </div>
      )}
    </li>
  );
};

const SolicitudesModal = ({ onClose, onChanged }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [verRevisadas, setVerRevisadas] = useState(false);
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    return listSolicitudesOficinaRequest(verRevisadas ? "TODAS" : "PENDIENTE")
      .then((list) => setItems(verRevisadas ? list.filter((s) => s.estado !== "PENDIENTE") : list))
      .catch((err) => setError(parseApiError(err).message));
  }, [verRevisadas]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Completar = abrir el formulario real del servicio con los datos de la solicitud; al crearlo la solicitud queda aceptada.
  const handleComplete = (solicitud) => {
    const area = AREAS_BY_KEY[AREA_POR_SERVICIO[solicitud.servicio]];
    onClose();
    navigate(area.newPath, { state: { backgroundLocation: location, ...area.newState, solicitud } });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-backdrop backdrop-blur-sm" />
      <div className="glass-surface relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-3 border-b border-line/10 px-5 pb-3 pt-5">
          <div>
            <h2 className="text-[18px] font-semibold text-ink-50">Solicitudes de servicio</h2>
            <p className="mt-0.5 text-[12px] text-ink-300">Registros limitados que cargan los clientes. Completa el servicio real para aceptarlos.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-ink-300 hover:bg-line/10 hover:text-ink-50">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex gap-2 px-5 pt-3">
          {[
            [false, "Pendientes"],
            [true, "Revisadas"],
          ].map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setVerRevisadas(value)}
              className={clsx("rounded-full px-4 py-1.5 text-[13px] font-medium", verRevisadas === value ? "bg-line/15 text-ink-50" : "text-ink-300 hover:text-ink-50")}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Alert>{error}</Alert>
          {!items && !error && <p className="py-6 text-center text-[13px] text-ink-300">Cargando…</p>}
          {items?.length === 0 && <p className="py-8 text-center text-[14px] text-ink-300">{verRevisadas ? "No hay solicitudes revisadas." : "No hay solicitudes pendientes."}</p>}
          <ul className="flex flex-col gap-3">
            {(items ?? []).map((s) => (
              <SolicitudCard
                key={s.id}
                solicitud={s}
                onComplete={handleComplete}
                onRejected={() => {
                  load();
                  onChanged();
                }}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Boton "Solicitudes" del registro principal, con el numero de pendientes. Se actualiza solo y cuando se acepta una solicitud.
export const SolicitudesButton = () => {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

  const loadCount = useCallback(
    () =>
      listSolicitudesOficinaRequest("PENDIENTE")
        .then((list) => setCount(list.length))
        .catch(() => {}),
    []
  );

  useEffect(() => {
    loadCount();
    window.addEventListener(SOLICITUDES_CHANGED_EVENT, loadCount);
    const stop = startVisibleInterval(loadCount, REFRESH_MS);
    return () => {
      window.removeEventListener(SOLICITUDES_CHANGED_EVENT, loadCount);
      stop();
    };
  }, [loadCount]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-line/25 px-5 py-2.5 text-[14px] font-semibold text-ink-50 transition hover:bg-line/10"
      >
        <ClipboardListIcon className="h-4 w-4" />
        Solicitudes
        {count > 0 && <span className="rounded-full bg-warning-500 px-2 py-0.5 text-[11px] font-bold text-black">{count}</span>}
      </button>
      {open && <SolicitudesModal onClose={() => setOpen(false)} onChanged={loadCount} />}
    </>
  );
};
