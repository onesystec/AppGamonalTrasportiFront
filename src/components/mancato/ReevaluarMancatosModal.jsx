import clsx from "clsx";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { parseApiError } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { reevaluarMancatosRequest } from "../../lib/mancato.api";
import { romeToday } from "../../lib/mancato";

const CATEGORIA = {
  CRUZADO: { label: "Targa distinta", tone: "bg-danger-500/15 text-danger-500" },
  REASIGNADO: { label: "Otro servicio", tone: "bg-warning-500/20 text-warning-500" },
  NUEVO: { label: "Ahora con servicio", tone: "bg-success-500/15 text-success-500" },
  SIN_SERVICIO: { label: "Sin servicio", tone: "bg-line/10 text-ink-300" },
};

const Row = ({ item }) => (
  <div className="rounded-xl bg-line/[0.05] px-3.5 py-2.5 text-[13px]">
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-semibold text-ink-50">{item.numero}</span>
      <span className="text-ink-300">{item.targa}</span>
      {item.categoria && <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-medium", CATEGORIA[item.categoria]?.tone)}>{CATEGORIA[item.categoria]?.label}</span>}
      {item.fijado && <span className="rounded-full bg-accent-500/15 px-2 py-0.5 text-[11px] font-medium text-accent-400">Fijado a mano</span>}
    </div>
    <p className="mt-0.5 text-ink-400">
      {item.transitoAt ? `Tránsito ${formatDateTime(item.transitoAt)}` : "Sin hora"}
      {item.antes && (
        <>
          {" · "}
          <span className="text-ink-300">{item.antes.codigo ?? "sin servicio"}</span>
          {" → "}
          <span className="font-medium text-ink-50">{item.despues.codigo ?? "sin servicio"}</span>
        </>
      )}
      {item.motivo && ` · ${item.motivo}`}
    </p>
  </div>
);

const Section = ({ title, hint, items }) =>
  items.length === 0 ? null : (
    <div className="flex flex-col gap-2">
      <div>
        <h3 className="text-[14px] font-semibold text-ink-50">
          {title} ({items.length})
        </h3>
        {hint && <p className="text-[12px] text-ink-400">{hint}</p>}
      </div>
      {items.map((it) => (
        <Row key={it.id} item={it} />
      ))}
    </div>
  );

// Solo el Admin: vuelve a decidir a que servicio pertenece cada mancato de un mes (por ejemplo los importados de otra app, donde solo hay datos del
// peaje). Primero se simula y se ven los cambios; recien despues se aplican.
export const ReevaluarMancatosModal = ({ onClose, onApplied }) => {
  const [month, setMonth] = useState(romeToday().slice(0, 7));
  const [incluirFijados, setIncluirFijados] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, busy]);

  const run = async (aplicar) => {
    setError("");
    setBusy(aplicar ? "aplicar" : "simular");
    try {
      const res = await reevaluarMancatosRequest({ month, aplicar, incluirFijados });
      setResult(res);
      if (aplicar) onApplied?.();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy("");
    }
  };

  const r = result?.resumen;
  const stale = result && (result.month !== month || result.incluirFijados !== incluirFijados);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Cerrar" onClick={busy ? undefined : onClose} className="absolute inset-0 bg-backdrop backdrop-blur-sm" />
      <div className="glass-surface relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-t-3xl bg-background p-5 sm:rounded-3xl sm:p-6">
        <div>
          <h2 className="text-[19px] font-semibold text-ink-50">Reevaluar asignaciones de un mes</h2>
          <p className="mt-1 text-[13px] text-ink-300">
            Vuelve a decidir a qué servicio pertenece cada mancato del mes con la targa, la hora del tránsito y el chofer. Primero simula: no se guarda nada hasta que lo apliques.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-300">Mes</span>
            <input type="month" value={month} max={romeToday().slice(0, 7)} onChange={(e) => setMonth(e.target.value)} disabled={Boolean(busy)} className="glass-input rounded-xl px-4 py-2.5 text-[15px] text-ink-50" />
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-[13px] text-ink-200">
            <input type="checkbox" checked={incluirFijados} onChange={(e) => setIncluirFijados(e.target.checked)} disabled={Boolean(busy)} className="mt-0.5 h-4 w-4" />
            <span>Incluir también los que la oficina fijó a mano<br /><span className="text-[12px] text-ink-400">(los de otra targa siempre se corrigen)</span></span>
          </label>
          <Button onClick={() => run(false)} loading={busy === "simular"} disabled={!month || Boolean(busy)} variant="ghost" className="!w-auto px-5 py-2.5 text-[14px]">
            Simular
          </Button>
        </div>

        <Alert>{error}</Alert>

        {result && r && (
          <div className="flex flex-col gap-4">
            {result.aplicado && !stale && <Alert variant="success">Cambios aplicados: {r.cambian} mancato(s) reasignado(s).</Alert>}
            <div className="flex flex-wrap gap-2 text-[12px]">
              {[
                ["Del mes", r.total],
                ["Ya correctos", r.sinCambios],
                ["Cambian", r.cambian],
                ["De otra targa", r.cruzados],
                ["Fijados sin tocar", r.fijadosSinTocar],
                ["Sin hora", r.sinHora],
                ["Targa sin registrar", r.sinTarga],
              ].map(([label, value]) => (
                <span key={label} className="rounded-full bg-line/10 px-3 py-1 text-ink-200">
                  {label}: <strong className="text-ink-50">{value}</strong>
                </span>
              ))}
            </div>

            <Section title={result.aplicado ? "Cambios aplicados" : "Cambios que se harían"} items={result.cambios} />
            <Section
              title="Fijados a mano, sin tocar"
              hint="La oficina los asignó a mano con la targa correcta: se respetan. Si el servicio propuesto es mejor, márcalo en «Incluir los fijados a mano» y vuelve a simular, o cámbialo desde el detalle."
              items={result.fijadosSinTocar}
            />
            <Section title="No se pueden asignar" hint="Completa la hora o registra la targa en Vehículos y vuelve a reevaluar." items={result.noAsignables} />
            {r.cambian === 0 && r.fijadosSinTocar === 0 && r.sinHora === 0 && r.sinTarga === 0 && (
              <p className="text-[13px] text-ink-300">No hay nada que cambiar en este mes.</p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          {result && !result.aplicado && !stale && result.resumen.cambian > 0 && (
            <Button onClick={() => run(true)} loading={busy === "aplicar"} disabled={Boolean(busy)} className="sm:w-auto sm:px-8">
              Aplicar {result.resumen.cambian} cambio(s)
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={Boolean(busy)} className="sm:w-auto sm:px-8">
            Cerrar
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
