import { useState } from "react";
import { CerrarServicioModal } from "../components/horas/CerrarServicioModal";
import { parseApiError } from "../lib/api";
import { getRecordRequest, uploadRecordFileRequest } from "../lib/records.api";

// Acciones del chofer sobre un servicio desde una lista: abrir el formulario de "Terminar servicio" / cargar horas
// y subir evidencia. `reload` vuelve a pedir la lista cuando algo cambia. Devuelve tambien el `modal` a renderizar.
export const useCerrarServicio = (reload) => {
  const [closing, setClosing] = useState(null);
  const [openingId, setOpeningId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [errors, setErrors] = useState({});

  const setError = (id, message) => setErrors((prev) => ({ ...prev, [id]: message }));

  // Se pide el servicio completo (con paradas y jornada) para precargar el formulario.
  const onClose = (recordId) => async () => {
    setOpeningId(recordId);
    setError(recordId, "");
    try {
      setClosing(await getRecordRequest(recordId));
    } catch (err) {
      setError(recordId, parseApiError(err).message);
    } finally {
      setOpeningId(null);
    }
  };

  const onUpload = (recordId) => async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingId(recordId);
    setError(recordId, "");
    try {
      await uploadRecordFileRequest(recordId, file, "BOLLA");
      reload();
    } catch (err) {
      setError(recordId, parseApiError(err).message);
    } finally {
      setUploadingId(null);
    }
  };

  const modal = closing ? (
    <CerrarServicioModal record={closing} onClose={() => setClosing(null)} onDone={reload} />
  ) : null;

  return { openingId, uploadingId, errors, onClose, onUpload, modal };
};
