import clsx from "clsx";
import { useEffect, useState } from "react";
import { parseApiError } from "../../lib/api";
import { formatKm } from "../../lib/format";
import { getCalendarioRequest } from "../../lib/permisos.api";
import { Spinner } from "../ui/Spinner";
import { ChevronDownIcon } from "../ui/icons";

const ESTILOS = {
  TRABAJADO: "bg-success-500 text-white",
  NO_TRABAJADO: "bg-danger-500 text-white",
  JUSTIFICADO: "bg-warning-500 text-white",
  PERMISO_PENDIENTE: "bg-warning-500/30 text-warning-500",
  DESCANSO: "bg-line/25 text-ink-300",
  LIBRE_FIN_DE_SEMANA: "bg-line/15 text-ink-400",
};
const LEYENDA = [
  ["TRABAJADO", "Trabajó (entregas y km)"],
  ["NO_TRABAJADO", "Falta sin justificar"],
  ["JUSTIFICADO", "Permiso justificado"],
  ["DESCANSO", "Descanso / libre"],
];
const SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Calendario de asistencia del chofer en el mes (desplegable): cada dia con su estado, las entregas y los km de ese dia.
export const AsistenciaCalendario = ({ driverId, month, servicios }) => {
  const [state, setState] = useState({ days: null, loading: true, error: "" });

  useEffect(() => {
    let cancelled = false;
    getCalendarioRequest({ month, driverId })
      .then((data) => !cancelled && setState({ days: data.days ?? [], loading: false, error: "" }))
      .catch((err) => !cancelled && setState({ days: null, loading: false, error: parseApiError(err).message }));
    return () => {
      cancelled = true;
    };
  }, [month, driverId]);

  const kmPorDia = new Map();
  for (const s of servicios ?? []) {
    if (!s.fecha || !(Number(s.km) > 0)) continue;
    const dia = new Date(s.fecha).toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
    kmPorDia.set(dia, (kmPorDia.get(dia) ?? 0) + Number(s.km));
  }

  const days = state.days ?? [];
  const cuenta = (estado) => days.filter((d) => d.estado === estado).length;
  const entregas = days.reduce((s, d) => s + (d.estado === "TRABAJADO" ? Number(d.servicios) || 0 : 0), 0);
  const [yy, mm] = month.split("-").map(Number);
  const offset = (new Date(Date.UTC(yy, mm - 1, 1)).getUTCDay() + 6) % 7;

  return (
    <details open className="group overflow-hidden rounded-xl border border-line/10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-line/[0.05] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-ink-300 hover:text-ink-100">
        <span>
          Asistencia del mes
          {state.days && (
            <span className="ml-2 normal-case tracking-normal text-ink-400">
              {cuenta("TRABAJADO")} días · {cuenta("NO_TRABAJADO")} faltas · {entregas} entregas
            </span>
          )}
        </span>
        <ChevronDownIcon className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 py-3">
        {state.loading && (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        )}
        {state.error && <p className="text-[13px] text-danger-500">No se pudo cargar la asistencia: {state.error}</p>}
        {state.days && (
          <>
            <div className="grid grid-cols-7 gap-x-1 gap-y-1.5 text-center">
              {SEMANA.map((d) => (
                <span key={d} className="text-[10.5px] font-medium uppercase text-ink-400">
                  {d}
                </span>
              ))}
              {Array.from({ length: offset }, (_, i) => (
                <span key={`v${i}`} />
              ))}
              {days.map((d) => {
                const km = kmPorDia.get(d.fecha);
                const label = d.estado === "TRABAJADO" ? d.servicios : d.estado === "NO_TRABAJADO" ? "F" : "";
                return (
                  <div key={d.fecha} className="flex flex-col items-center" title={`${d.fecha} · ${d.estado.replaceAll("_", " ").toLowerCase()}`}>
                    <span className="text-[9.5px] leading-none text-ink-400">{Number(d.fecha.slice(8, 10))}</span>
                    <span
                      className={clsx(
                        "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                        ESTILOS[d.estado] ?? "border border-line/25 text-ink-400"
                      )}
                    >
                      {label}
                    </span>
                    <span className="mt-0.5 h-3 text-[9.5px] leading-none text-ink-300">{km ? formatKm(km) : ""}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-400">
              {LEYENDA.map(([estado, label]) => (
                <span key={estado} className="flex items-center gap-1.5">
                  <span className={clsx("h-2.5 w-2.5 rounded-full", ESTILOS[estado])} />
                  {label}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </details>
  );
};
