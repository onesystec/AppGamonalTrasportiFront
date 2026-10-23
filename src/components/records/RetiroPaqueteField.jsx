import { useState } from "react";
import { TextField } from "../ui/TextField";

// "El paquete se retira antes de salir": cuando el paquete se retira un dia (viernes) y se entrega otro (lunes), la
// "Fecha retiro" tiene que ser la hora en que sale a entregar (de ahi cuentan las horas) y aca se anota, solo como
// informacion, cuando se retira el paquete. `value` = "AAAA-MM-DDTHH:mm" (hora de Roma) o "".
export const RetiroPaqueteField = ({ value, onChange, fechaRetiro, error }) => {
  const [open, setOpen] = useState(Boolean(value));

  const toggle = (checked) => {
    setOpen(checked);
    if (!checked) onChange("");
  };

  return (
    <div className="sm:col-span-2">
      <label className="flex items-start gap-2.5 text-[14px] text-ink-100">
        <input
          type="checkbox"
          checked={open}
          onChange={(e) => toggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line/20 bg-transparent accent-accent-500"
        />
        <span>
          El paquete se retira antes de salir a entregarlo
          <span className="block text-[12px] text-ink-400">
            Por ejemplo, se retira el viernes y se entrega el lunes: el chofer lo guarda y sale despues.
          </span>
        </span>
      </label>
      {open && (
        <div className="mt-3 max-w-md">
          <TextField
            id="retiroPaqueteAt"
            label="Retiro del paquete"
            type="datetime-local"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            error={error}
          />
          <p className="mt-1.5 text-[12px] text-ink-400">
            Es solo informativo. Las horas del chofer, el dia del servicio y los peajes cuentan desde la "Fecha retiro" de
            arriba, que aca tiene que ser la hora en que sale a entregar.
            {value && fechaRetiro && value >= fechaRetiro && (
              <span className="mt-1 block text-warning-500">El retiro del paquete tendria que ser antes de la salida a entregar.</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
};
