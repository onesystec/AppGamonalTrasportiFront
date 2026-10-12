import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { DEPOT_ORIGIN_LABEL } from "../../lib/constants";
import { DestinoSugerencias } from "./DestinoSugerencias";
import { BrenneroCheckbox } from "./BrenneroCheckbox";
import { SalidaField } from "./SalidaField";

// Arma la direccion final que recibe el backend a partir de la parada (texto
// libre, puede incluir el CAP) + el campo CAP aparte (ayuda opcional para que
// la busqueda en el mapa sea mas precisa). Si el CAP ya esta en el texto no lo
// duplica.
// Una parada elegida de las sugerencias (con lat/lng) sale como { direccion, lat, lng }: no se geocodifica.
export const combineStopAddress = ({ direccion, cap, lat, lng }) => {
  const trimmedDireccion = direccion.trim();
  if (trimmedDireccion && lat != null && lng != null) return { direccion: trimmedDireccion, lat, lng };
  const trimmedCap = cap.trim();
  if (!trimmedCap || trimmedDireccion.includes(trimmedCap)) return trimmedDireccion;
  return [trimmedDireccion, trimmedCap].filter(Boolean).join(", ");
};

// Lista ordenada de paradas de un servicio. Arranca en el punto de salida (campo "Salida", ver
// SalidaField: texto libre con sugerencias; si no se pasa "salida" se muestra el deposito fijo solo como
// referencia). Cada parada tiene una
// direccion de texto libre y un CAP opcional aparte (ayuda para que el backend
// geocodifique mejor); se combinan en un solo string antes de enviar al backend.
export const StopListEditor = ({ stops, onChange, error, disabled, salida, onSalidaChange, salidaError, sugerencias, salidaPorDefecto, pasaPorBrennero, onPasaPorBrenneroChange }) => {
  const updateStop = (index, field, value) => {
    const next = [...stops];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  // Escribir a mano descarta la ubicacion exacta de una sugerencia: se geocodifica el texto al guardar.
  const typeAddress = (index, direccion) => {
    const next = [...stops];
    next[index] = { ...next[index], direccion, lat: null, lng: null };
    onChange(next);
  };

  const pickSuggestion = (index, s) => {
    const next = [...stops];
    next[index] = { ...next[index], direccion: s.label, cap: "", lat: s.lat, lng: s.lng };
    onChange(next);
  };

  const addStop = () => onChange([...stops, { direccion: "", cap: "", lat: null, lng: null }]);

  const removeStop = (index) => {
    if (stops.length === 1) return;
    onChange(stops.filter((_, i) => i !== index));
  };

  const moveStop = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= stops.length) return;
    const next = [...stops];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {salida && onSalidaChange ? (
        <>
          <SalidaField value={salida} onChange={onSalidaChange} disabled={disabled} error={salidaError} porDefecto={salidaPorDefecto} />
          {onPasaPorBrenneroChange && <BrenneroCheckbox checked={pasaPorBrennero} onChange={onPasaPorBrenneroChange} disabled={disabled} />}
        </>
      ) : (
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-300">Paradas</span>
          <p className="glass-surface-sm rounded-xl px-4 py-3 text-[14px] text-ink-300">
            Salida: {DEPOT_ORIGIN_LABEL}
          </p>
        </div>
      )}
      {salida && onSalidaChange && (
        <span className="-mb-1.5 block text-[13px] font-medium text-ink-300">Paradas</span>
      )}

      {stops.map((stop, index) => (
        <div key={index} className="flex flex-wrap items-start gap-2">
          {/* min-w-56: sin piso, el grupo direccion+CAP competia en la misma fila
              contra los 3 botones (Subir/Bajar/Eliminar) dentro del panel angosto de
              "Nuevo servicio" y quedaba comprimido a unos pocos px (bug reportado) -
              con flex-wrap en la fila y este piso, los botones pasan a la siguiente
              linea en vez de aplastar el campo. */}
          <div className="flex min-w-56 flex-1 flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <TextField
                className="flex-1"
                placeholder="Ej: Via delle Industrie, 2e, Romanengo CR"
                value={stop.direccion}
                disabled={disabled}
                onChange={(e) => typeAddress(index, e.target.value)}
              />
              <TextField
                className="sm:w-28"
                placeholder="CAP"
                value={stop.cap}
                disabled={disabled || stop.lat != null}
                onChange={(e) => updateStop(index, "cap", e.target.value)}
              />
            </div>
            <DestinoSugerencias
              sugerencias={sugerencias}
              lat={stop.lat}
              lng={stop.lng}
              disabled={disabled}
              onPick={(s) => pickSuggestion(index, s)}
            />
            {stop.lat != null && <span className="text-[12px] text-ink-400">Ubicacion exacta guardada.</span>}
          </div>
          <div className="flex shrink-0 items-center gap-3 pt-3">
            <Button
              variant="link"
              disabled={disabled || index === 0}
              onClick={() => moveStop(index, -1)}
            >
              Subir
            </Button>
            <Button
              variant="link"
              disabled={disabled || index === stops.length - 1}
              onClick={() => moveStop(index, 1)}
            >
              Bajar
            </Button>
            <Button
              variant="link"
              disabled={disabled || stops.length === 1}
              onClick={() => removeStop(index)}
            >
              Eliminar
            </Button>
          </div>
        </div>
      ))}

      {error && <span className="block text-[13px] text-danger-500">{error}</span>}

      <Button variant="ghost" className="w-auto" disabled={disabled} onClick={addStop}>
        + Agregar parada
      </Button>
    </div>
  );
};
