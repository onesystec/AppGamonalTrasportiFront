import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert } from "../ui/Alert";
import { CloseIcon, PencilIcon } from "../ui/icons";
import { parseApiError } from "../../lib/api";
import { getHistorialCambiosRequest, leerCambiosRequest, listCambiosRequest } from "../../lib/cambios.api";
import { startVisibleInterval } from "../../lib/polling";
import { formatFechaHora } from "../../lib/solicitudes";

const REFRESH_MS = 60 * 1000;

// Una linea "ETA: 03/11 08:30 → 02/11 09:45".
const LineaCambio = ({ c }) => (
  <li className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
    <span className="font-semibold text-ink-100">{c.label}:</span>
    <span className="text-ink-300 line-through decoration-ink-400/60">{c.anterior ?? "—"}</span>
    <span className="text-ink-400">→</span>
    <span className="font-medium text-ink-50">{c.nuevo ?? "—"}</span>
  </li>
);

const CambiosModal = ({ onClose, onRead }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  // Al abrir la lista se muestran los avisos con su punto de "no leido" y se marcan como vistos (el contador del boton baja).
  useEffect(() => {
    let cancelled = false;
    listCambiosRequest()
      .then(async (data) => {
        if (cancelled) return;
        setItems(data.items);
        const sinLeer = data.items.filter((i) => i.noLeida).map((i) => i.id);
        if (sinLeer.length) {
          await leerCambiosRequest(sinLeer).catch(() => {});
          onRead();
        }
      })
      .catch((err) => !cancelled && setError(parseApiError(err).message));
    return () => {
      cancelled = true;
    };
  }, [onRead]);

  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const abrir = (recordId) => {
    onClose();
    navigate(`/records/${recordId}`, { state: { backgroundLocation: location } });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-backdrop backdrop-blur-sm" />
      <div className="glass-surface relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-3 border-b border-line/10 px-5 pb-3 pt-5">
          <div>
            <h2 className="text-[18px] font-semibold text-ink-50">Cambios de los clientes</h2>
            <p className="mt-0.5 text-[12px] text-ink-300">Servicios ya entregados que un cliente editó en su hoja: qué cambió, quién y el valor anterior.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-ink-300 hover:bg-line/10 hover:text-ink-50">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Alert>{error}</Alert>
          {!items && !error && <p className="py-6 text-center text-[13px] text-ink-300">Cargando…</p>}
          {items?.length === 0 && <p className="py-8 text-center text-[14px] text-ink-300">Ningún cliente editó servicios entregados.</p>}
          <ul className="flex flex-col gap-3">
            {(items ?? []).map((a) => (
              <li key={a.id} className="glass-surface-sm rounded-2xl p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="flex items-center gap-2 text-[14px] font-semibold text-ink-50">
                      {a.noLeida && <span className="h-2 w-2 shrink-0 rounded-full bg-warning-500" title="No leído" />}
                      {a.titulo}
                    </span>
                    <span className="block text-[12px] text-ink-300">
                      {a.editor} · {formatFechaHora(a.updatedAt)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => abrir(a.recordId)}
                    className={clsx("shrink-0 rounded-full border border-line/25 px-3 py-1 text-[12px] font-semibold text-ink-50 transition hover:bg-line/10")}
                  >
                    Abrir servicio
                  </button>
                </div>
                <ul className="flex flex-col gap-1">
                  {a.cambios.map((c) => (
                    <LineaCambio key={c.campo} c={c} />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Boton "Cambios" del registro principal, con el numero de avisos sin leer (un cliente edito un servicio ya entregado). Se actualiza solo.
export const CambiosButton = () => {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

  const loadCount = useCallback(
    () =>
      listCambiosRequest()
        .then((data) => setCount(data.noLeidas))
        .catch(() => {}),
    []
  );

  useEffect(() => {
    loadCount();
    return startVisibleInterval(loadCount, REFRESH_MS);
  }, [loadCount]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-line/25 px-5 py-2.5 text-[14px] font-semibold text-ink-50 transition hover:bg-line/10"
      >
        <PencilIcon className="h-4 w-4" />
        Cambios
        {count > 0 && <span className="rounded-full bg-warning-500 px-2 py-0.5 text-[11px] font-bold text-black">{count}</span>}
      </button>
      {open && <CambiosModal onClose={() => setOpen(false)} onRead={loadCount} />}
    </>
  );
};

// Historial de cambios de un servicio (quien lo cambio, que y cuando), para su detalle. No muestra nada si nadie lo cambio.
export const CambiosDelServicio = ({ recordId }) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getHistorialCambiosRequest(recordId)
      .then((list) => !cancelled && setItems(list))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [recordId]);

  if (items.length === 0) return null;
  return (
    <section className="mt-6">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-400">Cambios del cliente</h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((c) => (
          <li key={c.id} className="text-[13px] text-ink-200">
            <span className="font-semibold text-ink-100">{c.label}:</span> <span className="text-ink-300 line-through decoration-ink-400/60">{c.anterior ?? "—"}</span> →{" "}
            <span className="font-medium text-ink-50">{c.nuevo ?? "—"}</span>
            <span className="block text-[12px] text-ink-400">
              {c.editor} · {formatFechaHora(c.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};
