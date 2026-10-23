import clsx from "clsx";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { GlassCard } from "../ui/GlassCard";
import { Spinner } from "../ui/Spinner";
import { CheckCircleIcon, ClockIcon, TruckIcon } from "../ui/icons";
import { parseApiError } from "../../lib/api";
import { COMBUSTIBLE_ASIGNACIONES } from "../../lib/combustible";
import { listCombustibleCandidatesRequest } from "../../lib/combustible.api";
import { formatDateTime, formatRomeDateTime } from "../../lib/format";

// A que servicio se imputa esta carga (lo calcula el sistema) y, para OWNER/ADMIN, como
// confirmarlo o cambiarlo. Una carga sin servicio NO vence: queda esperando hasta que se cargue
// uno que encaje (o la oficina indique que no corresponde a ninguno).
export const CombustibleServicioCard = ({ registro, isPrivileged, busy, onChange }) => {
  const location = useLocation();
  const [picking, setPicking] = useState(false);
  const [candidates, setCandidates] = useState(null);
  const [error, setError] = useState("");

  const info = COMBUSTIBLE_ASIGNACIONES[registro.asignacion];
  const servicio = registro.servicio;
  const canConfirm = isPrivileged && servicio && ["SUGERIDO", "AUTO"].includes(registro.asignacion);
  const sinServicioFijado = registro.asignacion === "MANUAL" && !servicio;

  const openPicker = async () => {
    setPicking(true);
    setError("");
    if (candidates) return;
    try {
      setCandidates(await listCombustibleCandidatesRequest(registro.id));
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
        <span
          className={clsx(
            "rounded-full px-2.5 py-1 text-[12px] font-medium",
            sinServicioFijado ? "bg-line/15 text-ink-300" : info.pill
          )}
        >
          {sinServicioFijado ? "Sin servicio (confirmado)" : info.label}
        </span>
      </div>

      {registro.fechaHora && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-300">
          <ClockIcon className="h-3.5 w-3.5 shrink-0" />
          Carga: {formatRomeDateTime(registro.fechaHora)}
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
          </span>
        </Link>
      ) : (
        <p className="mt-3 text-[14px] text-ink-300">
          {registro.asignacion === "EN_ESPERA"
            ? "Todavía no hay un servicio de este vehículo que encaje con la hora de la carga. No vence: se asignará sola cuando la oficina cargue el servicio."
            : "Esta carga no corresponde a ningún servicio."}
        </p>
      )}

      {registro.asignacionMotivo && (
        <p className={clsx("mt-2 text-[12px]", info.tone)}>{registro.asignacionMotivo}</p>
      )}

      <Alert>{error}</Alert>

      {isPrivileged && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {canConfirm && (
            <Button
              variant={registro.asignacion === "SUGERIDO" ? "primary" : "ghost"}
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
            <span className="text-[13px] font-medium text-ink-300">Servicios de este vehículo cerca de la carga</span>
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
              No hay servicios de este vehículo en esos días. Si el servicio todavía no se cargó, deja la carga en
              espera: no vence.
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
                        En curso a esa hora
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
            No corresponde a ningún servicio
          </button>
        </div>
      )}
    </GlassCard>
  );
};
