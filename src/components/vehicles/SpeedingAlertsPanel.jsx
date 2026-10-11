import clsx from "clsx";
import { useEffect, useState } from "react";
import { parseApiError } from "../../lib/api";
import { getSpeedingSummaryRequest, listSpeedingEventsByVehicleRequest } from "../../lib/vehicles.api";
import { ChevronDownIcon, ZapIcon } from "../ui/icons";
import { PanelShell } from "../ui/PanelShell";
import { Spinner } from "../ui/Spinner";

const VEHICLES_PER_PAGE = 8;

const dateTimeLabel = (value) =>
  new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });

// Detalle de un vehiculo: sus excesos con el chofer que manejaba. Se pide al abrir la fila, no antes.
const VehicleEvents = ({ vehicleId, threshold }) => {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    listSpeedingEventsByVehicleRequest(vehicleId)
      .then((list) => !cancelled && setEvents(list))
      .catch((err) => !cancelled && setError(parseApiError(err).message));
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  if (error) return <p className="px-3 py-2 text-[12px] text-danger-500">{error}</p>;
  if (events === null) {
    return (
      <div className="flex justify-center py-3">
        <Spinner className="h-4 w-4 border-line/20 border-t-line" />
      </div>
    );
  }
  return (
    <ul className="mt-1 overflow-hidden rounded-lg border border-line/[0.08]">
      {events.map((event) => (
        <li key={event.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-t border-line/[0.07] px-3 py-1.5 text-[12px] first:border-t-0">
          <span className="text-ink-200">{dateTimeLabel(event.occurredAt)}</span>
          <span className="text-ink-300">{event.driver ?? "Sin servicio en ese momento"}</span>
          <span className={clsx("font-semibold", event.speedKmh >= threshold + 10 ? "text-danger-500" : "text-warning-500")}>
            {Math.round(event.speedKmh)} km/h
          </span>
        </li>
      ))}
    </ul>
  );
};

// Excesos de velocidad de los vehiculos (solo la oficina; un Responsable ve los de su asignacion). Va cerrado y no pide nada hasta que se abre:
// asi no se descargan todos los avisos de golpe. Primero un resumen por vehiculo (los que mas excesos tienen arriba) y el detalle de cada uno se
// abre a pedido. El aviso en vivo le llega solo al chofer que iba al volante; aqui queda el registro.
export const SpeedingAlertsPanel = () => {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [shown, setShown] = useState(VEHICLES_PER_PAGE);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && summary === null && !error) {
      getSpeedingSummaryRequest()
        .then(setSummary)
        .catch((err) => setError(parseApiError(err).message));
    }
  };

  const threshold = summary?.thresholdKmh ?? 120;
  const vehicles = summary?.vehicles ?? [];

  return (
    <PanelShell
      icon={ZapIcon}
      title="Avisos de velocidad"
      aside={
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium text-accent-400 hover:text-accent-300"
        >
          {open ? "Ocultar" : "Ver"}
          <ChevronDownIcon className={clsx("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
      }
    >
      {!open ? (
        <p className="text-[12px] text-ink-400">
          Excesos de velocidad de los vehículos. Se cargan solo cuando los abres.
        </p>
      ) : error ? (
        <p className="text-[13px] text-danger-500">{error}</p>
      ) : summary === null ? (
        <div className="flex justify-center py-3">
          <Spinner className="h-5 w-5 border-line/20 border-t-line" />
        </div>
      ) : vehicles.length === 0 ? (
        <p className="text-[13px] text-ink-300">Ningún exceso en los últimos {summary.retentionDays} días.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-[12px] text-ink-400">
            {summary.total} {summary.total === 1 ? "exceso" : "excesos"} en {summary.retentionDays} días · límite {threshold} km/h
          </p>
          {vehicles.slice(0, shown).map((v) => {
            const isOpen = expanded === v.vehicleId;
            return (
              <div key={v.vehicleId} className="rounded-xl border border-line/[0.07]">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : v.vehicleId)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px]"
                >
                  <span
                    className={clsx(
                      "h-2 w-2 shrink-0 rounded-full",
                      v.count >= 5 || v.maxSpeedKmh >= threshold + 10 ? "bg-danger-500" : "bg-warning-500"
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ink-50">{v.targa}</span>
                    <span className="block truncate text-[12px] text-ink-400">
                      {v.count} {v.count === 1 ? "exceso" : "excesos"} · máx. {Math.round(v.maxSpeedKmh)} km/h
                    </span>
                  </span>
                  <ChevronDownIcon className={clsx("h-4 w-4 shrink-0 text-ink-400 transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="px-2 pb-2">
                    <VehicleEvents vehicleId={v.vehicleId} threshold={threshold} />
                  </div>
                )}
              </div>
            );
          })}
          {vehicles.length > shown && (
            <button
              type="button"
              onClick={() => setShown((n) => n + VEHICLES_PER_PAGE)}
              className="self-start text-[12px] font-medium text-accent-400 hover:text-accent-300"
            >
              Ver {Math.min(VEHICLES_PER_PAGE, vehicles.length - shown)} más
            </button>
          )}
        </div>
      )}
    </PanelShell>
  );
};
