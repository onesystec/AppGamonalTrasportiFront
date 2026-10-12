import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { ReprogramacionResumen } from "./ReprogramacionPanel";

// Confirmacion de la reprogramacion: un resumen de lo que se va a hacer y, ya hecho, el acceso al servicio nuevo.
export const ReprogramacionModal = ({ open, record, value, driverOptions, vehicleOptions, loading, error, done, onConfirm, onCancel, onClose }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !loading) (done ? onClose : onCancel)();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading, done, onCancel, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button type="button" aria-label="Cerrar" onClick={() => !loading && (done ? onClose() : onCancel())} className="absolute inset-0 bg-backdrop backdrop-blur-sm" />
      <div className="glass-surface relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-background p-6">
        {done ? (
          <>
            <h2 className="text-[17px] font-semibold text-ink-50">Servicio reprogramado</h2>
            <p className="mt-2 text-[14px] text-ink-300">
              Se creo <b className="text-ink-50">{done.nuevo.codigo}</b> con las mismas paradas y la ruta ya calculada. Si quieres retocar algo, abre el servicio nuevo.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="ghost" className="sm:w-auto sm:px-6" onClick={onClose}>
                Cerrar
              </Button>
              <Link
                to={`/records/${done.nuevo.id}`}
                state={{ editar: true }}
                className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-[15px] font-semibold text-brand-foreground hover:bg-brand-light"
              >
                Abrir el servicio nuevo
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-[17px] font-semibold text-ink-50">Confirmar reprogramacion</h2>
            <ReprogramacionResumen record={record} value={value} driverOptions={driverOptions} vehicleOptions={vehicleOptions} />
            <Alert>{error}</Alert>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="ghost" className="sm:w-auto sm:px-6" disabled={loading} onClick={onCancel}>
                Volver
              </Button>
              <Button className="sm:w-auto sm:px-6" loading={loading} onClick={onConfirm}>
                Reprogramar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
