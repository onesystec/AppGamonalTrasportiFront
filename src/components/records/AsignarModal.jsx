import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { SearchableSelect } from "../ui/SearchableSelect";
import { CloseIcon } from "../ui/icons";
import { parseApiError } from "../../lib/api";
import { updateRecordRequest } from "../../lib/records.api";
import { listUsersRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

// Asignar chofer y vehiculo a un servicio que entro sin ellos (los que carga el cliente desde su portal). Es lo unico que tiene que hacer la oficina con esos
// servicios. Al elegir el chofer se propone su vehiculo habitual.
export const AsignarModal = ({ record, onClose, onSaved }) => {
  const [drivers, setDrivers] = useState(null);
  const [vehicles, setVehicles] = useState(null);
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([listUsersRequest(), listVehiclesRequest()])
      .then(([users, vehiclesData]) => {
        setDrivers(users.filter((u) => u.estado === "ACTIVO"));
        setVehicles(vehiclesData);
      })
      .catch((err) => setError(parseApiError(err).message));
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const elegirChofer = (id) => {
    setDriverId(id);
    const habitual = drivers?.find((d) => d.id === id)?.vehiculoAsignadoId;
    if (habitual && !vehicleId && vehicles?.some((v) => v.id === habitual)) setVehicleId(habitual);
  };

  const guardar = async () => {
    setSaving(true);
    setError("");
    try {
      await updateRecordRequest(record.id, { driverId, vehicleId });
      onSaved();
    } catch (err) {
      setError(parseApiError(err).message);
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Asignar chofer y vehiculo">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-backdrop backdrop-blur-sm" />
      <div className="glass-surface relative z-10 w-full max-w-md rounded-3xl bg-background p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold text-ink-50">Asignar chofer y vehiculo</h2>
            <p className="mt-0.5 truncate text-[12px] text-ink-300">
              {record.codigo} · {record.destinazione}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-ink-300 hover:bg-line/10 hover:text-ink-50">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <Alert>{error}</Alert>
        {!drivers && !error && <p className="py-6 text-center text-[13px] text-ink-300">Cargando…</p>}
        {drivers && vehicles && (
          <div className="flex flex-col gap-4">
            <SearchableSelect
              id="asignar-chofer"
              label="Chofer"
              placeholder="Escribe para buscar un chofer"
              options={drivers.map((d) => ({ value: d.id, label: `${d.nombre} ${d.apellido}` }))}
              value={driverId}
              onChange={elegirChofer}
            />
            <SearchableSelect
              id="asignar-vehiculo"
              label="Vehiculo"
              placeholder="Escribe para buscar un vehiculo"
              options={vehicles.map((v) => ({ value: v.id, label: `${v.targa} - ${v.modelo}` }))}
              value={vehicleId}
              onChange={setVehicleId}
            />
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="ghost" className="!w-auto px-4 py-2 text-[13px]" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button className="!w-auto px-5 py-2 text-[13px]" loading={saving} disabled={!driverId || !vehicleId} onClick={guardar}>
                Asignar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
