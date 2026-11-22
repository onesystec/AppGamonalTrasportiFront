import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { parseApiError } from "../../lib/api";
import { updateRecordRequest } from "../../lib/records.api";
import { listUsersRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

// Chofer y vehiculo de una fila del Registro, editables ahi mismo: al tocar el valor se abre la lista, se elige y se guarda al instante. Lo que falta por asignar se
// ve en rojo para que se note (salvo en un servicio anulado, donde asignarlo no tiene sentido). Un servicio ya terminado, anulado o reprogramado no se edita.
export const SIN_ASIGNAR_TARGA = "SIN-ASIGNAR";
export const vehiculoSinAsignar = (record) => record.vehicle?.targa === SIN_ASIGNAR_TARGA;
export const choferSinAsignar = (record) => record.driver?.nombre === "Sin asignar" && !record.driver?.apellido;
const NO_EDITABLES = ["CONSEGNATO", "ANNULLATO", "RISCHEDULATO"];

// Las listas para elegir se piden una vez y se reutilizan un rato (hay muchas filas en pantalla).
let cache = null;
const cargarOpciones = () => {
  if (cache && Date.now() - cache.at < 60_000) return cache.promise;
  const promise = Promise.all([listUsersRequest(), listVehiclesRequest()]).then(([users, vehicles]) => ({
    drivers: users.filter((u) => u.estado === "ACTIVO").sort((a, b) => `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`)),
    vehicles: vehicles.filter((v) => v.targa !== SIN_ASIGNAR_TARGA).sort((a, b) => a.targa.localeCompare(b.targa)),
  }));
  cache = { at: Date.now(), promise };
  promise.catch(() => {
    cache = null;
  });
  return promise;
};

export const CeldaAsignable = ({ record, campo, editable = false, onSaved }) => {
  const esVehiculo = campo === "vehicle";
  const anulado = record.estado === "ANNULLATO";
  const sinAsignar = esVehiculo ? vehiculoSinAsignar(record) : choferSinAsignar(record);
  // Rojo = falta asignarlo. Un servicio anulado no necesita asignacion: no lleva la alerta.
  const alerta = sinAsignar && !anulado;
  const puedeEditar = editable && !NO_EDITABLES.includes(record.estado);
  const [editando, setEditando] = useState(false);
  const [opciones, setOpciones] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const selectRef = useRef(null);

  useEffect(() => {
    if (!editando) return undefined;
    let cancelado = false;
    cargarOpciones()
      .then((o) => !cancelado && setOpciones(o))
      .catch((err) => {
        if (cancelado) return;
        setError(parseApiError(err).message);
        setEditando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [editando]);

  useEffect(() => {
    if (editando && opciones) selectRef.current?.focus();
  }, [editando, opciones]);

  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => setError(""), 6000);
    return () => clearTimeout(t);
  }, [error]);

  const elegir = async (id) => {
    if (!id) return;
    setGuardando(true);
    setError("");
    const payload = esVehiculo ? { vehicleId: id } : { driverId: id };
    // Al elegir el chofer de un servicio sin vehiculo se propone el habitual de ese chofer (como en "Asignar chofer y vehiculo").
    if (!esVehiculo && vehiculoSinAsignar(record)) {
      const habitual = opciones?.drivers.find((d) => d.id === id)?.vehiculoAsignadoId;
      if (habitual && opciones?.vehicles.some((v) => v.id === habitual)) payload.vehicleId = habitual;
    }
    try {
      await updateRecordRequest(record.id, payload);
      setEditando(false);
      onSaved?.();
    } catch (err) {
      setError(parseApiError(err).message);
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  };

  const etiqueta = esVehiculo ? "vehículo" : "chofer";
  const valorActual = esVehiculo ? record.vehicle?.id : record.driver?.id;

  const contenido = esVehiculo ? (
    <>
      <span className="block truncate">{sinAsignar ? "Sin asignar" : (record.vehicle?.targa ?? "-")}</span>
      <span className={clsx("block truncate text-[11px]", alerta ? "text-danger-500/80" : "text-ink-400")}>{sinAsignar ? (alerta ? "Falta asignar" : "") : (record.vehicle?.modelo ?? "")}</span>
    </>
  ) : (
    <>
      <span className="block truncate">{sinAsignar ? "Sin asignar" : `${record.driver?.nombre ?? ""} ${record.driver?.apellido ?? ""}`.trim() || "—"}</span>
      {alerta && <span className="block truncate text-[11px] text-danger-500/80">Falta asignar</span>}
    </>
  );

  const estilo = clsx(
    "block w-full min-w-0 rounded-lg px-2 py-1 text-left",
    alerta ? "border border-danger-500/60 bg-danger-500/10 font-semibold text-danger-500" : sinAsignar ? "text-ink-500" : "text-ink-100"
  );

  return (
    <span className="relative block min-w-0">
      {editando ? (
        <select
          ref={selectRef}
          aria-label={`Elegir ${etiqueta}`}
          disabled={!opciones || guardando}
          defaultValue=""
          onChange={(e) => void elegir(e.target.value)}
          onBlur={() => !guardando && setEditando(false)}
          className="w-full rounded-lg border border-accent-500/60 bg-background px-2 py-1.5 text-[12px] text-ink-50"
        >
          {!opciones ? (
            <option value="">Cargando…</option>
          ) : (
            <>
              <option value="" disabled>
                Elige {esVehiculo ? "el vehículo" : "el chofer"}…
              </option>
              {(esVehiculo ? opciones.vehicles : opciones.drivers).map((o) => (
                <option key={o.id} value={o.id} disabled={o.id === valorActual}>
                  {esVehiculo ? `${o.targa} - ${o.modelo}` : `${o.nombre} ${o.apellido}`}
                </option>
              ))}
            </>
          )}
        </select>
      ) : puedeEditar ? (
        <button
          type="button"
          title={sinAsignar ? `Asignar ${etiqueta}` : `Cambiar ${etiqueta}`}
          onClick={() => setEditando(true)}
          className={clsx(estilo, "cursor-pointer transition-colors", alerta ? "hover:bg-danger-500/20" : "hover:bg-line/10")}
        >
          {contenido}
        </button>
      ) : (
        <span className={estilo}>{contenido}</span>
      )}
      {guardando && <span className="absolute right-2 top-1.5 text-[10px] text-ink-400">Guardando…</span>}
      {error && (
        <span role="alert" className="absolute left-0 top-full z-10 mt-1 w-56 rounded-lg bg-danger-500 px-2 py-1 text-[11px] font-medium text-white shadow-lg">
          {error}
        </span>
      )}
    </span>
  );
};
