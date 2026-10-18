import { useEffect, useMemo } from "react";
import { CameraIcon, CloseIcon, FileTextIcon, PlusIcon } from "./icons";

// Selector de varias fotos o PDF con vista previa. `files` son los nuevos (File[]); `existing` los ya guardados al editar
// ({ id, url, esPdf }) y `removed` los ids de esos que se van a quitar. En el celular el selector del sistema ofrece sacar la foto.
export const FilesField = ({ id, label, hint, files, onChange, existing = [], removed = [], onRemoveExisting, max = 10, disabled }) => {
  const previews = useMemo(() => files.map((file) => (file.type.startsWith("image/") ? URL.createObjectURL(file) : null)), [files]);
  useEffect(() => () => previews.forEach((url) => url && URL.revokeObjectURL(url)), [previews]);

  const kept = existing.filter((f) => !removed.includes(f.id));
  const total = kept.length + files.length;
  const canAdd = total < max;

  const addFiles = (event) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (picked.length) onChange([...files, ...picked].slice(0, Math.max(0, max - kept.length)));
  };

  const thumb = "relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-line/10 text-ink-300";
  const removeBtn = "absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80";

  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-300">{label}</span>
      <div className="flex flex-wrap gap-2.5">
        {kept.map((f, index) => (
          <div key={f.id} className={thumb}>
            <a href={f.url} target="_blank" rel="noreferrer" className="flex h-full w-full items-center justify-center" title="Abrir">
              {f.esPdf ? <FileTextIcon className="h-6 w-6" /> : <img src={f.url} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />}
            </a>
            <button type="button" onClick={() => onRemoveExisting?.(f.id)} disabled={disabled} aria-label="Quitar archivo" className={removeBtn}>
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {files.map((file, index) => (
          <div key={`${file.name}-${index}`} className={thumb}>
            {previews[index] ? <img src={previews[index]} alt="" className="h-full w-full object-cover" /> : <FileTextIcon className="h-6 w-6" />}
            <button
              type="button"
              onClick={() => onChange(files.filter((_, i) => i !== index))}
              disabled={disabled}
              aria-label={`Quitar ${file.name}`}
              className={removeBtn}
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {canAdd && (
          <label
            htmlFor={id}
            className="flex h-20 min-w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line/30 px-3 text-ink-300 transition-colors hover:bg-line/10"
          >
            {total === 0 ? <CameraIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
            <span className="text-[12px] font-medium">{total === 0 ? "Agregar fotos" : "Agregar más"}</span>
            <input id={id} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={addFiles} disabled={disabled} />
          </label>
        )}
      </div>
      <span className="mt-1.5 block text-[12px] text-ink-400">
        {total > 0 ? `${total} ${total === 1 ? "archivo" : "archivos"} (máximo ${max}). ` : ""}
        {hint}
      </span>
    </div>
  );
};
