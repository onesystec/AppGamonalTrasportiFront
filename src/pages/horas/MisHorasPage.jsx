import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MonthSelector } from "../../components/finanzas/MonthSelector";
import { CerrarServicioModal } from "../../components/horas/CerrarServicioModal";
import { HorasEstadoChip } from "../../components/horas/HorasEstadoChip";
import { MancatoKpi } from "../../components/mancato/MancatoKpi";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { PageLoader } from "../../components/ui/PageLoader";
import { AlertTriangleIcon, ClockIcon, RouteIcon } from "../../components/ui/icons";
import { parseApiError } from "../../lib/api";
import { currentMonth } from "../../lib/finanzas";
import { getPagosChoferesRequest } from "../../lib/finanzas.api";
import { formatDate, formatRomeDateTime } from "../../lib/format";
import { formatHours } from "../../lib/horas";
import { getRecordRequest } from "../../lib/records.api";

// Un servicio del mes: su jornada y el estado de sus horas. Sin importes: el chofer no ve dinero en esta pantalla.
const ServiceCard = ({ service, onLoadHours, loading }) => {
  // Servicio que va dentro de un viaje compacto: no lleva horas propias, son las del viaje (en el servicio principal).
  const enViaje = service.incluidoEnViaje;
  const needsLoad = !enViaje && (!service.horasEstado || service.horasEstado === "DEVUELTAS");
  const viajeSinHoras = enViaje && !service.viajeHorasEstado;
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
        <HorasEstadoChip estado={enViaje ? service.viajeHorasEstado : service.horasEstado} />
      </div>

      {enViaje && (
        <p className="mt-2 text-[12px] text-ink-300">
          Incluido en el viaje de <b className="text-ink-100">{service.viajeCodigo}</b>: las horas de todo el viaje se cargan
          una sola vez, ahi.
        </p>
      )}

      {!enViaje && service.horaInicioReal && service.horaFinReal && (
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
        <p className="mt-1 text-[12px] text-ink-300">Viaje de {service.viajeServicios} servicios: una sola jornada para todos.</p>
      )}

      {service.kmFuente === "TRASPASO_SIN_KM" && (
        <p className="mt-1 text-[12px] text-warning-500">
          Este servicio tuvo traspaso: carga tus horas (o tus km reales) para que se tenga en cuenta lo que manejaste.
        </p>
      )}

      {service.horasNota && (
        <p className="mt-2 rounded-lg bg-line/5 px-3 py-2 text-[12px] text-ink-200">
          <b className="text-ink-50">Nota del responsable:</b> {service.horasNota}
        </p>
      )}

      {(needsLoad || viajeSinHoras) && (
        <Button
          className="mt-3 sm:w-auto sm:px-5 sm:py-2 sm:text-[13px]"
          loading={loading}
          onClick={() => onLoadHours(enViaje ? service.viajeId : service.id)}
        >
          {enViaje
            ? "Cargar horas del viaje"
            : service.horasEstado === "DEVUELTAS"
              ? "Corregir horas"
              : "Cargar horas"}
        </Button>
      )}
    </div>
  );
};

// "Mis horas" (chofer): lo trabajado en el mes, lo que falta cargar y el estado de cada servicio. No muestra dinero.
export const MisHorasPage = () => {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loadingId, setLoadingId] = useState(null);
  const [modalRecord, setModalRecord] = useState(null);

  const load = useCallback(() => {
    setError("");
    return getPagosChoferesRequest({ month })
      .then((pagos) => setData(pagos))
      .catch((err) => setError(parseApiError(err).message));
  }, [month]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const openLoadHours = async (recordId) => {
    setLoadingId(recordId);
    setError("");
    try {
      setModalRecord(await getRecordRequest(recordId));
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setLoadingId(null);
    }
  };

  const me = data?.porChofer[0];
  const servicios = data?.servicios ?? [];
  // Los servicios incluidos en un viaje no cuentan: sus horas son las del viaje (en el servicio principal).
  const propios = servicios.filter((s) => !s.incluidoEnViaje);
  const sinCargar = propios.filter((s) => !s.horasEstado).length;
  const devueltas = propios.filter((s) => s.horasEstado === "DEVUELTAS").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight text-ink-50">Mis horas</h1>
          <p className="mt-0.5 max-w-xl text-[14px] text-ink-300">
            Lo que trabajaste y lo que falta cargar.
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
              label="Horas trabajadas"
              value={formatHours(me?.horas ?? 0)}
              detail={`Dia ${formatHours(me?.horasDia ?? 0)} - Noche ${formatHours(me?.horasNoche ?? 0)}${me?.adicionales?.count ? ` - ${formatHours(me.adicionales.horas)} adicionales` : ""}`}
              color="#2f8dff"
            />
            <MancatoKpi
              icon={ClockIcon}
              label="Horas de espera"
              value={formatHours(me?.esperaHoras ?? 0)}
              detail="Aprobadas este mes"
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

          {(sinCargar > 0 || devueltas > 0) && (
            <div className="flex items-start gap-2.5 rounded-xl bg-warning-500/10 px-4 py-3 text-[13px] text-warning-500">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {sinCargar > 0 &&
                  `${sinCargar} ${sinCargar === 1 ? "servicio sin horas cargadas" : "servicios sin horas cargadas"}`}
                {sinCargar > 0 && devueltas > 0 && " y "}
                {devueltas > 0 &&
                  `${devueltas} ${devueltas === 1 ? "servicio devuelto para corregir" : "servicios devueltos para corregir"}`}
                .
              </span>
            </div>
          )}

          {servicios.length === 0 ? (
            <p className="px-1 py-6 text-[14px] text-ink-400">No hay servicios entregados en este mes.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {servicios.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  loading={loadingId === service.id || loadingId === service.viajeId}
                  onLoadHours={openLoadHours}
                />
              ))}
            </div>
          )}
        </>
      )}

      {modalRecord && (
        <CerrarServicioModal
          record={modalRecord}
          reglas={data?.reglas}
          onClose={() => setModalRecord(null)}
          onDone={() => load()}
        />
      )}
    </div>
  );
};
