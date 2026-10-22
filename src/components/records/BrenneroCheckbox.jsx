// "¿Pasa por Brennero?" / "¿Pasa por Frejus?": casi todos los servicios al exterior de Italia pasan primero por uno de esos pasos
// (Brennero hacia Austria, Frejus hacia Francia). Marcado, la ruta (km y tiempo) se calcula salida -> paso -> paradas.
// Van justo despues del campo "Salida".
const PasoCheckbox = ({ id, checked, onChange, disabled, titulo, detalle }) => (
  <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-xl glass-surface-sm px-4 py-3">
    <input
      id={id}
      type="checkbox"
      checked={Boolean(checked)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand,#34d399)]"
    />
    <span className="min-w-0">
      <span className="block text-[14px] font-medium text-ink-50">{titulo}</span>
      <span className="block text-[12px] text-ink-400">{detalle}</span>
    </span>
  </label>
);

export const BrenneroCheckbox = ({ checked, onChange, disabled, id = "pasaPorBrennero" }) => (
  <PasoCheckbox
    id={id}
    checked={checked}
    onChange={onChange}
    disabled={disabled}
    titulo="¿Pasa por Brennero?"
    detalle="Servicios a Austria y el exterior: la ruta, los km y el tiempo se calculan pasando por Brennero."
  />
);

export const FrejusCheckbox = ({ checked, onChange, disabled, id = "pasaPorFrejus" }) => (
  <PasoCheckbox
    id={id}
    checked={checked}
    onChange={onChange}
    disabled={disabled}
    titulo="¿Pasa por Frejus?"
    detalle="Servicios a Francia: la ruta, los km y el tiempo se calculan pasando por el tunel de Frejus."
  />
);

// Los dos pasos uno al lado del otro. `onFrejus` ausente: solo Brennero.
export const PasosFronteraCheckboxes = ({ brennero, onBrennero, frejus, onFrejus, disabled }) => (
  <div className="grid gap-3 sm:grid-cols-2">
    <BrenneroCheckbox checked={brennero} onChange={onBrennero} disabled={disabled} />
    {onFrejus && <FrejusCheckbox checked={frejus} onChange={onFrejus} disabled={disabled} />}
  </div>
);
