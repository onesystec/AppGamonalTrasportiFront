import { useEffect, useState } from "react";
import { Alert } from "./Alert";
import { Button } from "./Button";
import { SearchableSelect } from "./SearchableSelect";
import { Select } from "./Select";
import { TextField } from "./TextField";

const DISPONIBLE_OPTIONS = [
  { value: "SI", label: "Si" },
  { value: "NO", label: "No" },
];

const INITIAL_FORM = { driverId: "", disponible: "SI", fecha: "", nota: "" };

// "Agregar chofer" en Resumen > Reperibilita: elegir CUALQUIER chofer de la empresa
// (no solo Extras Piazza) y anotarle disponibilidad y fecha/nota de un
// servicio futuro, sin necesidad de crear un Registro completo (cliente/destino) que
// todavia no esta confirmado. Mismo esqueleto visual que ConfirmModal.jsx (backdrop +
// card centrada), pero con su propio formulario en vez de la forma fija de esa.
export const AsignarServicioFuturoModal = ({ open, drivers, loading = false, error, onSubmit, onClose }) => {
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    if (open) setForm(INITIAL_FORM);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const driverOptions = drivers.map((d) => ({ value: d.id, label: `${d.nombre} ${d.apellido}` }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.driverId) return;
    onSubmit({
      driverId: form.driverId,
      disponible: form.disponible === "SI",
      fecha: form.fecha || null,
      nota: form.nota.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => !loading && onClose()}
        className="absolute inset-0 bg-backdrop backdrop-blur-sm"
      />

      <div className="glass-surface relative z-10 w-full max-w-sm rounded-3xl bg-background p-6">
        <h2 className="text-[17px] font-semibold text-ink-50">Agregar chofer</h2>
        <p className="mt-2 text-[14px] text-ink-300">
          Anota disponibilidad y (opcional) fecha/nota de un proximo servicio, para
          cualquier chofer de la empresa.
        </p>

        <Alert>{error}</Alert>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <SearchableSelect
            id="asignar-driver"
            label="Chofer"
            placeholder="Escribe para buscar un chofer"
            options={driverOptions}
            value={form.driverId}
            onChange={(v) => setField("driverId", v)}
          />

          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-ink-300">Disponible</span>
            <Select
              id="asignar-disponible"
              options={DISPONIBLE_OPTIONS}
              value={form.disponible}
              onChange={(e) => setField("disponible", e.target.value)}
            />
          </div>

          <TextField
            id="asignar-fecha"
            label="Fecha del proximo servicio (opcional)"
            type="date"
            value={form.fecha}
            onChange={(e) => setField("fecha", e.target.value)}
          />

          <TextField
            id="asignar-nota"
            label="Nota (opcional)"
            placeholder="Ej: Reparto Roma jueves"
            value={form.nota}
            onChange={(e) => setField("nota", e.target.value)}
          />

          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" className="sm:w-auto sm:px-6" disabled={loading} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="sm:w-auto sm:px-6" loading={loading} disabled={!form.driverId}>
              Guardar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
