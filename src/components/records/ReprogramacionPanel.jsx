import { useEffect, useRef, useState } from "react";
import { Alert } from "../ui/Alert";
import { SearchableSelect } from "../ui/SearchableSelect";
import { TextField } from "../ui/TextField";
import { toRomeDateTimeInputValue } from "../../lib/format";
import { getReprogramacionKmGpsRequest, getReprogramacionPreviaRequest } from "../../lib/records.api";

// Panel que aparece bajo "Estado" al marcar un servicio como Reprogramado: los datos del servicio nuevo. El servicio original
// queda con los km que hizo el chofer y se crea otro igual (mismas paradas y ruta ya calculadas) con la nueva ETA.

export const MOTIVOS = [
  { value: "CLIENTE_NO_ESTABA", label: "Cliente no estaba" },
  { value: "AVERIA", label: "Averia" },
  { value: "TRAFICO_CLIMA", label: "Trafico o clima" },
  { value: "ERROR_DIRECCION", label: "Error de direccion" },
  { value: "PEDIDO_CLIENTE", label: "Pedido del cliente" },
  { value: "OTRO", label: "Otro" },
];
export const MOTIVO_LABEL = Object.fromEntries(MOTIVOS.map((m) => [m.value, m.label]));

export const emptyReprog = () => ({
  kmHechos: "",
  eta: "",
  fechaRetiro: "",
  motivo: "",
  cambioChofer: false,
  nuevoChoferId: "",
  cambioVehiculo: false,
  nuevoVehiculoId: "",
});

// Mensaje del primer dato obligatorio que falta ("" = todo en orden).
export const reprogError = (r, kmPlanificados) => {
  const km = Number(r.kmHechos);
  if (r.kmHechos === "" || !Number.isFinite(km) || km <= 0) return "Reprogramacion: indica cuantos km hizo el chofer";
  if (kmPlanificados > 0 && km > kmPlanificados) return `Reprogramacion: los km hechos no pueden superar los del servicio (${kmPlanificados} km)`;
  if (!r.eta) return "Reprogramacion: indica la nueva fecha y hora de la ETA";
  if (r.fechaRetiro && r.fechaRetiro >= r.eta) return "Reprogramacion: la salida tiene que ser antes de la ETA";
  if (r.cambioChofer && !r.nuevoChoferId) return "Reprogramacion: elige el chofer nuevo";
  if (r.cambioVehiculo && !r.nuevoVehiculoId) return "Reprogramacion: elige el vehiculo nuevo";
  return "";
};

export const buildReprogBody = (r) => ({
  kmHechos: Number(r.kmHechos),
  eta: r.eta,
  fechaRetiro: r.fechaRetiro || null,
  motivo: r.motivo || null,
  cambioChofer: r.cambioChofer,
  nuevoChoferId: r.cambioChofer ? r.nuevoChoferId : null,
  cambioVehiculo: r.cambioVehiculo,
  nuevoVehiculoId: r.cambioVehiculo ? r.nuevoVehiculoId : null,
});

// "2026-10-14T08:30" (hora de pared de Roma tal cual se escribio) -> "14/10/2026 08:30", sin pasar por la zona del navegador.
const wallText = (wall) => (wall ? `${wall.slice(8, 10)}/${wall.slice(5, 7)}/${wall.slice(0, 4)} ${wall.slice(11, 16)}` : "-");

const durationText = (min) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
};

const Check = ({ id, checked, onChange, disabled, children }) => (
  <label htmlFor={id} className="flex w-fit cursor-pointer items-center gap-2 text-[14px] text-ink-100">
    <input
      id={id}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 rounded border-line/20 bg-transparent accent-accent-500"
    />
    {children}
  </label>
);

export const ReprogramacionPanel = ({ record, value, onChange, driverOptions, vehicleOptions, disabled }) => {
  const [timing, setTiming] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [gps, setGps] = useState({ loading: false, fuente: null, km: null, tried: false });
  const latest = useRef(value);
  latest.current = value;
  const suggestSeq = useRef(0);

  const patch = (p) => onChange({ ...latest.current, ...p });

  // Km que hizo el vehiculo (GPS del vehiculo o, si no hay, el celular del chofer): se propone solo al abrir el panel.
  const loadGpsKm = async () => {
    setGps((g) => ({ ...g, loading: true }));
    try {
      const data = await getReprogramacionKmGpsRequest(record.id);
      setGps({ loading: false, fuente: data.fuente, km: data.km, tried: true });
      if (data.km != null && !latest.current.kmHechos) {
        const max = record.kmFacturables > 0 ? Math.min(data.km, record.kmFacturables) : data.km;
        patch({ kmHechos: String(max) });
      }
    } catch {
      setGps({ loading: false, fuente: null, km: null, tried: true });
    }
  };
  useEffect(() => {
    loadGpsKm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id]);

  // Cambiar la ETA propone la hora de salida y cambiar la salida propone la ETA (con el trafico, las paradas y los descansos).
  const suggest = async (field, wall) => {
    const seq = ++suggestSeq.current;
    setSuggesting(true);
    try {
      const data = await getReprogramacionPreviaRequest(record.id, field === "eta" ? { eta: wall } : { salida: wall });
      if (seq !== suggestSeq.current) return;
      setTiming(data.timing);
      if (data.timing) {
        if (field === "eta") patch({ fechaRetiro: toRomeDateTimeInputValue(data.timing.salidaAt) });
        else patch({ eta: toRomeDateTimeInputValue(data.timing.etaAt) });
      }
    } catch {
      if (seq === suggestSeq.current) setTiming(null);
    } finally {
      if (seq === suggestSeq.current) setSuggesting(false);
    }
  };

  const onEta = (e) => {
    patch({ eta: e.target.value });
    if (e.target.value) suggest("eta", e.target.value);
  };
  const onSalida = (e) => {
    patch({ fechaRetiro: e.target.value });
    if (e.target.value) suggest("salida", e.target.value);
  };

  // Avisos de choque del chofer y del vehiculo en esa franja.
  const driverId = value.cambioChofer && value.nuevoChoferId ? value.nuevoChoferId : "";
  const vehicleId = value.cambioVehiculo && value.nuevoVehiculoId ? value.nuevoVehiculoId : "";
  useEffect(() => {
    if (!value.eta) {
      setAvisos([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      getReprogramacionPreviaRequest(record.id, {
        eta: value.eta,
        ...(value.fechaRetiro ? { salida: value.fechaRetiro } : {}),
        ...(driverId ? { driverId } : {}),
        ...(vehicleId ? { vehicleId } : {}),
      })
        .then((data) => setAvisos(data.avisos ?? []))
        .catch(() => setAvisos([]));
    }, 500);
    return () => clearTimeout(timer);
  }, [record.id, value.eta, value.fechaRetiro, driverId, vehicleId]);

  const kmMax = record.kmFacturables;
  const kmOver = kmMax > 0 && Number(value.kmHechos) > kmMax;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-accent-500/30 bg-accent-500/5 p-4">
      <div>
        <h3 className="text-[15px] font-semibold text-ink-50">Reprogramacion</h3>
        <p className="mt-0.5 text-[12px] text-ink-400">
          Este servicio queda con los km que hizo el chofer y se crea uno nuevo igual (mismas paradas y ruta) con los datos de abajo.
          Todos son obligatorios.
        </p>
      </div>

      <div>
        <TextField
          id="reprog-km"
          label={`¿Cuantos km hizo el chofer?${kmMax > 0 ? ` (el servicio tiene ${kmMax} km)` : ""}`}
          type="number"
          step="0.1"
          min="0"
          placeholder="Km recorridos hasta ahora"
          value={value.kmHechos}
          onChange={(e) => patch({ kmHechos: e.target.value })}
          disabled={disabled}
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-400">
          <span>Reemplaza los km de este servicio: se facturan y se le pagan al chofer.</span>
          {gps.loading ? (
            <span>Buscando km del GPS…</span>
          ) : (
            <button type="button" onClick={loadGpsKm} className="font-medium text-accent-400 hover:text-accent-300">
              {gps.km != null ? `Usar los del GPS (${gps.km} km, ${gps.fuente === "CELULAR" ? "celular" : "vehiculo"})` : "Buscar km en el GPS"}
            </button>
          )}
          {gps.km != null && gps.km !== Number(value.kmHechos) && (
            <button type="button" onClick={() => patch({ kmHechos: String(kmMax > 0 ? Math.min(gps.km, kmMax) : gps.km) })} className="font-medium text-accent-400 hover:text-accent-300">
              Poner {kmMax > 0 ? Math.min(gps.km, kmMax) : gps.km}
            </button>
          )}
          {gps.tried && gps.km == null && !gps.loading && <span>El GPS no tiene el recorrido: escribelos a mano.</span>}
        </div>
        {kmOver && <p className="mt-1.5 text-[12px] text-danger-400">No pueden superar los km del servicio ({kmMax}).</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField id="reprog-eta" label="Nueva ETA" type="datetime-local" value={value.eta} onChange={onEta} disabled={disabled} />
        <TextField
          id="reprog-salida"
          label="Hora de salida (sugerida)"
          type="datetime-local"
          value={value.fechaRetiro}
          onChange={onSalida}
          disabled={disabled}
        />
      </div>
      {suggesting && <p className="-mt-2 text-[12px] text-ink-400">Calculando la hora…</p>}
      {timing && !suggesting && (
        <p className="-mt-2 text-[12px] text-ink-400">
          Sale del lugar de espera. Ruta {durationText(timing.conduccionIdaMin)} (con trafico x{timing.factorTrafico}) + {durationText(timing.paradasMin)} de paradas
          {timing.descansosIdaMin > 0 ? ` + ${durationText(timing.descansosIdaMin)} de descanso (${timing.descansoMin} min cada ${durationText(timing.descansoCadaMin)} de manejo)` : ""} ={" "}
          <b className="text-ink-200">{durationText(timing.hastaEntregaMin)}</b> hasta la entrega
          {timing.rutaFuente === "estimada" ? " (estimado en linea recta)" : ""}.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Check
          id="reprog-cambio-chofer"
          checked={value.cambioChofer}
          disabled={disabled}
          onChange={(v) => patch({ cambioChofer: v, ...(v ? {} : { nuevoChoferId: "" }) })}
        >
          ¿Se cambia de chofer?
        </Check>
        {value.cambioChofer && (
          <SearchableSelect
            id="reprog-chofer"
            label="Chofer nuevo"
            placeholder="Escribe para buscar un chofer"
            options={driverOptions.filter((o) => o.value !== record.driver?.id)}
            value={value.nuevoChoferId}
            onChange={(v) => patch({ nuevoChoferId: v })}
          />
        )}
        <Check
          id="reprog-cambio-vehiculo"
          checked={value.cambioVehiculo}
          disabled={disabled}
          onChange={(v) => patch({ cambioVehiculo: v, ...(v ? {} : { nuevoVehiculoId: "" }) })}
        >
          ¿Se cambia de vehiculo?
        </Check>
        {value.cambioVehiculo && (
          <SearchableSelect
            id="reprog-vehiculo"
            label="Vehiculo nuevo"
            placeholder="Escribe para buscar un vehiculo"
            options={vehicleOptions.filter((o) => o.value !== record.vehicle?.id)}
            value={value.nuevoVehiculoId}
            onChange={(v) => patch({ nuevoVehiculoId: v })}
          />
        )}
      </div>

      <div>
        <p className="mb-1.5 text-[12px] font-medium text-ink-300">Motivo (opcional)</p>
        <div className="flex flex-wrap gap-2">
          {MOTIVOS.map((m) => (
            <button
              key={m.value}
              type="button"
              disabled={disabled}
              onClick={() => patch({ motivo: value.motivo === m.value ? "" : m.value })}
              className={`rounded-full px-3 py-1.5 text-[13px] transition-colors ${
                value.motivo === m.value ? "bg-accent-500/25 font-medium text-accent-300" : "glass-surface-sm text-ink-200 hover:bg-line/10"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {avisos.map((a) => (
        <Alert key={a} variant="warning">
          {a}
        </Alert>
      ))}
    </div>
  );
};

// Resumen que se muestra antes de confirmar: que se copia, que se factura y a quien se avisa.
export const ReprogramacionResumen = ({ record, value, driverOptions, vehicleOptions }) => {
  const chofer = value.cambioChofer
    ? driverOptions.find((o) => o.value === value.nuevoChoferId)?.label
    : `${record.driver?.nombre ?? ""} ${record.driver?.apellido ?? ""}`.trim();
  const vehiculo = value.cambioVehiculo ? vehicleOptions.find((o) => o.value === value.nuevoVehiculoId)?.label : record.vehicle ? `${record.vehicle.targa} - ${record.vehicle.modelo}` : "";
  return (
    <div className="mt-3 flex flex-col gap-3 text-[13px] text-ink-200">
      <div className="rounded-xl glass-surface-sm px-3 py-2.5">
        <p className="font-medium text-ink-50">{record.codigo} queda Reprogramado</p>
        <p className="mt-0.5 text-ink-300">
          Con <b className="text-ink-100">{value.kmHechos} km</b> hechos: se facturan y se le pagan a {record.driver?.nombre ?? "el chofer"}.
        </p>
      </div>
      <div className="rounded-xl glass-surface-sm px-3 py-2.5">
        <p className="font-medium text-ink-50">Se crea un servicio nuevo</p>
        <ul className="mt-1 list-disc pl-4 text-ink-300">
          <li>Chofer: <b className="text-ink-100">{chofer || "-"}</b></li>
          <li>Vehiculo: <b className="text-ink-100">{vehiculo || "-"}</b></li>
          {value.fechaRetiro && <li>Sale del lugar de espera: <b className="text-ink-100">{wallText(value.fechaRetiro)}</b></li>}
          <li>ETA: <b className="text-ink-100">{wallText(value.eta)}</b></li>
          <li>Km completos del servicio: <b className="text-ink-100">{record.kmFacturables} km</b> (se facturan aparte)</li>
          <li>Paradas y ruta copiadas: no se vuelven a buscar en el mapa.</li>
          {value.motivo && <li>Motivo: {MOTIVO_LABEL[value.motivo]}</li>}
        </ul>
      </div>
      <p className="text-[12px] text-ink-400">Se le avisa al chofer del servicio nuevo{value.cambioChofer ? " y al anterior" : ""}.</p>
    </div>
  );
};
