import clsx from "clsx";
import { useEffect, useMemo } from "react";
import { hasNativeCamera, takeNativePhoto } from "../../lib/camera";
import { CameraIcon, PaperclipIcon } from "./icons";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const actionButton =
  "inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line/30 px-3.5 py-2 text-[13px] font-medium text-ink-50 transition-colors hover:bg-line/10";

// Selector de archivo (foto o PDF) con vista previa. `existing` es el archivo ya guardado (al editar).
// Con `camera` se muestran dos botones: "Tomar foto" (abre directo la camara del celular) y "Elegir archivo" (galeria, archivos y PDF).
// Sin `camera`, un solo selector del sistema.
export const FileField = ({ id, label, hint, file, onChange, existing, required, error, camera = false }) => {
  const preview = useMemo(
    () => (file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null),
    [file]
  );
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const pick = (e) => {
    onChange(e.target.files?.[0] ?? null);
    e.target.value = "";
  };

  const tomarFoto = async () => {
    try {
      const foto = await takeNativePhoto();
      if (foto) onChange(foto);
    } catch {
      // permiso de camara denegado: queda "Elegir archivo"
    }
  };

  const thumb = preview ? (
    <img src={preview} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
  ) : (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-line/10 text-ink-300">
      {file ? <PaperclipIcon className="h-5 w-5" /> : <CameraIcon className="h-5 w-5" />}
    </span>
  );

  const clearButton = file && (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onChange(null);
      }}
      className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-medium text-ink-300 hover:bg-line/10 hover:text-ink-50"
    >
      Quitar
    </button>
  );

  const existingLink = existing && !file && (
    <a
      href={existing.url}
      target="_blank"
      rel="noreferrer"
      className="mt-1.5 inline-block text-[12px] font-medium text-accent-400 hover:text-accent-300"
    >
      Ver archivo actual
    </a>
  );

  const heading = (
    <span className="mb-1.5 block text-[13px] font-medium text-ink-300">
      {label}
      {required && <span className="text-danger-500"> *</span>}
    </span>
  );
  const errorText = error && <span className="mt-1.5 block text-[13px] text-danger-500">{error}</span>;
  const frame = clsx("rounded-xl border border-dashed px-4 py-3", error ? "border-danger-500/70" : "border-line/30");

  if (camera) {
    return (
      <div>
        {heading}
        <div className={frame}>
          <div className="flex items-center gap-3">
            {thumb}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-ink-50">
                {file ? file.name : existing ? "Hay un archivo guardado" : "Todavia no hay archivo"}
              </span>
              <span className="block text-[12px] text-ink-400">{file ? "Se subira al guardar" : hint}</span>
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {hasNativeCamera() ? (
              <button type="button" className={actionButton} onClick={tomarFoto}>
                <CameraIcon className="h-4 w-4" />
                Tomar foto
              </button>
            ) : (
              <label htmlFor={`${id}-camara`} className={actionButton}>
                <CameraIcon className="h-4 w-4" />
                Tomar foto
                <input id={`${id}-camara`} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
              </label>
            )}
            <label htmlFor={id} className={actionButton}>
              <PaperclipIcon className="h-4 w-4" />
              {existing || file ? "Elegir otro archivo" : "Elegir archivo"}
              <input id={id} type="file" accept={ACCEPT} className="hidden" onChange={pick} />
            </label>
            {clearButton}
          </div>
        </div>
        {existingLink}
        {errorText}
      </div>
    );
  }

  return (
    <div>
      {heading}
      <label htmlFor={id} className={clsx("flex cursor-pointer items-center gap-3 transition-colors hover:bg-line/10", frame)}>
        {thumb}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-ink-50">
            {file ? file.name : existing ? "Reemplazar archivo" : "Sacar foto o elegir archivo"}
          </span>
          <span className="block text-[12px] text-ink-400">{file ? "Se subira al guardar" : hint}</span>
        </span>
        {clearButton}
        <input id={id} type="file" accept={ACCEPT} className="hidden" onChange={pick} />
      </label>
      {existingLink}
      {errorText}
    </div>
  );
};
