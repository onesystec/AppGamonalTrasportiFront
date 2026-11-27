import { FinanceRecordLink } from "../../components/finanzas/FinanceRecordLink";
import { canConfigureFinance, canManageFinance } from "../../lib/financeAccess";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { MonthSelector } from "../../components/finanzas/MonthSelector";
import { MancatoKpi } from "../../components/mancato/MancatoKpi";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Switch } from "../../components/ui/Switch";
import { PageLoader } from "../../components/ui/PageLoader";
import { Spinner } from "../../components/ui/Spinner";
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ClockIcon,
  CloseIcon,
  DownloadIcon,
  EuroIcon,
  FileTextIcon,
  InfoIcon,
  RouteIcon,
  SearchIcon,
  UsersIcon,
} from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { PayRulesCard } from "../../components/horas/PayRulesCard";
import { parseApiError } from "../../lib/api";
import { COSTO_COLORS, currentMonth, kmSourceLabel, payCalcText } from "../../lib/finanzas";
import { downloadPresenciasRequest, getCategoriasPagoRequest, getPagosChoferesRequest, setPagoAparteRequest, setVelocidadPagoRequest } from "../../lib/finanzas.api";
import { downloadBlob } from "../../lib/csv";
import { HorasEstadoChip } from "../../components/horas/HorasEstadoChip";
import { formatCurrency, formatDate, formatKm } from "../../lib/format";
import { formatHours, pagaPorKm } from "../../lib/horas";
import { buildDesglose } from "../../lib/pagoChofer";
import { downloadPagoChoferPdf, downloadPagoChoferXlsx } from "../../lib/pagoChoferExport";
import { calcularCategoria } from "../../lib/categoriaPago";
import { CategoriaPagoCard, CategoriasInfo } from "../../components/finanzas/CategoriaPagoCard";

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

// Tabla de servicios de un chofer en el mes, con el calculo de cada pago.
const ServiceList = ({ servicios, reglas, location, marcarAparte = false }) =>
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
        <FinanceRecordLink
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
            {marcarAparte && s.fueraHorario && (
              <span className="ml-1.5 rounded bg-accent-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent-300">
                Aparte del basico
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
        </FinanceRecordLink>
      ))}
    </div>
  );

// Servicios cuyo circuito tiene muchos mas km que los planificados: casi siempre una parada mal ubicada (un nombre o un cliente leido
// como lugar). Se pagan igual, pero conviene revisar la ruta o anotar los km reales antes de cerrar el mes.
const KmRevisarList = ({ items }) => (
  <ul className="flex flex-col gap-1">
    {items.map((item) => (
      <li key={item.id} className="text-[12px] text-ink-200">
        <FinanceRecordLink to={`/records/${item.id}`} className="font-semibold text-accent-400 hover:text-accent-300">
          {item.codigo}
        </FinanceRecordLink>{" "}
        {item.chofer && <span className="text-ink-400">({item.chofer}) </span>}
        a {item.destino}: circuito de <b className="text-ink-50">{formatKm(item.km)}</b> contra {formatKm(item.kmPlan)} planificados
      </li>
    ))}
  </ul>
);

// Ventana informativa (como se calcula): centrada, se cierra con la X, haciendo click afuera o con Esc.
const InfoModal = ({ open, title, onClose, children }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-backdrop backdrop-blur-sm" />
      <div className="glass-surface relative z-10 flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-3xl bg-background">
        <div className="flex items-center justify-between gap-3 border-b border-line/10 px-6 py-4">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold text-ink-50">
            <InfoIcon className="h-5 w-5 text-accent-400" />
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-ink-300 hover:bg-line/10 hover:text-ink-50">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

// Desglose exacto de lo que se paga a un chofer en el mes: cada concepto con su cantidad y su pago (el "como se calcula" de cada uno
// esta en el boton informativo). La suma de los pagos es el total a pagar. Todo sale del mismo calculo que el pago de cada servicio.
const DesglosePago = ({ driver, onVerCalculo }) => {
  const desglose = buildDesglose(driver);
  if (!desglose) return null;
  const { filas, resumen, avisos } = desglose;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        {resumen.map((r) => (
          <div key={r.clave} className="rounded-xl border border-line/10 bg-line/[0.04] px-3.5 py-3">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-ink-400">{r.titulo}</span>
            <span className="mt-0.5 block text-[16px] font-semibold text-ink-50">{r.grande}</span>
            <span className="block truncate text-[11.5px] text-ink-400" title={r.detalle}>{r.detalle}</span>
            <span className="mt-1.5 block text-[14px] font-semibold text-accent-300">{formatCurrency(r.pago)}</span>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-line/10">
        <div className="flex items-center justify-between gap-3 bg-line/[0.05] px-4 py-2.5">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-300">Desglose del pago</span>
          {filas.length > 0 && (
            <button
              type="button"
              onClick={() => onVerCalculo(filas)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium text-accent-400 transition-colors hover:bg-accent-500/10 hover:text-accent-300"
            >
              <InfoIcon className="h-4 w-4" />
              Ver cálculo
            </button>
          )}
        </div>
        {filas.length === 0 ? (
          <p className="px-4 py-3 text-[13px] text-ink-400">Este chofer no tiene pagos por servicios este mes.</p>
        ) : (
          <>
            {filas.map((fila) => (
              <div key={fila.clave} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 border-t border-line/10 px-4 py-2.5 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_110px]">
                <span className="text-[13px] font-medium text-ink-50">{fila.concepto}</span>
                <span className="order-3 col-span-2 text-[12px] text-ink-400 sm:order-none sm:col-span-1 sm:text-[12.5px] sm:text-ink-300">{fila.cantidad}</span>
                <span className="text-right text-[13.5px] font-semibold text-ink-50">{formatCurrency(fila.pago)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-t border-line/20 bg-line/[0.06] px-4 py-3">
              <span className="text-[13px] font-semibold text-ink-50">Total a pagar</span>
              <span className="text-[16px] font-bold text-ink-50">{formatCurrency(driver.total)}</span>
            </div>
          </>
        )}
      </div>

      {avisos.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {avisos.map((aviso) => (
            <li
              key={aviso.texto}
              className={clsx(
                "flex items-start gap-2 rounded-lg px-3 py-2 text-[12px]",
                aviso.tono === "warn" ? "bg-warning-500/10 text-warning-500" : "bg-line/[0.05] text-ink-300"
              )}
            >
              {aviso.tono === "warn" ? <AlertTriangleIcon className="mt-px h-3.5 w-3.5 shrink-0" /> : <InfoIcon className="mt-px h-3.5 w-3.5 shrink-0" />}
              {aviso.texto}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Chofer en la columna de la izquierda: nombre, servicios y lo que se le paga.
const DriverListItem = ({ driver, active, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-current={active ? "true" : undefined}
    className={clsx(
      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
      active ? "bg-accent-500/15 ring-1 ring-accent-500/40" : "hover:bg-line/[0.06]"
    )}
  >
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
      style={{ backgroundColor: avatarColor(driver.nombre) }}
    >
      {initials(driver.nombre)}
    </span>
    <span className="min-w-0 flex-1">
      <span className={clsx("block truncate text-[13.5px] font-medium", active ? "text-ink-50" : "text-ink-100")}>{driver.nombre}</span>
      <span className="block truncate text-[11.5px] text-ink-400">
        {driver.servicios} {driver.servicios === 1 ? "servicio" : "servicios"}
        {driver.km > 0 && ` · ${formatKm(driver.km)}`}
      </span>
    </span>
    <span className="flex shrink-0 flex-col items-end">
      <span className="text-[13px] font-semibold text-ink-50">{formatCurrency(driver.total)}</span>
      {(driver.kmRevisar?.length > 0 || driver.serviciosSinDato > 0) && (
        <AlertTriangleIcon className="h-3.5 w-3.5 text-warning-500" aria-label="Tiene servicios a revisar" />
      )}
    </span>
  </button>
);

// Detalle del chofer elegido (OWNER/ADMIN): resumen del mes, desglose, ajustes, descargas y sus servicios.
const DriverDetail = ({ driver, month, reglas, location, velocidades, onVelocidad, savingVelocidad, canEditAparte, onPagoAparte, savingAparte, onVerCalculo, categoriaManual, onCategoriaSaved }) => {
  const [detail, setDetail] = useState({ servicios: null, loading: false, error: "" });
  const [exporting, setExporting] = useState("");
  const [exportError, setExportError] = useState("");
  // Km/h con los que se calcula su pago: al cambiarlos, los servicios se vuelven a pedir.
  const kmh = driver.kmhPago?.valor ?? reglas.kmBloque;
  const [lastKmh, setLastKmh] = useState(kmh);
  if (kmh !== lastKmh) {
    setLastKmh(kmh);
    setDetail({ servicios: null, loading: false, error: "" });
  }

  useEffect(() => {
    if (detail.servicios) return undefined;
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
  }, [month, driver.driverId, detail.servicios]);

  const exportar = async (formato) => {
    setExporting(formato);
    setExportError("");
    try {
      const servicios = detail.servicios ?? (await getPagosChoferesRequest({ month, driverId: driver.driverId })).servicios ?? [];
      const params = { driver, servicios, reglas, month, kmh, categoria: calcularCategoria(driver, categoriaManual ?? {}) };
      if (formato === "pdf") await downloadPagoChoferPdf(params);
      else await downloadPagoChoferXlsx(params);
    } catch (err) {
      setExportError(parseApiError(err).message || "No se pudo generar el archivo");
    } finally {
      setExporting("");
    }
  };

  const stats = [
    `${driver.servicios} ${driver.servicios === 1 ? "servicio" : "servicios"}`,
    driver.km > 0 && formatKm(driver.km),
    driver.horasManejo > 0 && `${formatHours(driver.horasManejo)} de manejo (km ÷ ${kmh})`,
    driver.horas > 0 && `${nf(driver.horas)} h`,
    driver.esperaHoras > 0 && `${nf(driver.esperaHoras)} h de espera`,
    driver.esperaPendienteHoras > 0 && `${nf(driver.esperaPendienteHoras)} h de espera por aprobar (no suman)`,
    driver.horasPorAprobar > 0 && `${driver.horasPorAprobar} con horas por aprobar`,
  ].filter(Boolean);

  return (
    <section className="glass-surface flex min-w-0 flex-col rounded-2xl">
      {/* Encabezado del chofer */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 border-b border-line/10 px-5 py-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
          style={{ backgroundColor: avatarColor(driver.nombre) }}
        >
          {initials(driver.nombre)}
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <h2 className="truncate text-[17px] font-semibold text-ink-50">{driver.nombre}</h2>
          <p className="text-[12.5px] text-ink-400">{stats.join(" · ")}</p>
          {driver.asistencia && (
            <p className="text-[12.5px] text-ink-400">
              Asistencia: {driver.asistencia.trabajados} {driver.asistencia.trabajados === 1 ? "día trabajado" : "días trabajados"}
              {driver.asistencia.noTrabajados > 0 && <span className="text-danger-500"> · {driver.asistencia.noTrabajados} sin justificar</span>}
              {driver.asistencia.justificados > 0 && <span className="text-warning-500"> · {driver.asistencia.justificados} justificados</span>}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-right text-[11px] font-medium uppercase tracking-wide text-ink-400">
            A pagar
            <span className="block text-[22px] font-bold normal-case tracking-normal text-ink-50">{formatCurrency(driver.total)}</span>
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" className="w-auto! px-3! py-1.5! text-[12.5px]!" loading={exporting === "xlsx"} disabled={Boolean(exporting)} onClick={() => exportar("xlsx")}>
              {exporting !== "xlsx" && <DownloadIcon className="h-4 w-4" />}
              Excel
            </Button>
            <Button variant="ghost" className="w-auto! px-3! py-1.5! text-[12.5px]!" loading={exporting === "pdf"} disabled={Boolean(exporting)} onClick={() => exportar("pdf")}>
              {exporting !== "pdf" && <FileTextIcon className="h-4 w-4" />}
              PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        <Alert>{exportError}</Alert>

        <CategoriaPagoCard key={JSON.stringify(categoriaManual ?? null)} driver={driver} month={month} manual={categoriaManual} onSaved={onCategoriaSaved} />

        {driver.kmRevisar?.length > 0 && (
          <div className="rounded-xl border border-warning-500/30 bg-warning-500/10 px-4 py-3">
            <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-warning-500">
              <AlertTriangleIcon className="h-4 w-4" />
              Revisar km ({driver.kmRevisar.length})
            </p>
            <KmRevisarList items={driver.kmRevisar} />
          </div>
        )}

        {/* Calculo antiguo (por servicio): queda oculto, se abre solo para consultarlo. */}
        <details className="group overflow-hidden rounded-xl border border-line/10">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-line/[0.05] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-ink-300 hover:text-ink-100">
            <span>
              Cálculo antiguo <span className="ml-1 normal-case tracking-normal text-ink-400">(desglose por servicio · {formatCurrency(driver.total)})</span>
            </span>
            <ChevronDownIcon className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-4 p-4">
          <DesglosePago driver={driver} onVerCalculo={(filas) => onVerCalculo(driver, filas)} />

          {reglas.reperibilidad && driver.pagoAparte && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div className="rounded-xl border border-line/10 bg-line/[0.04] px-3.5 py-3">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-ink-400">Básico (horario laboral)</span>
                <span className="block text-[16px] font-semibold text-ink-50">{formatCurrency(driver.basico)}</span>
                <span className="block text-[11.5px] text-ink-400">Servicios de lunes a viernes de día, más la espera</span>
              </div>
              <div className="rounded-xl border border-accent-500/20 bg-accent-500/10 px-3.5 py-3">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-accent-300">Aparte del básico</span>
                <span className="block text-[16px] font-semibold text-ink-50">{formatCurrency(driver.aparte?.total ?? 0)}</span>
                <span className="block text-[11.5px] text-ink-300">
                  {driver.aparte?.servicios > 0
                    ? `${driver.aparte.servicios} ${driver.aparte.servicios === 1 ? "servicio" : "servicios"} fuera de horario: ${formatCurrency(driver.aparte.base)} de trabajo + ${formatCurrency(driver.aparte.reperibilidad)} de reperibilita${driver.aparte.espera > 0 ? ` + ${formatCurrency(driver.aparte.espera)} de espera` : ""}`
                    : "Sin servicios fuera de horario este mes"}
                </span>
              </div>
              <div className="rounded-xl border border-line/10 bg-line/[0.04] px-3.5 py-3">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-ink-400">Total a pagar</span>
                <span className="block text-[16px] font-semibold text-ink-50">{formatCurrency(driver.total)}</span>
                <span className="block text-[11.5px] text-ink-400">Básico + aparte</span>
              </div>
            </div>
          )}

          {/* Ajustes del pago */}
          {(velocidades.length > 0 || reglas.reperibilidad) && (
            <div className="flex flex-col divide-y divide-line/10 rounded-xl border border-line/10">
              {velocidades.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                  <span className="text-[13px] font-medium text-ink-100">Velocidad de pago (km/h)</span>
                  <SegmentedControl
                    options={velocidades.map((v) => ({ value: v, label: String(v) }))}
                    value={kmh}
                    onChange={(value) => value !== kmh && onVelocidad(driver.driverId, value)}
                    className={clsx(savingVelocidad && "pointer-events-none opacity-60")}
                  />
                  <span className="text-[12px] text-ink-400">
                    {savingVelocidad
                      ? "Guardando..."
                      : driver.kmhPago?.propio
                        ? "Elegida para este mes; rige también los siguientes"
                        : "Heredada: rige desde un mes anterior (o la normal de 85)"}
                  </span>
                </div>
              )}
              {reglas.reperibilidad && (
                <div className="px-4 py-3">
                  <Switch
                    id={`aparte-${driver.driverId}`}
                    label="Pago aparte del básico"
                    description={
                      canEditAparte
                        ? "Activado: el trabajo fuera del horario laboral (noche, fin de semana y festivo) y la reperibilita se muestran y se pagan aparte. Apagado: todo va junto en un solo total."
                        : "Solo un Admin puede cambiarlo. Activado: lo de fuera de horario y la reperibilita se pagan aparte; apagado: todo va junto."
                    }
                    checked={Boolean(driver.pagoAparte)}
                    onChange={(activo) => onPagoAparte(driver.driverId, activo)}
                    disabled={!canEditAparte || savingAparte}
                  />
                </div>
              )}
            </div>
          )}

          </div>
        </details>

        {/* Servicios del mes */}
        <div className="overflow-hidden rounded-xl border border-line/10">
          <div className="bg-line/[0.05] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-ink-300">
            Servicios del mes{detail.servicios ? ` (${detail.servicios.length})` : ""}
          </div>
          <div className="px-1 pb-1">
            <Alert>{detail.error}</Alert>
            {detail.loading && !detail.servicios && (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            )}
            {detail.servicios && (
              <ServiceList servicios={detail.servicios} reglas={{ ...reglas, kmBloque: kmh }} location={location} marcarAparte={Boolean(driver.pagoAparte)} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

const normalize = (text) =>
  String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export const PagosChoferesPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isPrivileged = canManageFinance(user);

  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [formato, setFormato] = useState(readFormato);
  const [downloading, setDownloading] = useState(false);
  const [savingVelocidad, setSavingVelocidad] = useState(null);
  const [savingAparte, setSavingAparte] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  // Ventana informativa: las reglas de pago ("reglas") o el calculo de cada concepto de un chofer ("chofer").
  const [info, setInfo] = useState(null);
  // Calculo por categoria: lo cambiado a mano en el mes, por chofer (driverId -> valores).
  const [categorias, setCategorias] = useState({});
  const [categoriasError, setCategoriasError] = useState("");

  // Velocidad de pago de un chofer en el mes mostrado: se guarda y se vuelve a pedir el pago con el valor nuevo.
  const changeVelocidad = async (driverId, kmh) => {
    setSavingVelocidad(driverId);
    setError("");
    try {
      await setVelocidadPagoRequest({ driverId, month, kmh });
      setData(await getPagosChoferesRequest({ month }));
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSavingVelocidad(null);
    }
  };

  // Pago aparte del basico de un chofer (solo el Admin): se guarda y se vuelve a pedir el pago con el reparto nuevo (el total no cambia).
  const changePagoAparte = async (driverId, activo) => {
    setSavingAparte(driverId);
    setError("");
    try {
      await setPagoAparteRequest({ driverId, activo });
      setData(await getPagosChoferesRequest({ month }));
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSavingAparte(null);
    }
  };

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

  useEffect(() => {
    if (!isPrivileged) return undefined;
    let cancelled = false;
    setCategorias({});
    setCategoriasError("");
    getCategoriasPagoRequest({ month })
      .then((rows) => {
        if (!cancelled) setCategorias(Object.fromEntries((rows ?? []).map((row) => [row.driverId, row])));
      })
      .catch((err) => {
        if (!cancelled) setCategoriasError(`No se pudieron leer los ajustes del cálculo por categoría: ${parseApiError(err).message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [month, isPrivileged]);

  const onCategoriaSaved = (driverId, row) => setCategorias((prev) => ({ ...prev, [driverId]: row }));

  // El chofer ve su pago dentro de "Mis horas".
  if (!isPrivileged) return <Navigate to="/mis-horas" replace />;

  const sinDato = data ? data.porChofer.reduce((sum, c) => sum + c.serviciosSinDato, 0) : 0;
  const filtrados = data ? data.porChofer.filter((c) => normalize(c.nombre).includes(normalize(busqueda.trim()))) : [];
  // Chofer a la vista: el elegido si sigue en la lista filtrada; si no, el primero.
  const selected = filtrados.find((c) => c.driverId === selectedId) ?? filtrados[0] ?? null;
  const aparteChoferes = data ? data.porChofer.filter((c) => c.pagoAparte) : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[14px] text-ink-300">
          {isPrivileged
            ? "Lo que corresponde pagar a cada chofer por los servicios entregados del mes."
            : "Lo que te corresponde por tus servicios entregados del mes y como se calcula cada uno."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {data && (
            <button
              type="button"
              onClick={() => setInfo({ tipo: "reglas" })}
              className="glass-surface-sm flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium text-ink-200 transition-colors hover:text-ink-50"
            >
              <InfoIcon className="h-4 w-4 text-accent-400" />
              ¿Cómo se calcula?
            </button>
          )}
          <MonthSelector month={month} onChange={setMonth} />
        </div>
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
      {data && categoriasError && <Alert>{categoriasError}</Alert>}
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

          {(aparteChoferes.length > 0 || data.total.salidasReperibilidad > 0) && (
            <div className="flex flex-wrap gap-2 text-[12.5px] text-ink-300">
              {aparteChoferes.length > 0 && (
                <span
                  className="rounded-lg bg-line/[0.06] px-3 py-1.5"
                  title={`${aparteChoferes.map((c) => c.nombre).join(", ")}. Los demas choferes cobran todo el trabajo junto en un solo total.`}
                >
                  Pago aparte del básico:{" "}
                  <b className="text-ink-50">{formatCurrency(aparteChoferes.reduce((sum, c) => sum + (c.aparte?.total ?? 0), 0))}</b> (
                  {aparteChoferes.map((c) => c.nombre).join(", ")})
                </span>
              )}
              {data.total.salidasReperibilidad > 0 && (
                <span className="rounded-lg bg-line/[0.06] px-3 py-1.5">
                  Reperibilidad del mes: <b className="text-ink-50">{formatCurrency(data.total.reperibilidad)}</b> en {data.total.salidasReperibilidad}{" "}
                  {data.total.salidasReperibilidad === 1 ? "servicio" : "servicios"} ({data.total.salidasNoche ?? 0} de noche,{" "}
                  {data.total.salidasReperibilidad - (data.total.salidasNoche ?? 0)} de fin de semana o festivo)
                </span>
              )}
            </div>
          )}

          {data.total.serviciosKmRevisar > 0 && (
            <details className="group rounded-2xl border border-warning-500/40 bg-warning-500/10 px-5 py-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-[14px] font-semibold text-warning-500">
                <AlertTriangleIcon className="h-5 w-5" />
                {data.total.serviciosKmRevisar} {data.total.serviciosKmRevisar === 1 ? "servicio con km a revisar" : "servicios con km a revisar"}
                <span className="ml-auto text-[12px] font-medium group-open:hidden">Ver</span>
                <span className="ml-auto hidden text-[12px] font-medium group-open:inline">Ocultar</span>
              </summary>
              <p className="mb-2 mt-2 text-[12px] text-ink-300">
                Su circuito es mucho mas largo que los km planificados (posible parada mal ubicada). Se pagan por ese circuito: corrige la
                ruta del servicio o anota los km reales antes de pagar.
              </p>
              <KmRevisarList items={data.porChofer.flatMap((d) => (d.kmRevisar ?? []).map((k) => ({ ...k, chofer: d.nombre })))} />
            </details>
          )}

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
            data.porChofer.length > 0 && (
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
                {/* Columna de choferes: buscador y lista; al hacer click se cambia el chofer de la derecha. */}
                <aside className="glass-surface flex flex-col rounded-2xl lg:sticky lg:top-24">
                  <div className="border-b border-line/10 p-3">
                    <div className="relative">
                      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                      <input
                        type="search"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar chofer..."
                        aria-label="Buscar chofer"
                        className="glass-input w-full rounded-xl py-2.5 pl-9 pr-3 text-[14px] text-ink-50"
                      />
                    </div>
                    <p className="mt-2 px-1 text-[11.5px] text-ink-400">
                      {filtrados.length === data.porChofer.length
                        ? `${data.porChofer.length} ${data.porChofer.length === 1 ? "chofer" : "choferes"}`
                        : `${filtrados.length} de ${data.porChofer.length} choferes`}
                    </p>
                  </div>
                  <div className="flex max-h-[280px] flex-col gap-0.5 overflow-y-auto p-2 lg:max-h-[calc(100dvh-13rem)]">
                    {filtrados.length === 0 ? (
                      <p className="px-3 py-4 text-[13px] text-ink-400">Ningún chofer coincide con “{busqueda.trim()}”.</p>
                    ) : (
                      filtrados.map((driver) => (
                        <DriverListItem
                          key={driver.driverId}
                          driver={driver}
                          active={selected?.driverId === driver.driverId}
                          onSelect={() => setSelectedId(driver.driverId)}
                        />
                      ))
                    )}
                  </div>
                </aside>

                {selected ? (
                  <DriverDetail
                    key={`${selected.driverId}-${month}`}
                    driver={selected}
                    month={month}
                    reglas={data.reglas}
                    location={location}
                    velocidades={data.velocidadesPago ?? []}
                    onVelocidad={changeVelocidad}
                    savingVelocidad={savingVelocidad === selected.driverId}
                    canEditAparte={canConfigureFinance(user)}
                    onPagoAparte={changePagoAparte}
                    savingAparte={savingAparte === selected.driverId}
                    onVerCalculo={(driver, filas) => setInfo({ tipo: "chofer", driver, filas })}
                    categoriaManual={categorias[selected.driverId]}
                    onCategoriaSaved={onCategoriaSaved}
                  />
                ) : (
                  <div className="glass-surface rounded-2xl px-5 py-10 text-center text-[14px] text-ink-400">Elige un chofer de la lista.</div>
                )}
              </div>
            )
          ) : (
            data.servicios && (
              <div className="glass-surface rounded-2xl p-2 sm:p-3">
                <ServiceList servicios={data.servicios} reglas={data.reglas} location={location} />
              </div>
            )
          )}

          <InfoModal
            open={Boolean(info)}
            title={info?.tipo === "chofer" ? `Cómo se calcula el pago de ${info.driver.nombre}` : "Cómo se calcula el pago"}
            onClose={() => setInfo(null)}
          >
            {info?.tipo === "chofer" && (
              <div className="mb-5 overflow-hidden rounded-xl border border-line/10">
                {info.filas.map((fila) => (
                  <div key={fila.clave} className="flex flex-col gap-1 border-t border-line/10 px-4 py-3 first:border-t-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13.5px] font-medium text-ink-50">{fila.concepto}</span>
                      <span className="text-[13.5px] font-semibold text-ink-50">{formatCurrency(fila.pago)}</span>
                    </div>
                    <span className="text-[12px] text-ink-400">{fila.cantidad}</span>
                    <span className="text-[12.5px] text-ink-200">{fila.calculo}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 border-t border-line/20 bg-line/[0.06] px-4 py-3">
                  <span className="text-[13px] font-semibold text-ink-50">Total a pagar</span>
                  <span className="text-[15px] font-bold text-ink-50">{formatCurrency(info.driver.total)}</span>
                </div>
              </div>
            )}
            {info?.tipo !== "chofer" && (
              <>
                <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-ink-400">Cálculo por categoría</p>
                <div className="mb-6">
                  <CategoriasInfo />
                </div>
              </>
            )}
            <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-ink-400">Reglas de pago vigentes</p>
            <PayRulesCard reglas={data.reglas} variant="stacked" />
          </InfoModal>
        </>
      )}
    </div>
  );
};
