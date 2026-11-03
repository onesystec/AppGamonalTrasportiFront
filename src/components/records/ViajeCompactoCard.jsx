import clsx from "clsx";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { ChevronDownIcon, RouteIcon } from "../ui/icons";
import { StatusBadge } from "../ui/StatusBadge";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { formatKmValue, moveItem, sortByEta } from "../../lib/compactado";
import { formatDateTime } from "../../lib/format";
import { KmRepartoEditor } from "./KmRepartoEditor";
import { KmViajeResumen } from "./KmViajeResumen";
import { descompactarRequest, reordenarCompactadoRequest } from "../../lib/records.api";

// Detalle de un servicio que va en un viaje compacto: las paradas en orden, cual es el principal y como se
// carga todo. La oficina puede reordenar las paradas o deshacer el viaje; el chofer solo lo ve.
export const ViajeCompactoCard = ({ record, isChofer, onChanged }) => {
  const viaje = record.compactado;
  const location = useLocation();
  const { refresh } = useDataRefresh("records");
  const [order, setOrder] = useState(viaje?.servicios ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingKm, setEditingKm] = useState(false);

  useEffect(() => {
    setOrder(viaje?.servicios ?? []);
  }, [viaje]);

  if (!viaje) return null;

  const dirty = order.some((s, i) => s.id !== viaje.servicios[i]?.id);
  const principalHasHours = Boolean(record.jornada?.estado) && viaje.principal;

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
      refresh();
      onChanged?.();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = () => run(() => reordenarCompactadoRequest(viaje.id, order.map((s) => s.id)));
  const handleUndo = () => {
    if (!window.confirm("¿Deshacer el viaje compacto? Los servicios vuelven a ser independientes.")) return;
    return run(() => descompactarRequest(viaje.id));
  };

  return (
    <section className="mt-6 rounded-2xl border border-accent-500/30 bg-accent-500/[0.06] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink-50">
          <RouteIcon className="h-5 w-5 text-accent-400" />
          Viaje compacto · {viaje.total} servicios
        </h3>
        <span
          className={clsx(
            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            viaje.principal ? "bg-success-500/15 text-success-500" : "bg-line/10 text-ink-300"
          )}
        >
          {viaje.principal ? "Servicio principal" : `Parada ${viaje.orden} de ${viaje.total}`}
        </span>
      </div>

      <ol className="mt-3 flex flex-col gap-1.5">
        {order.map((s, index) => {
          const current = s.id === record.id;
          return (
            <li
              key={s.id}
              className={clsx(
                "flex items-center gap-2 rounded-xl px-3 py-2",
                current ? "bg-accent-500/15 ring-1 ring-accent-500/40" : "bg-line/[0.05]"
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-[12px] font-semibold text-accent-300">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink-50">
                  {current ? (
                    <span className="font-semibold">{s.codigo}</span>
                  ) : (
                    <Link
                      to={`/records/${s.id}`}
                      state={{ backgroundLocation: location.state?.backgroundLocation ?? location }}
                      replace
                      className="font-semibold text-accent-300 hover:underline"
                    >
                      {s.codigo}
                    </Link>
                  )}{" "}
                  · {s.destinazione}
                  {index === 0 && <span className="ml-2 text-[10px] font-semibold uppercase text-success-500">Principal</span>}
                </span>
                <span className="block text-[11px] text-ink-400">
                  ETA {formatDateTime(s.eta)} · Plan {formatKmValue(s.kmPlan)}
                  {s.kmReal != null && ` · Real ${formatKmValue(s.kmReal)}`}
                  {s.recibidoDe && <span className="text-accent-400"> · recibido de {s.recibidoDe}</span>}
                </span>
              </span>
              <StatusBadge status={s.estado} className="px-2 py-0.5 text-[10px]" />
              {!isChofer && !principalHasHours && (
                <span className="flex shrink-0">
                  <button
                    type="button"
                    aria-label="Subir"
                    disabled={busy || index === 0}
                    onClick={() => setOrder((prev) => moveItem(prev, index, -1))}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-ink-300 hover:bg-line/10 disabled:opacity-30"
                  >
                    <ChevronDownIcon className="h-4 w-4 rotate-180" />
                  </button>
                  <button
                    type="button"
                    aria-label="Bajar"
                    disabled={busy || index === order.length - 1}
                    onClick={() => setOrder((prev) => moveItem(prev, index, 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-ink-300 hover:bg-line/10 disabled:opacity-30"
                  >
                    <ChevronDownIcon className="h-4 w-4" />
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {!isChofer && <KmViajeResumen km={viaje.km} servicios={viaje.servicios} className="mt-3 rounded-xl bg-line/[0.05] px-3 py-2.5" />}

      {!isChofer && editingKm && (
        <KmRepartoEditor
          viaje={viaje}
          onClose={() => setEditingKm(false)}
          onSaved={() => {
            setEditingKm(false);
            refresh();
            onChanged?.();
          }}
        />
      )}

      <p className="mt-3 text-[12px] text-ink-300">
        {viaje.principal
          ? "Las horas, los peajes y el carburante de todo el viaje se cargan aquí, una sola vez."
          : `Las horas, los peajes y el carburante de este viaje se cargan una sola vez en ${viaje.principalCodigo}.`}{" "}
        Se paga como un solo viaje.
      </p>

      <Alert>{error}</Alert>

      {!isChofer && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {!editingKm && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditingKm(true)}
              className="text-[12px] font-medium text-accent-400 hover:text-accent-300 disabled:opacity-40"
            >
              {viaje.km?.real != null ? "Ajustar reparto de km" : "Cargar km del viaje"}
            </button>
          )}
          {!principalHasHours && (
            <>
              <button
                type="button"
                disabled={busy || order.length < 2}
                onClick={() => setOrder(sortByEta(order))}
                className="text-[12px] font-medium text-accent-400 hover:text-accent-300 disabled:opacity-40"
              >
                Ordenar por ETA
              </button>
              {dirty && (
                <Button onClick={handleSave} loading={busy} className="sm:w-auto sm:px-5 sm:py-1.5 sm:text-[13px]">
                  Guardar orden
                </Button>
              )}
            </>
          )}
          {!principalHasHours && (
            <button
              type="button"
              disabled={busy}
              onClick={handleUndo}
              className="ml-auto text-[12px] font-medium text-danger-500 hover:underline disabled:opacity-40"
            >
              Deshacer viaje
            </button>
          )}
        </div>
      )}
    </section>
  );
};
