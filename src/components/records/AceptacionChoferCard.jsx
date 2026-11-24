import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { parseApiError } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { aceptarAsignacionRequest, confirmarVehiculoAsignacionRequest, listVehiculosAsignacionRequest } from "../../lib/records.api";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { GlassCard } from "../ui/GlassCard";
import { SearchableSelect } from "../ui/SearchableSelect";

export const AceptacionChoferCard = ({ record, onChanged }) => {
  const pendiente = record.aceptacionChofer === "PENDIENTE";
  const [open, setOpen] = useState(!pendiente);
  const [vehicles, setVehicles] = useState(null);
  const [vehicleId, setVehicleId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const options = useMemo(() => (vehicles ?? []).map((v) => ({ value: v.id, label: `${v.targa} · ${v.modelo}` })), [vehicles]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setVehicles(null);
    listVehiculosAsignacionRequest(record.id)
      .then((items) => { if (active) setVehicles(items); })
      .catch((err) => { if (active) setError(parseApiError(err).message); });
    return () => { active = false; };
  }, [open, record.id]);

  const aceptar = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await aceptarAsignacionRequest(record.id);
      onChanged(updated);
      setOpen(true);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const confirmar = async () => {
    setSaving(true);
    setError("");
    try {
      onChanged(await confirmarVehiculoAsignacionRequest(record.id, vehicleId));
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <GlassCard className="space-y-3">
        <h1 className="text-lg font-semibold text-ink-50">{record.codigo}</h1>
        <p className="text-sm text-ink-200">{record.destinazione} · ETA {formatDateTime(record.eta)}</p>
        <Alert>{!open && error}</Alert>
        <Button className="sm:w-auto" loading={!open && saving} onClick={pendiente ? aceptar : () => { setError(""); setOpen(true); }}>
          {pendiente ? "Aceptar servicio" : "Elegir vehículo"}
        </Button>
      </GlassCard>
      {open && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-backdrop p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="asignacion-vehiculo-titulo" className="glass-surface w-full max-w-md space-y-4 rounded-3xl bg-background p-6">
            <h2 id="asignacion-vehiculo-titulo" className="text-lg font-semibold text-ink-50">¿Con qué vehículo harás el servicio?</h2>
            {vehicles === null && !error && <p role="status" className="text-sm text-ink-300">Cargando vehículos…</p>}
            {vehicles?.length === 0 && <p className="text-sm text-ink-300">No hay vehículos disponibles.</p>}
            {options.length > 0 && (
              <SearchableSelect id="asignacion-vehiculo" label="Vehículo" placeholder="Busca por matrícula o modelo"
                options={options} value={vehicleId} onChange={setVehicleId} maxSuggestions={5} autoFocus selectSingleMatch />
            )}
            <Alert>{error}</Alert>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" className="!w-auto" disabled={saving} onClick={() => { setOpen(false); setError(""); }}>Elegir más tarde</Button>
              <Button className="!w-auto" disabled={!vehicleId} loading={saving} onClick={confirmar}>Confirmar vehículo</Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
