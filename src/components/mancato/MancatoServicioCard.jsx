import clsx from "clsx";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { GlassCard } from "../ui/GlassCard";
import { Spinner } from "../ui/Spinner";
import { CheckCircleIcon, ClockIcon, TruckIcon } from "../ui/icons";
import { parseApiError } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { TRAMO_LABELS, asignacionInfo, formatTransito } from "../../lib/mancato";
import { listMancatoCandidatesRequest } from "../../lib/mancato.api";

// A que servicio pertenece este peaje (lo calcula el sistema) y, para OWNER/ADMIN, como
// confirmarlo o cambiarlo. El chofer suele subir el peaje antes de que la oficina cargue el
// servicio: mientras tanto queda "Esperando servicio" y se asigna solo cuando aparece.
export const MancatoServicioCard = ({ mancato, isPrivileged, busy, onChange }) => {
  const location = useLocation();
  const [picking, setPicking] = useState(false);
  const [candidates, setCandidates] = useState(null);
  const [error, setError] = useState("");

  const info = asignacionInfo(mancato.asignacion);
  const servicio = mancato.servicio;
  const canConfirm = isPrivileged && servicio && ["SUGERIDO", "AUTO"].includes(mancato.asignacion);

  const openPicker = async () => {
    setPicking(true);
    setError("");
    if (candidates) return;
    try {
      setCandidates(await listMancatoCandidatesRequest(mancato.id));
    } catch (err) {
      setError(parseApiError(err).message);
    }
  };

  const choose = async (fields) => {
    setPicking(false);
    await onChange(fields);
  };

  return (
    <GlassCard>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink-50">
          <TruckIcon className="h-4 w-4 text-ink-300" />
          Servicio
        </h2>
        <span className="flex flex-wrap items-center gap-1.5">
          {isPrivileged && mancato.tramo && (
            <span className="rounded-full bg-line/10 px-2.5 py-1 text-[12px] font-medium text-ink-200">
              {TRAMO_LABELS[mancato.tramo]}
            </span>
          )}
          {isPrivileged && (
            <span className={clsx("rounded-full px-2.5 py-1 text-[12px] font-medium", info.pill)}>{info.label}</span>
          )}
        </span>
      </div>

      {formatTransito(mancato) && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-300">
          <ClockIcon className="h-3.5 w-3.5 shrink-0" />
          Tránsito: {formatTransito(mancato)}
        </p>
      )}

      {servicio ? (
        <Link
          to={`/records/${servicio.id}`}
          state={{ backgroundLocation: location }}
          className="mt-3 flex flex-col gap-0.5 rounded-xl bg-line/[0.06] px-4 py-3 transition-colors hover:bg-line/10"
        >
          <span className="text-[15px] font-semibold text-ink-50">{servicio.codigo}</span>
          <span className="text-[13px] text-ink-300">
            {[servicio.cliente, servicio.destinazione].filter(Boolean).join(" - ")}
          </span>
          <span className="text-[12px] text-ink-400">
            {servicio.fechaRetiro ? `Retiro ${formatDateTime(servicio.fechaRetiro)}` : "Sin Fecha de retiro"}
            {" - "}ETA {formatDateTime(servicio.eta)}
            {servicio.driver && ` - ${servicio.driver.nombre} ${servicio.driver.apellido}`}
            {servicio.targa && ` - ${[servicio.targa, servicio.targaFinal].filter(Boolean).join(" / ")}`}
          </span>
          {servicio.targaNoCoincide && (
            <span className="mt-1 rounded-lg bg-danger-500/10 px-2.5 py-1.5 text-[12px] font-medium text-danger-500">
              La targa del mancato ({mancato.targa}) no coincide con la de este servicio. Corrige la targa o elige otro servicio.
            </span>
          )}
        </Link>
      ) : (
        <p className="mt-3 text-[14px] text-ink-300">
          {!isPrivileged
            ? "La empresa lo asignará a tu servicio."
            : mancato.asignacion === "EN_ESPERA"
            ? "Todavía no hay un servicio de este vehículo que concuerde. Cuando la oficina cargue el servicio (con su Fecha de retiro) se asignará solo."
            : "Este peaje no pertenece a ningún servicio."}
        </p>
      )}

      {isPrivileged && mancato.asignacionMotivo && (
        <p className={clsx("mt-2 text-[12px]", info.tone)}>{mancato.asignacionMotivo}</p>
      )}
      {isPrivileged && mancato.asignacion === "EN_ESPERA" && mancato.esperaHasta && (
        <p className="mt-1 text-[12px] text-ink-400">
          Si no aparece un servicio antes del {formatDateTime(mancato.esperaHasta)}, pasa a "Fuera del horario
          laboral" (y se asigna igual si el servicio se carga más tarde).
        </p>
      )}

      <Alert>{error}</Alert>

      {isPrivileged && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {canConfirm && (
            <Button
              variant={mancato.asignacion === "SUGERIDO" ? "primary" : "ghost"}
              className="sm:w-auto sm:px-5"
              disabled={busy}
              onClick={() => onChange({ confirmar: "true" })}
            >
              <CheckCircleIcon className="h-4 w-4" />
              Confirmar servicio
            </Button>
          )}
          <Button variant="ghost" className="sm:w-auto sm:px-5" disabled={busy} onClick={openPicker}>
            {servicio ? "Cambiar servicio" : "Elegir servicio"}
          </Button>
        </div>
      )}

      {picking && (
        <div className="mt-4 rounded-xl border border-line/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-ink-300">Servicios de este vehículo cerca del tránsito</span>
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="text-[12px] font-medium text-ink-400 hover:text-ink-50"
            >
              Cerrar
            </button>
          </div>

          {!candidates && !error && (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          )}
          {candidates?.length === 0 && (
            <p className="px-1 py-2 text-[13px] text-ink-400">
              No hay servicios de este vehículo en esos días. Si el servicio todavía no se cargó, deja el mancato
              en espera.
            </p>
          )}
          <ul className="flex flex-col gap-1.5">
            {candidates?.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={busy || c.id === servicio?.id}
                  onClick={() => choose({ recordId: c.id })}
                  className="flex w-full flex-col gap-0.5 rounded-lg bg-line/[0.06] px-3 py-2 text-left transition-colors hover:bg-line/10 disabled:opacity-50"
                >
                  <span className="flex flex-wrap items-center gap-1.5 text-[14px] font-medium text-ink-50">
                    {c.codigo}
                    {c.activo && (
                      <span className="rounded-full bg-success-500/15 px-2 py-0.5 text-[11px] text-success-500">
                        En curso a esa hora ({TRAMO_LABELS[c.tramo].toLowerCase()})
                      </span>
                    )}
                    {c.inferido && (
                      <span className="rounded-full bg-line/15 px-2 py-0.5 text-[11px] text-ink-400">
                        Sin Fecha de retiro
                      </span>
                    )}
                  </span>
                  <span className="text-[12px] text-ink-300">
                    {[c.cliente, c.destinazione, c.driver].filter(Boolean).join(" - ")}
                  </span>
                  <span className="text-[12px] text-ink-400">
                    {c.fechaRetiro ? `Retiro ${formatDateTime(c.fechaRetiro)}` : "Retiro sin cargar"} - ETA{" "}
                    {formatDateTime(c.eta)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            disabled={busy}
            onClick={() => choose({ recordId: "" })}
            className="mt-3 text-[13px] font-medium text-accent-400 hover:text-accent-300 disabled:opacity-50"
          >
            Dejarlo fuera del horario laboral (sin servicio)
          </button>
        </div>
      )}
    </GlassCard>
  );
};
