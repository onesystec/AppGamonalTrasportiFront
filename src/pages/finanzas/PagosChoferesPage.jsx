import clsx from "clsx";
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { MonthSelector } from "../../components/finanzas/MonthSelector";
import { MancatoKpi } from "../../components/mancato/MancatoKpi";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { PageLoader } from "../../components/ui/PageLoader";
import { Spinner } from "../../components/ui/Spinner";
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ClockIcon,
  DownloadIcon,
  EuroIcon,
  RouteIcon,
  UsersIcon,
} from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { PayRulesCard } from "../../components/horas/PayRulesCard";
import { parseApiError } from "../../lib/api";
import { COSTO_COLORS, currentMonth, kmSourceLabel, payCalcText } from "../../lib/finanzas";
import { downloadPresenciasRequest, getPagosChoferesRequest } from "../../lib/finanzas.api";
import { downloadBlob } from "../../lib/csv";
import { HorasEstadoChip } from "../../components/horas/HorasEstadoChip";
import { formatCurrency, formatDate, formatKm } from "../../lib/format";
import { formatHours, pagaPorKm } from "../../lib/horas";

const FORMATO_KEY = "gamonal-presencias-formato";
const FORMATOS = [
  { value: "decimal", label: "Decimal (6,68)" },
  { value: "hhmm", label: "Horas:min (6:41)" },
];
const readFormato = () => {
  try {
    const saved = localStorage.getItem(FORMATO_KEY);
    return FORMATOS.some((f) => f.value === saved) ? saved : "decimal";
  } catch {
    return "decimal";
  }
};

// El error de una descarga llega como Blob: se lee el mensaje que mando el servidor.
const downloadErrorMessage = async (err) => {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const message = JSON.parse(await data.text())?.message;
      if (message) return message;
    } catch {
      // sin cuerpo legible
    }
  }
  return parseApiError(err).message;
};

const AVATAR_COLORS = ["#ff3b57", "#ff8a1a", "#2f8dff", "#a78bfa", "#22d3ee"];
const avatarColor = (name) =>
  AVATAR_COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
const initials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const nf = (value) => Number(value).toLocaleString("es-AR", { maximumFractionDigits: 1 });

const RulesCard = ({ reglas }) => <PayRulesCard reglas={reglas} />;

// Tabla de servicios de un chofer en el mes, con el calculo de cada pago.
const ServiceList = ({ servicios, reglas, location }) =>
  servicios.length === 0 ? (
    <p className="px-3 py-4 text-[14px] text-ink-400">No hay servicios pagables en este mes.</p>
  ) : (
    <div className="flex flex-col">
      <div className="hidden gap-3 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-400 lg:grid lg:grid-cols-[100px_minmax(0,1fr)_minmax(0,1.4fr)_100px]">
        <span>Fecha</span>
        <span>Servicio</span>
        <span>Calculo</span>
        <span className="text-right">Pago</span>
      </div>
      {servicios.map((s) => (
        <Link
          key={s.id}
          to={`/records/${s.id}`}
          state={{ backgroundLocation: location }}
          className="grid grid-cols-1 gap-1 rounded-lg px-4 py-2.5 transition-colors hover:bg-line/[0.07] lg:grid-cols-[100px_minmax(0,1fr)_minmax(0,1.4fr)_100px] lg:items-center lg:gap-3 lg:border-b lg:border-b-line/10"
        >
          <span className="text-[13px] text-ink-50">{formatDate(s.fecha)}</span>
          <div className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-ink-50">{s.codigo}</span>
            <span className="block truncate text-[12px] text-ink-400">
              {[s.cliente, s.destinazione].filter(Boolean).join(" - ")}
            </span>
          </div>
          <div className="min-w-0 text-[12px] text-ink-300">
            {!pagaPorKm({ fechaServicio: s.fecha }) && <HorasEstadoChip estado={s.horasEstado} className="mr-1.5" />}
            {payCalcText(s, reglas)}
            {s.modo === "KM" && s.kmFuente !== "SIN_DATO" && s.kmFuente !== "TRASPASO_SIN_KM" && (
              <span className="ml-1.5 rounded bg-line/10 px-1.5 py-0.5 text-[10px] text-ink-400">
                {kmSourceLabel(s.kmFuente)}
              </span>
            )}
            {s.kmFuente === "TRASPASO_SIN_KM" && (
              <span className="ml-1.5 text-warning-500">revisar: traspaso sin horas ni km reales del chofer</span>
            )}
            {s.kmFuente === "VIAJE_SIN_CIRCUITO" && (
              <span className="ml-1.5 text-warning-500">revisar: viaje sin circuito (paradas sin ubicar); se calcula solo al reabrir</span>
            )}
            {s.kmFuente === "SIN_DATO" && (
              <span className="ml-1.5 text-warning-500">revisar: el servicio no tiene km ni horas</span>
            )}
          </div>
          <span className="text-[14px] font-semibold text-ink-50 lg:text-right">{formatCurrency(s.total)}</span>
        </Link>
      ))}
    </div>
  );

// Fila de un chofer (OWNER/ADMIN): resumen del mes y, al abrirla, sus servicios.
const DriverRow = ({ driver, month, reglas, location }) => {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState({ servicios: null, loading: false, error: "" });

  useEffect(() => {
    if (!open || detail.servicios) return undefined;
    let cancelled = false;
    setDetail((prev) => ({ ...prev, loading: true, error: "" }));
    getPagosChoferesRequest({ month, driverId: driver.driverId })
      .then((data) => {
        if (!cancelled) setDetail({ servicios: data.servicios ?? [], loading: false, error: "" });
      })
      .catch((err) => {
        if (!cancelled) setDetail({ servicios: null, loading: false, error: parseApiError(err).message });
      });
    return () => {
      cancelled = true;
    };
  }, [open, month, driver.driverId, detail.servicios]);

  return (
    <section className="glass-surface relative rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={clsx(
          "flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-left transition-colors hover:bg-line/[0.05]",
          open ? "rounded-t-2xl" : "rounded-2xl"
        )}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
          style={{ backgroundColor: avatarColor(driver.nombre) }}
        >
          {initials(driver.nombre)}
        </span>
        <div className="min-w-0 flex-1 basis-40">
          <span className="block truncate text-[15px] font-semibold text-ink-50">{driver.nombre}</span>
          <span className="block text-[12px] text-ink-400">
            {driver.servicios} {driver.servicios === 1 ? "servicio" : "servicios"}
            {driver.km > 0 && ` - ${formatKm(driver.km)}`}
            {driver.horasManejo > 0 && ` - ${formatHours(driver.horasManejo)} de manejo (km ÷ 85)`}
            {driver.horas > 0 && ` - ${nf(driver.horas)} h`}
            {driver.esperaHoras > 0 && ` - ${nf(driver.esperaHoras)} h de espera`}
            {driver.salidasReperibilidad > 0 &&
              ` - ${driver.salidasReperibilidad} ${driver.salidasReperibilidad === 1 ? "salida" : "salidas"} de reperibilidad (+${formatCurrency(driver.pagoReperibilidad)})`}
            {driver.horasPorAprobar > 0 && ` - ${driver.horasPorAprobar} con horas por aprobar`}
          </span>
          {driver.asistencia && (
            <span className="block text-[12px] text-ink-400">
              Asistencia: {driver.asistencia.trabajados} {driver.asistencia.trabajados === 1 ? "dia trabajado" : "dias trabajados"}
              {driver.asistencia.noTrabajados > 0 && (
                <span className="text-danger-500"> - {driver.asistencia.noTrabajados} sin justificar</span>
              )}
              {driver.asistencia.justificados > 0 && (
                <span className="text-warning-500"> - {driver.asistencia.justificados} justificados</span>
              )}
            </span>
          )}
        </div>
        <span className="text-right text-[12px] text-ink-400">
          A pagar
          <span className="block text-[17px] font-semibold text-ink-50">{formatCurrency(driver.total)}</span>
        </span>
        <ChevronDownIcon
          className={clsx("h-5 w-5 shrink-0 text-ink-300 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="border-t border-line/10 px-2 pb-3 pt-1 sm:px-3">
          <Alert>{detail.error}</Alert>
          {detail.loading && !detail.servicios && (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          )}
          {detail.servicios && <ServiceList servicios={detail.servicios} reglas={reglas} location={location} />}
        </div>
      )}
    </section>
  );
};

export const PagosChoferesPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [formato, setFormato] = useState(readFormato);
  const [downloading, setDownloading] = useState(false);

  const changeFormato = (value) => {
    setFormato(value);
    try {
      localStorage.setItem(FORMATO_KEY, value);
    } catch {
      // sin almacenamiento: queda solo en esta pantalla
    }
  };

  const downloadPresencias = async () => {
    setDownloading(true);
    setError("");
    try {
      const blob = await downloadPresenciasRequest({ month, formato });
      downloadBlob(`Presencias_${month}.xlsx`, blob);
    } catch (err) {
      setError(await downloadErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (!isPrivileged) return undefined;
    let cancelled = false;
    setData(null);
    getPagosChoferesRequest({ month })
      .then((pagos) => {
        if (!cancelled) {
          setData(pagos);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [month, isPrivileged]);

  // El chofer ve su pago dentro de "Mis horas".
  if (!isPrivileged) return <Navigate to="/mis-horas" replace />;

  const sinDato = data ? data.porChofer.reduce((sum, c) => sum + c.serviciosSinDato, 0) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[14px] text-ink-300">
          {isPrivileged
            ? "Lo que corresponde pagar a cada chofer por los servicios entregados del mes."
            : "Lo que te corresponde por tus servicios entregados del mes y como se calcula cada uno."}
        </p>
        <MonthSelector month={month} onChange={setMonth} />
      </div>

      {isPrivileged && (
        <div className="glass-surface flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
          <div className="min-w-0 max-w-xl">
            <p className="text-[14px] font-medium text-ink-50">Planilla de presencias</p>
            <p className="text-[13px] text-ink-300">
              Excel del mes elegido con las horas de cada chofer por dia, en el formato del comercialista.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl options={FORMATOS} value={formato} onChange={changeFormato} />
            <Button variant="ghost" className="w-auto!" loading={downloading} onClick={downloadPresencias}>
              {!downloading && <DownloadIcon className="h-4 w-4" />}
              Descargar presencias
            </Button>
          </div>
        </div>
      )}

      <Alert>{error}</Alert>
      {!data && !error && <PageLoader />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <MancatoKpi
              icon={EuroIcon}
              label={isPrivileged ? "Total a pagar" : "Tu pago del mes"}
              value={formatCurrency(data.total.total)}
              detail="Base + espera"
              color={COSTO_COLORS.pagoChoferes}
            />
            <MancatoKpi
              icon={RouteIcon}
              label="Servicios pagados"
              value={data.total.servicios}
              detail="Entregados o retirados"
              color="#2f8dff"
            />
            <MancatoKpi
              icon={UsersIcon}
              label="Choferes con pago"
              value={data.total.choferes}
              detail="Con al menos un servicio"
              color="#ff8a1a"
            />
            <MancatoKpi
              icon={ClockIcon}
              label="Pago por espera"
              value={formatCurrency(data.total.espera)}
              detail="Horas de espera del mes"
              color="#22d3ee"
            />
          </div>

          <RulesCard reglas={data.reglas} />

          {sinDato > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl bg-warning-500/10 px-4 py-3 text-[13px] text-warning-500">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {sinDato} {sinDato === 1 ? "servicio no tiene" : "servicios no tienen"} horas ni kilometros
                cargados y se cuenta{sinDato === 1 ? "" : "n"} como 0 EUR. Revisalo en Registros.
              </span>
            </div>
          )}

          {data.porChofer.length === 0 && (
            <p className="px-1 py-6 text-[14px] text-ink-400">No hay servicios pagables en este mes.</p>
          )}

          {isPrivileged ? (
            <div className="flex flex-col gap-3">
              {data.porChofer.map((driver) => (
                <DriverRow
                  key={`${driver.driverId}-${month}`}
                  driver={driver}
                  month={month}
                  reglas={data.reglas}
                  location={location}
                />
              ))}
            </div>
          ) : (
            data.servicios && (
              <div className="glass-surface rounded-2xl p-2 sm:p-3">
                <ServiceList servicios={data.servicios} reglas={data.reglas} location={location} />
              </div>
            )
          )}
        </>
      )}
    </div>
  );
};
