import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { ChevronDownIcon } from "../ui/icons";
import { StatusBadge } from "../ui/StatusBadge";
import { parseApiError } from "../../lib/api";
import { MAX_SERVICIOS_VIAJE, moveItem, sortByEta } from "../../lib/compactado";
import { formatDateTime } from "../../lib/format";
import { compactarRequest, listCompactablesRequest } from "../../lib/records.api";

const chofer = (s) => (s.driver ? `${s.driver.nombre} ${s.driver.apellido}` : "Sin chofer");

// "Compactar": el Admin/Responsable junta 2 o mas servicios de un mismo chofer y vehiculo (un anulado puede ser de otro vehiculo) en un solo viaje.
// Sugiere los ultimos servicios creados (solo de sus areas; tambien los de ETA vencida o ya entregados sin horas); al elegir el primero, solo se pueden sumar los del
// mismo chofer y vehiculo. El orden de las paradas se puede dejar por ETA o ajustar a mano; el primero es el
// servicio principal (ahi se cargan las horas de todo el viaje).
export const CompactarModal = ({ open, onClose, onDone }) => {
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState([]); // ids en el orden del viaje
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setItems(null);
    setSelected([]);
    setLoadError("");
    setError("");
    let cancelled = false;
    listCompactablesRequest()
      .then((rows) => !cancelled && setItems(rows))
      .catch((err) => !cancelled && setLoadError(parseApiError(err).message));
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, saving, onClose]);

  const byId = useMemo(() => new Map((items ?? []).map((s) => [s.id, s])), [items]);
  const chosen = selected.map((id) => byId.get(id)).filter(Boolean);
  const lock = chosen[0] ?? null;
  // El vehiculo del viaje lo marca el primer servicio que se hizo: un servicio anulado puede ir en otro vehiculo (el chofer sigue con
  // otro servicio despues de anular).
  const vehiculoViaje = chosen.find((s) => s.estado !== "ANNULLATO")?.vehicle?.id ?? null;

  if (!open) return null;

  // Por que un servicio no se puede sumar al viaje que se esta armando.
  const blockedReason = (s) => {
    if (!lock || selected.includes(s.id)) return null;
    if (s.driver?.id !== lock.driver?.id) return "Otro chofer";
    if (s.estado !== "ANNULLATO" && vehiculoViaje && s.vehicle?.id !== vehiculoViaje) return "Otro vehículo";
    if (selected.length >= MAX_SERVICIOS_VIAJE) return `Máximo ${MAX_SERVICIOS_VIAJE}`;
    return null;
  };

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSubmit = async () => {
    setError("");
    setSaving(true);
    try {
      const viaje = await compactarRequest(selected);
      onDone?.(viaje);
      onClose();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => !saving && onClose()}
        className="absolute inset-0 bg-backdrop backdrop-blur-sm"
      />

      <div className="glass-surface relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-background">
        <div className="border-b border-line/10 px-6 pb-4 pt-6">
          <h2 className="text-[19px] font-semibold text-ink-50">Compactar servicios</h2>
          <p className="mt-1 text-[13px] text-ink-300">
            Junta 2 o más servicios que un chofer hace en un solo viaje, con el mismo vehículo. Las horas, los peajes y
            el carburante se cargan una sola vez para todo el viaje.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Alert>{loadError}</Alert>

          {/* Servicios sugeridos: los ultimos creados que siguen abiertos */}
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-400">
            Últimos servicios creados
          </h3>
          <p className="mt-1 text-[12px] text-ink-400">
            Aparecen también los que se cargaron cuando el viaje ya pasó (ETA vencida o ya entregados), mientras no tengan
            horas cargadas.
          </p>
          {items === null && !loadError && (
            <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-300">
              <Spinner className="h-4 w-4" /> Cargando…
            </p>
          )}
          {items?.length === 0 && (
            <p className="mt-3 text-[13px] text-ink-300">No hay servicios para compactar.</p>
          )}
          <div className="mt-2 flex flex-col gap-1.5">
            {items?.map((s) => {
              const on = selected.includes(s.id);
              const blocked = blockedReason(s);
              return (
                <label
                  key={s.id}
                  className={clsx(
                    "flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                    on ? "border-accent-500/60 bg-accent-500/10" : "border-line/10 hover:bg-line/[0.05]",
                    blocked ? "cursor-not-allowed opacity-45" : "cursor-pointer"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={Boolean(blocked) || saving}
                    onChange={() => toggle(s.id)}
                    className="mt-1 h-4 w-4 shrink-0 accent-accent-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-[13px] font-semibold text-ink-50">{s.codigo}</span>
                      <span className="truncate text-[13px] text-ink-100">{s.destinazione}</span>
                      <StatusBadge status={s.estado} className="px-2 py-0.5 text-[10px]" />
                    </span>
                    <span className="mt-0.5 block text-[12px] text-ink-400">
                      {chofer(s)} · {s.vehicle?.targa ?? "-"} · ETA {formatDateTime(s.eta)}
                      {new Date(s.eta) < new Date() ? " (vencida)" : ""}
                      {s.cliente ? ` · ${s.cliente}` : ""}
                    </span>
                    {s.recibidoDe && (
                      <span className="mt-0.5 block text-[11px] font-medium text-accent-400">
                        Paquete recibido de {s.recibidoDe.chofer} (traspaso de {s.recibidoDe.codigo})
                      </span>
                    )}
                  </span>
                  {blocked && <span className="shrink-0 text-[11px] font-medium text-warning-500">{blocked}</span>}
                </label>
              );
            })}
          </div>

          {/* Orden del viaje */}
          {chosen.length > 0 && (
            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-400">
                  Orden del viaje ({chosen.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setSelected(sortByEta(chosen).map((s) => s.id))}
                  disabled={chosen.length < 2}
                  className="text-[12px] font-medium text-accent-400 hover:text-accent-300 disabled:opacity-40"
                >
                  Ordenar por ETA
                </button>
              </div>
              <ol className="mt-2 flex flex-col gap-1.5">
                {chosen.map((s, index) => (
                  <li key={s.id} className="flex items-center gap-2 rounded-xl bg-line/[0.05] px-3 py-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-[12px] font-semibold text-accent-300">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink-50">
                        {s.codigo} · {s.destinazione}
                        {index === 0 && (
                          <span className="ml-2 rounded-full bg-success-500/15 px-2 py-0.5 text-[10px] font-semibold text-success-500">
                            Principal
                          </span>
                        )}
                      </span>
                      <span className="block text-[11px] text-ink-400">ETA {formatDateTime(s.eta)}</span>
                    </span>
                    <button
                      type="button"
                      aria-label="Subir"
                      disabled={index === 0}
                      onClick={() => setSelected((prev) => moveItem(prev, index, -1))}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-300 hover:bg-line/10 disabled:opacity-30"
                    >
                      <ChevronDownIcon className="h-4 w-4 rotate-180" />
                    </button>
                    <button
                      type="button"
                      aria-label="Bajar"
                      disabled={index === chosen.length - 1}
                      onClick={() => setSelected((prev) => moveItem(prev, index, 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-300 hover:bg-line/10 disabled:opacity-30"
                    >
                      <ChevronDownIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Quitar"
                      onClick={() => toggle(s.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-300 hover:bg-line/10"
                    >
                      <span aria-hidden="true" className="text-[16px] leading-none">
                        ×
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-[12px] text-ink-400">
                {chofer(chosen[0])} · {[...new Set(chosen.map((s) => s.vehicle?.targa ?? "-"))].join(" / ")}. El primero es el servicio principal: ahí se
                cargan las horas, los peajes y el carburante de todo el viaje.
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-line/10 px-6 py-4">
          <Alert>{error}</Alert>
          <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
            <Button variant="ghost" onClick={onClose} disabled={saving} className="sm:w-auto sm:px-6">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={saving} disabled={selected.length < 2} className="sm:w-auto sm:px-6">
              {selected.length < 2 ? "Elige al menos 2 servicios" : `Compactar ${selected.length} servicios`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
