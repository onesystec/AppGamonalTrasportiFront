import clsx from "clsx";
import { useEffect, useState } from "react";
import { parseApiError } from "../../lib/api";
import { getSpeedingSummaryRequest, listSpeedingEventsByVehicleRequest } from "../../lib/vehicles.api";
import { ChevronDownIcon } from "../ui/icons";
import { Spinner } from "../ui/Spinner";

const dateTimeLabel = (value) =>
  new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });

// Excesos de velocidad del vehiculo (se registran solos al pasar el umbral, ver SPEEDING_THRESHOLD_KMH en el backend). Va cerrado:
// solo se ve el titulo y, si hay, cuantos son; el detalle se abre a pedido. Naranja si es leve, rojo si pasa del umbral por 10.
export const VehicleSpeedingSection = ({ vehicleId }) => {
  const [events, setEvents] = useState(null);
  const [threshold, setThreshold] = useState(120);
  const [retentionDays, setRetentionDays] = useState(30);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setError("");
    Promise.all([listSpeedingEventsByVehicleRequest(vehicleId), getSpeedingSummaryRequest().catch(() => null)])
      .then(([list, summary]) => {
        if (cancelled) return;
        setEvents(list);
        if (summary?.thresholdKmh) setThreshold(summary.thresholdKmh);
        if (summary?.retentionDays) setRetentionDays(summary.retentionDays);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const count = events?.length ?? 0;
  const max = count ? Math.max(...events.map((e) => e.speedKmh)) : null;
  const disabled = events !== null && count === 0;

  return (
    <div className="mt-6 border-t border-line/10 pt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left disabled:cursor-default"
      >
        <h3 className="text-[13px] font-medium uppercase tracking-wide text-ink-400">Excesos de velocidad</h3>
        <span className="flex items-center gap-2 text-[12px]">
          {events === null && !error ? (
            <Spinner className="h-3.5 w-3.5 border-line/20 border-t-line" />
          ) : error ? (
            <span className="text-danger-500">No se pudo cargar</span>
          ) : count === 0 ? (
            <span className="text-ink-400">Ninguno en {retentionDays} días</span>
          ) : (
            <>
              <span className="text-ink-300">
                {count} {count === 1 ? "exceso" : "excesos"} · máx. {Math.round(max)} km/h
              </span>
              <ChevronDownIcon className={clsx("h-4 w-4 text-ink-400 transition-transform", open && "rotate-180")} />
            </>
          )}
        </span>
      </button>

      {open && count > 0 && (
        <ul className="mt-3 overflow-hidden rounded-xl border border-line/[0.08]">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-line/[0.07] px-4 py-2 text-[13px] first:border-t-0"
            >
              <span className="text-ink-200">{dateTimeLabel(event.occurredAt)}</span>
              <span
                className={clsx(
                  "font-semibold",
                  event.speedKmh >= threshold + 10 ? "text-danger-500" : "text-warning-500"
                )}
              >
                {Math.round(event.speedKmh)} km/h
                <span className="ml-2 text-[11px] font-normal text-ink-400">
                  +{Math.max(0, Math.round(event.speedKmh - threshold))} sobre el umbral
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
