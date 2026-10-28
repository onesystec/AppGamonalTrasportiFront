import clsx from "clsx";
import { SALIDA_SUGERENCIAS } from "../../lib/constants";
import { TextField } from "../ui/TextField";

export const EMPTY_SALIDA = { direccion: "", lat: null, lng: null };

// Punto de salida que recibe el backend: null/undefined si esta vacio (se usa el deposito de siempre),
// { direccion, lat, lng } si viene de una sugerencia con ubicacion exacta, { direccion } si se escribio a
// mano (el backend la geocodifica).
export const buildSalidaPayload = (salida) => {
  const direccion = salida?.direccion?.trim();
  if (!direccion) return undefined;
  return salida.lat != null && salida.lng != null ? { direccion, lat: salida.lat, lng: salida.lng } : { direccion };
};

// "Salida" del servicio: campo de texto libre, en blanco al crear, con atajos de sugerencia. Elegir una
// sugerencia rellena el texto (y guarda sus coordenadas exactas); si despues se edita el texto, las
// coordenadas se descartan y la direccion se geocodifica al guardar.
export const SalidaField = ({ value, onChange, disabled, error, id = "salida", label = "Salida", sugerencias = SALIDA_SUGERENCIAS, porDefecto = "Via Walter Tobagi, 8 (DHL Milano)" }) => {
  const selected = sugerencias.find((s) => value.lat === s.lat && value.lng === s.lng);

  return (
    <div>
      <TextField
        id={id}
        label={label}
        placeholder="Escribe la direccion de salida o elige una sugerencia"
        value={value.direccion}
        disabled={disabled}
        error={error}
        onChange={(e) => onChange({ direccion: e.target.value, lat: null, lng: null })}
      />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[12px] text-ink-400">Sugerencias:</span>
        {sugerencias.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange({ direccion: s.direccion, lat: s.lat, lng: s.lng })}
            className={clsx(
              "rounded-full px-3 py-1 text-[12px] font-medium transition-colors disabled:opacity-50",
              selected?.id === s.id
                ? "bg-accent-500/20 text-accent-400"
                : "glass-surface-sm text-ink-200 hover:bg-line/10"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[12px] text-ink-400">
        {value.lat != null
          ? "Ubicacion exacta guardada."
          : value.direccion.trim()
            ? "Se ubica en el mapa al guardar."
            : `Si lo dejas vacio se usa ${porDefecto}.`}
      </p>
    </div>
  );
};
