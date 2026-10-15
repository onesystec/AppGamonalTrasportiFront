import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MonthSelector } from "../../components/finanzas/MonthSelector";
import { HorasEstadoChip } from "../../components/horas/HorasEstadoChip";
import { useAuth } from "../../context/AuthContext";
import { MancatoKpi } from "../../components/mancato/MancatoKpi";
import { Alert } from "../../components/ui/Alert";
import { PageLoader } from "../../components/ui/PageLoader";
import { AlertTriangleIcon, ClockIcon, RouteIcon } from "../../components/ui/icons";
import { parseApiError } from "../../lib/api";
import { currentMonth } from "../../lib/finanzas";
import { getPagosChoferesRequest } from "../../lib/finanzas.api";
import { formatDate, formatKm, formatRomeDateTime } from "../../lib/format";
import { formatHours, pagaPorKm } from "../../lib/horas";

// Un servicio del mes: su jornada y el estado de sus horas. Sin importes: el chofer no ve dinero en esta pantalla.
const ServiceCard = ({ service }) => {
  // Servicio que va dentro de un viaje compacto: no lleva horas propias, son las del viaje (en el servicio principal).
  const enViaje = service.incluidoEnViaje;
  const porKm = pagaPorKm({ fechaServicio: service.fecha });
  return (
    <div className="glass-surface rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/records/${service.id}`}
            className="block truncate text-[14px] font-semibold text-ink-50 hover:text-accent-300"
          >
            {service.codigo}
          </Link>
          <span className="block truncate text-[12px] text-ink-400">
            {formatDate(service.fecha)} &middot; {[service.cliente, service.destinazione].filter(Boolean).join(" - ")}
          </span>
        </div>
        {!porKm && <HorasEstadoChip estado={enViaje ? service.viajeHorasEstado : service.horasEstado} />}
      </div>

      {enViaje && (
        <p className="mt-2 text-[12px] text-ink-300">
          Incluido en el viaje de <b className="text-ink-100">{service.viajeCodigo}</b>: se cuenta una sola vez, ahi.
        </p>
      )}

      {!enViaje && porKm && (
        <p className="mt-2 text-[12px] text-ink-300">
          {service.km > 0 ? (
            <>
              {formatKm(service.km)} &middot; {formatHours(service.horasManejo)} de manejo (km ÷ 85)
            </>
          ) : (
            "Sin km cargados todavia."
          )}
          {service.esperaHoras > 0 && <> &middot; {formatHours(service.esperaHoras)} de espera</>}
        </p>
      )}

      {!enViaje && !porKm && service.horaInicioReal && service.horaFinReal && (
        <p className="mt-2 text-[12px] text-ink-300">
          Jornada: {formatRomeDateTime(service.horaInicioReal)} &rarr; {formatRomeDateTime(service.horaFinReal)}
          {service.horas > 0 && (
            <>
              {" "}&middot; {formatHours(service.horas)} (dia {formatHours(service.horasDia)} - noche {formatHours(service.horasNoche)})
            </>
          )}
        </p>
      )}

      {!enViaje && service.viajeServicios > 1 && (
        <p className="mt-1 text-[12px] text-ink-300">Viaje de {service.viajeServicios} servicios: se cuenta una sola vez.</p>
      )}

      {service.horasNota && (
        <p className="mt-2 rounded-lg bg-line/5 px-3 py-2 text-[12px] text-ink-200">
          <b className="text-ink-50">Nota del responsable:</b> {service.horasNota}
        </p>
      )}
    </div>
  );
};

// "Mis horas" (chofer): lo trabajado en el mes, lo que falta cargar y el estado de cada servicio. No muestra dinero.
export const MisHorasPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    // Un Admin/Responsable que manejo ve solo sus propios servicios (el servidor, para la oficina, devuelve todos los choferes).
    return getPagosChoferesRequest({ month, ...(isPrivileged ? { driverId: user.id } : {}) })
      .then((pagos) => setData(pagos))
      .catch((err) => setError(parseApiError(err).message));
  }, [month, isPrivileged, user?.id]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const me = data?.porChofer[0];
  const servicios = data?.servicios ?? [];
  // Servicios anteriores al pago por km que todavia tienen horas por corregir (las de ahora no se cargan: salen de los km).
  const devueltas = servicios.filter((s) => !s.incluidoEnViaje && !pagaPorKm({ fechaServicio: s.fecha }) && s.horasEstado === "DEVUELTAS").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight text-ink-50">Mis horas</h1>
          <p className="mt-0.5 max-w-xl text-[14px] text-ink-300">
            Tus horas de manejo salen de los km de cada servicio (km ÷ 85 km/h). Solo declaras tu espera al terminar.
          </p>
        </div>
        <MonthSelector month={month} onChange={setMonth} />
      </div>

      <Link
        to="/trabajos-adicionales"
        className="flex items-center justify-between gap-3 rounded-2xl glass-surface-sm px-4 py-3 text-[14px] text-ink-200 transition-colors hover:bg-line/10"
      >
        <span>
          <b className="text-ink-50">¿Hiciste un trabajo fuera de tus servicios?</b> Cargalo como trabajo adicional para que cuente en tus horas.
        </span>
        <span className="shrink-0 font-medium text-accent-400">Ir &rarr;</span>
      </Link>

      <Alert>{error}</Alert>
      {!data && !error && <PageLoader />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
            <MancatoKpi
              icon={ClockIcon}
              label="Horas de manejo"
              value={formatHours((me?.horas ?? 0) + (me?.horasManejo ?? 0))}
              detail={`${formatKm(me?.km ?? 0)} ÷ 85 km/h${me?.adicionales?.count ? ` - ${formatHours(me.adicionales.horas)} adicionales` : ""}`}
              color="#2f8dff"
            />
            <MancatoKpi
              icon={ClockIcon}
              label="Horas de espera"
              value={formatHours(me?.esperaHoras ?? 0)}
              detail="Declaradas este mes"
              color="#22d3ee"
            />
            <MancatoKpi
              icon={RouteIcon}
              label="Servicios"
              value={data.total.servicios}
              detail="Entregados este mes"
              color="#ff8a1a"
            />
          </div>

          {me?.asistencia && (
            <p className="text-[13px] text-ink-300">
              Asistencia del mes: <b className="text-success-500">{me.asistencia.trabajados}</b> dias trabajados
              {me.asistencia.noTrabajados > 0 && (
                <>
                  {" "}&middot; <b className="text-danger-500">{me.asistencia.noTrabajados}</b> sin justificar
                </>
              )}
              {me.asistencia.justificados > 0 && (
                <>
                  {" "}&middot; <b className="text-warning-500">{me.asistencia.justificados}</b> justificados
                </>
              )}
              .{" "}
              <Link to="/calendario" className="text-accent-400 hover:text-accent-300">
                Ver calendario
              </Link>
            </p>
          )}

          {devueltas > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl bg-warning-500/10 px-4 py-3 text-[13px] text-warning-500">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {`${devueltas} ${devueltas === 1 ? "servicio devuelto para corregir" : "servicios devueltos para corregir"}`}.
              </span>
            </div>
          )}

          {servicios.length === 0 ? (
            <p className="px-1 py-6 text-[14px] text-ink-400">No hay servicios entregados en este mes.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {servicios.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
