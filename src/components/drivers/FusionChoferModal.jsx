import { useEffect, useState } from "react";
import { parseApiError } from "../../lib/api";
import { fusionChoferRequest, fusionPreviewRequest, listUsersRequest } from "../../lib/users.api";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { SearchableSelect } from "../ui/SearchableSelect";
import { Spinner } from "../ui/Spinner";

// Fusiona una ficha duplicada de chofer dentro de esta (la que se conserva): todos sus servicios, horas, combustible, multas, etc. pasan a esta ficha y el
// duplicado se elimina (o se desactiva si le queda algo). Solo el Owner. Antes de confirmar se ve exactamente que se va a mover.
export const FusionChoferModal = ({ open, driver, onClose, onDone }) => {
  const [candidatos, setCandidatos] = useState([]);
  const [origenId, setOrigenId] = useState("");
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    if (!open) return;
    setOrigenId("");
    setPreview(null);
    setError("");
    setResultado(null);
    listUsersRequest()
      .then((users) => setCandidatos(users.filter((u) => u.cargo === "CHOFER" && u.id !== driver.id)))
      .catch((err) => setError(parseApiError(err).message));
  }, [open, driver.id]);

  useEffect(() => {
    if (!origenId) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    setError("");
    fusionPreviewRequest(driver.id, origenId)
      .then((data) => !cancelled && setPreview(data))
      .catch((err) => !cancelled && setError(parseApiError(err).message))
      .finally(() => !cancelled && setLoadingPreview(false));
    return () => {
      cancelled = true;
    };
  }, [origenId, driver.id]);

  if (!open) return null;

  const options = candidatos.map((u) => ({ value: u.id, label: `${u.nombre} ${u.apellido} - ${u.correoElectronico}` }));
  const nombre = `${driver.nombre} ${driver.apellido}`;

  const handleMerge = async () => {
    setMerging(true);
    setError("");
    try {
      setResultado(await fusionChoferRequest(driver.id, origenId));
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setMerging(false);
    }
  };

  const cerrar = () => {
    if (merging) return;
    if (resultado) onDone();
    onClose();
  };

  const filas = preview ? Object.entries(preview.mover) : [];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button type="button" aria-label="Cerrar" onClick={cerrar} className="absolute inset-0 bg-backdrop backdrop-blur-sm" />
      <div className="glass-surface relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-background p-6">
        <h2 className="text-[17px] font-semibold text-ink-50">Fusionar chofer duplicado</h2>

        {resultado ? (
          <>
            <Alert variant="success">
              Listo: todo pasó a {nombre}. {resultado.origenEliminado ? "La ficha duplicada se eliminó." : "La ficha duplicada quedó desactivada porque le quedaron datos que no se pudieron mover."}
            </Alert>
            <div className="mt-4 rounded-xl bg-line/[0.05] px-4 py-3 text-[13px] text-ink-200">
              {Object.entries(resultado.movido).map(([label, n]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span>{label}</span>
                  <b>{n}</b>
                </div>
              ))}
            </div>
            {!resultado.origenEliminado && Object.keys(resultado.quedaronEnElDuplicado).length > 0 && (
              <p className="mt-3 text-[13px] text-ink-300">
                Quedaron en el duplicado: {Object.entries(resultado.quedaronEnElDuplicado).map(([label, n]) => `${label} (${n})`).join(", ")}. Son busta paga del mismo mes que ya tiene esta ficha.
              </p>
            )}
            <div className="mt-6 flex justify-end">
              <Button className="sm:w-auto sm:px-6" onClick={cerrar}>
                Cerrar
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-[14px] text-ink-300">
              Esta ficha ({nombre}) es la que se <b>conserva</b>. Elige la ficha duplicada: todo lo que tenga pasa a esta y no se pierde ningún servicio.
            </p>

            <div className="mt-4">
              <SearchableSelect id="fusion-origen" label="Ficha duplicada (se elimina)" placeholder="Escribe para buscar un chofer" options={options} value={origenId} onChange={setOrigenId} />
            </div>

            {loadingPreview && (
              <div className="mt-4 flex items-center gap-2 text-[13px] text-ink-300">
                <Spinner /> Revisando qué se va a mover...
              </div>
            )}

            {preview && (
              <div className="mt-4 rounded-xl bg-line/[0.05] px-4 py-3 text-[13px] text-ink-200">
                <p className="mb-2 font-medium text-ink-50">
                  De {preview.origen.nombre} {preview.origen.apellido} a {preview.destino.nombre} {preview.destino.apellido}:
                </p>
                {filas.length === 0 ? (
                  <p className="text-ink-300">La ficha duplicada no tiene datos para mover.</p>
                ) : (
                  filas.map(([label, n]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <span>{label}</span>
                      <b>{n}</b>
                    </div>
                  ))
                )}
                {preview.bustasPagaEnConflicto > 0 && (
                  <p className="mt-2 text-warning-500">
                    {preview.bustasPagaEnConflicto} busta paga es del mismo mes que una de esta ficha y no se mueve: el duplicado quedará desactivado, no eliminado.
                  </p>
                )}
                <p className="mt-2 text-ink-300">El inicio de sesión de la ficha duplicada deja de funcionar: la persona entra con el de {preview.destino.correoElectronico}. Esta acción no se puede deshacer.</p>
              </div>
            )}

            <Alert>{error}</Alert>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="ghost" className="sm:w-auto sm:px-6" disabled={merging} onClick={cerrar}>
                Cancelar
              </Button>
              <Button variant="danger" className="sm:w-auto sm:px-6" disabled={!preview} loading={merging} onClick={handleMerge}>
                Fusionar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
