// "¿Pasa por Brennero?": casi todos los servicios al exterior de Italia pasan primero por ahi. Marcado, la ruta (km y tiempo) se calcula
// salida -> Brennero -> paradas. Va justo despues del campo "Salida".
export const BrenneroCheckbox = ({ checked, onChange, disabled, id = "pasaPorBrennero" }) => (
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
      <span className="block text-[14px] font-medium text-ink-50">¿Pasa por Brennero?</span>
      <span className="block text-[12px] text-ink-400">
        Para servicios al exterior de Italia: la ruta, los km y el tiempo se calculan pasando por Brennero.
      </span>
    </span>
  </label>
);
