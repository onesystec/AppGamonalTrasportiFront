import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { AreaBadge } from "./AreaBadge";
import { AsignarModal } from "./AsignarModal";
import { Button } from "../ui/Button";
import { ChevronDownIcon, UserCheckIcon } from "../ui/icons";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { startVisibleInterval } from "../../lib/polling";
import { classifyRecord } from "../../lib/recordAreas";
import { listSinAsignarRequest } from "../../lib/records.api";

const REFRESH_MS = 60 * 1000;
const VISIBLES_AL_INICIO = 4;

const ROMA = "Europe/Rome";
const diaRoma = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: ROMA });

// "Hoy 14:30", "Manana 09:00" o "13/11 09:00" (hora de Italia), y si ya paso la hora, marcado como vencido.
const etiquetaEta = (eta) => {
  const fecha = new Date(eta);
  const hora = fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ROMA });
  const dia = diaRoma(fecha);
  const hoy = diaRoma(new Date());
  const manana = diaRoma(new Date(Date.now() + 86400000));
  const texto = dia === hoy ? `Hoy ${hora}` : dia === manana ? `Mañana ${hora}` : `${fecha.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", timeZone: ROMA })} ${hora}`;
  return { texto, vencido: fecha.getTime() < Date.now() };
};

const Tarjeta = ({ record, onAsignar }) => {
  const { texto, vencido } = etiquetaEta(record.eta);
  const faltaChofer = record.driver?.nombre === "Sin asignar" && !record.driver?.apellido;
  const faltaVehiculo = record.vehicle?.targa === "SIN-ASIGNAR";
  return (
    <li className={clsx("glass-surface-sm flex flex-col gap-3 rounded-2xl border-l-4 p-3.5 sm:flex-row sm:items-center sm:gap-4", vencido ? "border-l-danger-500" : "border-l-warning-500")}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 sm:justify-start">
          <span className="flex min-w-0 items-center gap-2">
            <AreaBadge areaKey={classifyRecord(record)} size={22} />
            <span className="truncate text-[14px] font-semibold text-ink-50">{record.shipment || record.codigo}</span>
          </span>
          <span className={clsx("shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold", vencido ? "bg-danger-500/15 text-danger-500" : "bg-warning-500/15 text-warning-500")}>{texto}</span>
        </div>
        <p className="mt-1 truncate text-[13px] text-ink-100">{record.destinazione}</p>
        <p className="truncate text-[12px] text-ink-400">
          {record.client?.nombre ?? "Sin cliente"}
          {record.kilometros != null ? ` · ${Math.round(record.kilometros)} km` : ""}
          {faltaChofer && faltaVehiculo ? " · falta chofer y vehiculo" : faltaChofer ? " · falta chofer" : faltaVehiculo ? " · falta vehiculo" : ""}
        </p>
      </div>
      <Button className="!w-full px-5 py-3 text-[14px] sm:!w-auto sm:py-2.5" onClick={() => onAsignar(record)}>
        Asignar
      </Button>
    </li>
  );
};

// Panel de arriba del Registro (solo la oficina): los servicios que todavia no tienen chofer o vehiculo, de cualquier fecha y los mas proximos primero, con un boton grande
// para asignarlos. Es lo unico que la oficina tiene que hacer con los servicios que cargan los clientes. Se oculta cuando no queda ninguno.
export const PorAsignar = () => {
  const { version, refresh: refreshRecords } = useDataRefresh("records");
  const [records, setRecords] = useState(null);
  const [verTodos, setVerTodos] = useState(false);
  const [asignando, setAsignando] = useState(null);

  const cargar = useCallback(
    () =>
      listSinAsignarRequest()
        .then(setRecords)
        .catch(() => {}),
    []
  );

  useEffect(() => {
    cargar();
    return startVisibleInterval(cargar, REFRESH_MS);
  }, [cargar, version]);

  if (!records || records.length === 0) return null;
  const mostrados = verTodos ? records : records.slice(0, VISIBLES_AL_INICIO);

  return (
    // En el telefono sube al principio de la pagina (antes de los botones de la cabecera, que ocupan casi toda la primera pantalla); en pantallas grandes va debajo del titulo.
    <section className="glass-surface order-first rounded-3xl border border-warning-500/30 p-4 sm:p-5 lg:order-none" aria-label="Servicios por asignar">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-500/15 text-warning-500">
            <UserCheckIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[16px] font-semibold text-ink-50">
              Por asignar
              <span className="rounded-full bg-warning-500 px-2 py-0.5 text-[12px] font-bold text-black">{records.length}</span>
            </h2>
            <p className="text-[12px] text-ink-300">Servicios sin chofer o sin vehiculo. Asigna y desaparecen de aqui.</p>
          </div>
        </div>
      </header>
      <ul className="flex flex-col gap-2.5">
        {mostrados.map((r) => (
          <Tarjeta key={r.id} record={r} onAsignar={setAsignando} />
        ))}
      </ul>
      {records.length > VISIBLES_AL_INICIO && (
        <button
          type="button"
          onClick={() => setVerTodos((v) => !v)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-medium text-accent-400 hover:bg-line/10"
        >
          {verTodos ? "Ver menos" : `Ver los ${records.length} servicios`}
          <ChevronDownIcon className={clsx("h-4 w-4 transition-transform", verTodos && "rotate-180")} />
        </button>
      )}
      {asignando && (
        <AsignarModal
          record={asignando}
          onClose={() => setAsignando(null)}
          onSaved={() => {
            setAsignando(null);
            refreshRecords();
            cargar();
          }}
        />
      )}
    </section>
  );
};
