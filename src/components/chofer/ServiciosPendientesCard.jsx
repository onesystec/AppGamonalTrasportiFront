import clsx from "clsx";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Alert } from "../ui/Alert";
import { Spinner } from "../ui/Spinner";
import {
  CalendarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  FileTextIcon,
  RouteIcon,
  TruckIcon,
  UserIcon,
} from "../ui/icons";
import { TruckArt } from "./illustrations";
import { StatusPill } from "./StatusPill";
import { ViajeStops } from "./ViajeStops";
import { formatDateTime } from "../../lib/format";
import { pendingItems, primaryAction } from "../../lib/pendientes";

const PlayIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
  </svg>
);

const InfoItem = ({ icon: Icon, children }) => (
  <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink-200">
    <Icon className="h-4 w-4 shrink-0 text-ink-400" />
    <span className="min-w-0">{children}</span>
  </span>
);

// Que le falta, en rojo (peajes y carburante) o ambar (terminar y horas).
const PendingChips = ({ items }) => (
  <span className="flex flex-wrap items-center gap-1.5">
    {items.map((item) => (
      <span
        key={item.key}
        className={clsx(
          "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
          ["ida", "vuelta", "combustible"].includes(item.key)
            ? "bg-danger-500/15 text-danger-500"
            : "bg-warning-500/20 text-warning-500"
        )}
      >
        {item.label}
      </span>
    ))}
  </span>
);

const buttonClass =
  "group flex w-full items-center justify-between gap-3 rounded-full px-5 py-3 text-[15px] font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";

// Un servicio con algo pendiente: lo que falta y el boton para resolverlo; al abrirlo se ven los datos del
// servicio, subir evidencia y el detalle completo.
export const ServicioPendienteRow = ({ service, opening, uploading, error, onClose, onUpload }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const items = pendingItems(service);
  const action = primaryAction(items);
  const enProceso = items.some((i) => i.key === "terminar");
  const viaje = service.compactado?.principal ? service.compactado : null;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold leading-snug text-ink-50">
            {service.codigo} <span className="font-normal text-ink-300">—</span> {service.destinazione}
          </span>
          <span className="mt-0.5 block text-[12px] text-ink-400">
            {formatDateTime(service.fechaRetiro ?? service.fechaServicio)}
            {service.vehicle?.targa ? ` · ${service.vehicle.targa}` : ""}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <StatusPill estado={service.estado} />
          <ChevronDownIcon className={clsx("h-4 w-4 text-ink-400 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {viaje && (
        <>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent-300">
            <RouteIcon className="h-3.5 w-3.5" />
            Viaje compacto · {viaje.total} servicios
          </span>
          <ViajeStops compactado={viaje} />
        </>
      )}

      <PendingChips items={items} />

      {service.jornada?.estado === "DEVUELTAS" && service.jornada.nota && (
        <p className="text-[12px] text-danger-500">{service.jornada.nota}</p>
      )}

      <Alert>{error}</Alert>

      {action === "detalle" ? (
        <Link
          to={`/records/${service.id}`}
          state={{ backgroundLocation: location }}
          className={clsx(buttonClass, "bg-danger-500/15 text-danger-500 hover:bg-danger-500/25")}
        >
          <span className="w-5" />
          <span>Declarar peajes / carburante</span>
          <ChevronRightIcon className="h-5 w-5 opacity-70" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClose}
          disabled={opening}
          className={clsx(
            buttonClass,
            enProceso
              ? "bg-brand text-brand-foreground shadow-[0_8px_24px_-10px_var(--brand)] hover:brightness-105"
              : "border border-line/20 text-ink-50 hover:bg-line/10"
          )}
        >
          <span className="w-5" />
          <span className="flex items-center gap-2">
            {opening ? <Spinner className="h-4 w-4" /> : enProceso ? <PlayIcon className="h-4 w-4" /> : <ClockIcon className="h-4 w-4" />}
            {enProceso ? (viaje ? "Terminar viaje" : "Terminar servicio") : items.some((i) => i.key === "corregir") ? "Corregir horas" : "Cargar horas"}
          </span>
          <ChevronRightIcon className="h-5 w-5 opacity-70" />
        </button>
      )}

      {open && (
        <div className="flex flex-col gap-3 rounded-2xl bg-line/[0.04] p-3.5">
          {service.origen && (
            <p className="text-[12px] font-medium text-accent-400">
              Recibido de{" "}
              {service.origen.chofer ? `${service.origen.chofer.nombre} ${service.origen.chofer.apellido}` : "otro chofer"}
              {service.origen.lugar ? ` en ${service.origen.lugar}` : ""}
              {service.traspasoHora ? ` a las ${formatDateTime(service.traspasoHora)}` : ""}
            </p>
          )}
          {service.relevo && (
            <p className="text-[12px] font-medium text-accent-400">
              Lo termina {service.relevo.chofer.nombre} {service.relevo.chofer.apellido}
              {service.relevo.traspasoHora ? ` (recibio el paquete a las ${formatDateTime(service.relevo.traspasoHora)})` : ""}
            </p>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <InfoItem icon={UserIcon}>Cliente: {service.client?.nombre ?? "-"}</InfoItem>
            <InfoItem icon={CalendarIcon}>
              {service.fechaRetiro ? `Retiro: ${formatDateTime(service.fechaRetiro)}` : `Fecha: ${formatDateTime(service.fechaServicio)}`}
            </InfoItem>
            <InfoItem icon={ClockIcon}>ETA: {formatDateTime(service.eta)}</InfoItem>
            <InfoItem icon={TruckIcon}>
              Vehiculo: {service.vehicle?.targa ?? "-"}
              {service.vehicle?.modelo ? ` - ${service.vehicle.modelo}` : ""}
            </InfoItem>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            {enProceso && (
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-line/20 px-4 py-2 text-[13px] font-medium text-ink-50 transition hover:bg-line/10">
                {uploading ? <Spinner className="h-4 w-4" /> : <FileTextIcon className="h-4 w-4" />}
                Subir bolla
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onUpload} disabled={uploading} />
              </label>
            )}
            <Link
              to={`/records/${service.id}`}
              state={{ backgroundLocation: location }}
              className="text-[13px] font-medium text-accent-400 hover:text-accent-300"
            >
              Ver detalle completo &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

// Tarjeta principal del dashboard del chofer: solo los servicios que le piden algo (terminarlos, cargar horas,
// declarar peajes o carburante), con el boton para resolverlos a la vista. Lo ya resuelto vive en Mis servicios.
export const ServiciosPendientesCard = ({ services, limit = 4, openingId, uploadingId, errors, onClose, onUpload }) => {
  const enServicio = services.some((s) => s.estado === "IN_CONSEGNA" || s.estado === "RITIRATO");
  const shown = services.slice(0, limit);

  return (
    <section className="glass-surface relative overflow-hidden rounded-3xl p-5 sm:p-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 top-2 h-40 w-72 text-accent-400 opacity-[0.3] [mask-image:linear-gradient(to_left,black_35%,transparent)] sm:opacity-40"
      >
        <TruckArt className="h-full w-full" />
      </div>

      <div className="relative">
        <span
          className={clsx(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-medium",
            enServicio
              ? "bg-success-500/15 text-success-500"
              : services.length > 0
                ? "bg-warning-500/20 text-warning-500"
                : "bg-success-500/15 text-success-500"
          )}
        >
          <span
            className={clsx(
              "h-2 w-2 rounded-full",
              enServicio ? "bg-success-500" : services.length > 0 ? "bg-warning-500" : "bg-success-500"
            )}
          />
          {enServicio ? "En servicio" : services.length > 0 ? "Con pendientes" : "Todo al día"}
        </span>

        <h2 className="mt-3 text-[22px] font-semibold leading-tight text-ink-50">
          Mis servicios pendientes
          {services.length > 0 && <span className="ml-2 text-[16px] font-medium text-ink-400">({services.length})</span>}
        </h2>

        {services.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-[14px] text-ink-300">
            <CheckCircleIcon className="h-5 w-5 shrink-0 text-success-500" />
            No tienes nada pendiente: servicios, horas, peajes y carburante al día.
          </p>
        ) : (
          <div className="mt-4 flex flex-col divide-y divide-line/10">
            {shown.map((service) => (
              <div key={service.id} className="py-5 first:pt-0 last:pb-0">
                <ServicioPendienteRow
                  service={service}
                  opening={openingId === service.id}
                  uploading={uploadingId === service.id}
                  error={errors[service.id]}
                  onClose={onClose(service.id)}
                  onUpload={onUpload(service.id)}
                />
              </div>
            ))}
          </div>
        )}

        {services.length > limit && (
          <Link
            to="/mis-servicios"
            className="mt-4 inline-block text-[14px] font-medium text-accent-400 hover:text-accent-300"
          >
            Ver los {services.length} pendientes &rarr;
          </Link>
        )}
      </div>
    </section>
  );
};
