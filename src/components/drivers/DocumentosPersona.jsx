import { useEffect, useState } from "react";
import { parseApiError } from "../../lib/api";
import { TIPO_DOCUMENTO_OPTIONS } from "../../lib/constants";
import { createDocumentRequest, listDocumentsRequest, updateDocumentRequest } from "../../lib/documents.api";
import { formatDate, toDateInputValue } from "../../lib/format";
import { Alert } from "../ui/Alert";
import { GlassCard } from "../ui/GlassCard";
import { Spinner } from "../ui/Spinner";

// Fila de un documento: atenuada si todavia no se subio, con boton para subir/reemplazar en edicion
// y su propia fecha de vencimiento (solo editable una vez que el archivo ya existe).
const DocumentRow = ({
  label,
  document,
  editing,
  uploading,
  error,
  onUpload,
  onDateChange,
  savingDate,
  noTiene = false,
}) => {
  const hasDoc = Boolean(document);
  return (
    <div
      className={`glass-surface-sm rounded-xl px-4 py-3 ${hasDoc || editing ? "" : "opacity-40"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="block text-[12px] uppercase tracking-wide text-ink-400">{label}</span>
          {hasDoc ? (
            <a
              href={document.archivoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[14px] text-accent-400 hover:text-accent-300"
            >
              Ver documento
            </a>
          ) : (
            <span className="text-[14px] text-ink-50">{noTiene ? "El chofer indico que no lo tiene" : "Sin subir"}</span>
          )}
          {error && <span className="mt-1 block text-[12px] text-danger-500">{error}</span>}
        </div>

        {editing && (
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full glass-input px-3 py-1.5 text-[12px] font-medium text-ink-50 hover:bg-line/10">
            {uploading ? <Spinner className="h-3.5 w-3.5" /> : hasDoc ? "Reemplazar" : "Subir"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={onUpload}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {hasDoc && (
        <div className="mt-2 border-t border-line/10 pt-2">
          {editing ? (
            <label className="flex items-center gap-2">
              <span className="shrink-0 text-[11px] uppercase tracking-wide text-ink-400">
                Vence
              </span>
              <input
                type="date"
                defaultValue={toDateInputValue(document.fechaScadenza)}
                onChange={onDateChange}
                disabled={savingDate}
                className="glass-input w-full rounded-lg px-2 py-1 text-[13px] text-ink-50"
              />
              {savingDate && <Spinner className="h-3.5 w-3.5" />}
            </label>
          ) : (
            <span
              className={`block text-[12px] ${document.fechaScadenza ? "text-ink-300" : "text-ink-400 opacity-60"}`}
            >
              Vence: {document.fechaScadenza ? formatDate(document.fechaScadenza) : "Sin completar"}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export const DocumentosPersona = ({ usuarioId, documentosNoTiene, editing }) => {
  const [documents, setDocuments] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [documentUploading, setDocumentUploading] = useState({});
  const [documentErrors, setDocumentErrors] = useState({});
  const [documentDateSaving, setDocumentDateSaving] = useState({});

  useEffect(() => {
    let active = true;
    listDocumentsRequest(usuarioId)
      .then((docs) => { if (active) setDocuments(docs); })
      .catch((err) => { if (active) setLoadError(parseApiError(err).message); });
    return () => { active = false; };
  }, [usuarioId]);

  const documentsByType = {};
  for (const document of documents ?? []) {
    documentsByType[document.tipoDocumento] ??= document;
  }

  const handleDocumentUpload = (tipoDocumento) => async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setDocumentUploading((prev) => ({ ...prev, [tipoDocumento]: true }));
    setDocumentErrors((prev) => ({ ...prev, [tipoDocumento]: "" }));

    try {
      const existing = documentsByType[tipoDocumento];
      const updatedDoc = existing
        ? await updateDocumentRequest(existing.id, { file })
        : await createDocumentRequest(usuarioId, tipoDocumento, file);
      setDocuments((prev) => [updatedDoc, ...(prev ?? []).filter((d) => d.id !== updatedDoc.id)]);
    } catch (err) {
      setDocumentErrors((prev) => ({ ...prev, [tipoDocumento]: parseApiError(err).message }));
    } finally {
      setDocumentUploading((prev) => ({ ...prev, [tipoDocumento]: false }));
    }
  };

  const handleDocumentDateChange = (tipoDocumento) => async (e) => {
    const value = e.target.value;
    const existing = documentsByType[tipoDocumento];
    if (!existing || !value) return;

    setDocumentDateSaving((prev) => ({ ...prev, [tipoDocumento]: true }));
    setDocumentErrors((prev) => ({ ...prev, [tipoDocumento]: "" }));

    try {
      const updatedDoc = await updateDocumentRequest(existing.id, { fechaScadenza: value });
      setDocuments((prev) => [updatedDoc, ...(prev ?? []).filter((d) => d.id !== updatedDoc.id)]);
    } catch (err) {
      setDocumentErrors((prev) => ({ ...prev, [tipoDocumento]: parseApiError(err).message }));
    } finally {
      setDocumentDateSaving((prev) => ({ ...prev, [tipoDocumento]: false }));
    }
  };

  if (loadError) return <Alert>{loadError}</Alert>;
  if (documents === null) return <Spinner />;

  return (
      <GlassCard>
        <h2 className="text-[17px] font-medium text-ink-50">Documentos</h2>
        <p className="mt-1 text-[13px] text-ink-300">
          Sube una foto o un PDF para completar cada documento. Después puedes indicar su vencimiento.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TIPO_DOCUMENTO_OPTIONS.map((option) => (
            <DocumentRow
              key={option.value}
              label={option.label}
              document={documentsByType[option.value]}
              editing={editing}
              uploading={Boolean(documentUploading[option.value])}
              error={documentErrors[option.value]}
              onUpload={handleDocumentUpload(option.value)}
              onDateChange={handleDocumentDateChange(option.value)}
              savingDate={Boolean(documentDateSaving[option.value])}
              noTiene={Boolean(documentosNoTiene?.includes(option.value))}
            />
          ))}
        </div>
      </GlassCard>
  );
};
