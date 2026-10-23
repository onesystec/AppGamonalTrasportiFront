import { useEffect, useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { CheckCircleIcon } from "../ui/icons";
import { Select } from "../ui/Select";
import { TextField } from "../ui/TextField";
import { Textarea } from "../ui/Textarea";
import { parseApiError } from "../../lib/api";
import { formatRomeDateTime } from "../../lib/format";
import { PERMISO_TIPOS, PERMISO_TIPOS_OFICINA } from "../../lib/permisos";
import { createPermisoRequest } from "../../lib/permisos.api";

// Solicitud de permiso (chofer) o carga de permiso / dia libre (oficina, en nombre de un chofer).
// "Fecha y hora de la solicitud" la pone el sistema: se muestra bloqueada y el servidor guarda la
// hora real, asi que no se puede cambiar ni adelantar.
export const PermisoModal = ({ initialDate, choferes, initialDriverId, onClose, onDone }) => {
  const office = Array.isArray(choferes);
  const [driverId, setDriverId] = useState(initialDriverId ?? "");
  const [tipo, setTipo] = useState("PERMISO");
  const [desde, setDesde] = useState(initialDate ?? "");
  const [hasta, setHasta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saving, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (office && !driverId) return setError("Elige el chofer");
    if (!desde) return setError("Elige la fecha");
    setSaving(true);
    try {
      const result = await createPermisoRequest({
        ...(office ? { driverId } : {}),
        tipo,
        fechaDesde: desde,
        ...(hasta ? { fechaHasta: hasta } : {}),
        motivo,
      });
      setSent(result);
      onDone?.(result);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-backdrop backdrop-blur-sm"
        onClick={() => !saving && onClose()}
      />
      <div className="glass-surface relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background p-5 sm:rounded-3xl sm:p-6">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircleIcon className="h-12 w-12 text-success-500" />
            <h2 className="text-[19px] font-semibold text-ink-50">
              {sent.estado === "APROBADO" ? "Registrado" : "Solicitud enviada"}
            </h2>
            <p className="text-[14px] text-ink-300">
              {sent.estado === "APROBADO"
                ? "Quedo guardado en el calendario."
                : "El responsable la revisara. Veras el resultado en tu calendario."}
            </p>
            {sent.excedeTope && (
              <p className="rounded-xl bg-warning-500/10 px-3 py-2 text-[12px] text-warning-500">
                Ojo: {sent.excedeTope.dias.join(", ")} ya tenia el maximo de {sent.excedeTope.tope} permisos. Quedo
                registrado igual y se supera el tope.
              </p>
            )}
            <p className="text-[12px] text-ink-400">Solicitado el {formatRomeDateTime(sent.solicitadoAt)}</p>
            <Button className="mt-2" onClick={onClose}>
              Listo
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <h2 className="text-[19px] font-semibold text-ink-50">
                {office ? "Registrar permiso o dia libre" : "Solicitar permiso"}
              </h2>
              <p className="mt-0.5 text-[13px] text-ink-300">
                {office
                  ? "Queda aprobado y aparece en el calendario del chofer."
                  : "Pidelo con anticipacion: queda registrado con la fecha y hora en que lo solicitas."}
              </p>
            </div>

            <Alert>{error}</Alert>

            {office && (
              <Select
                id="permiso-chofer"
                label="Chofer"
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                placeholder="Elige el chofer"
                options={choferes.map((c) => ({ value: c.id, label: `${c.nombre} ${c.apellido}` }))}
              />
            )}

            <Select
              id="permiso-tipo"
              label="Tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              options={office ? PERMISO_TIPOS_OFICINA : PERMISO_TIPOS}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                id="permiso-desde"
                label="Desde"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
              <TextField
                id="permiso-hasta"
                label="Hasta (opcional)"
                type="date"
                min={desde || undefined}
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>

            <Textarea
              id="permiso-motivo"
              label={tipo === "DESCANSO" ? "Nota (opcional)" : "Motivo"}
              placeholder={tipo === "DESCANSO" ? "" : "Cuenta brevemente por que necesitas el permiso"}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />

            <TextField
              id="permiso-solicitud"
              label="Fecha y hora de la solicitud (automatica)"
              value={formatRomeDateTime(now)}
              readOnly
              disabled
              tabIndex={-1}
            />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" className="sm:w-auto" disabled={saving} onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" className="sm:w-auto" loading={saving}>
                {office ? "Guardar" : "Enviar solicitud"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
