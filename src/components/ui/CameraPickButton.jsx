import { hasNativeCamera, takeNativePhoto } from "../../lib/camera";
import { CameraIcon } from "./icons";

// Boton "Tomar foto": abre directo la camara trasera del celular (solo imagenes). Va al lado del boton de elegir archivo de cada
// pantalla (que sigue aceptando galeria y PDF); usa el mismo manejador, que recibe un evento con `target.files`.
export const CameraPickButton = ({ onChange, disabled, className, label = "Tomar foto" }) => {
  if (hasNativeCamera()) {
    const tomar = async () => {
      try {
        const file = await takeNativePhoto();
        if (file) onChange({ target: { files: [file], value: "" } });
      } catch {
        // la persona nego el permiso de camara o el sistema fallo: puede usar "Elegir foto o archivo"
      }
    };
    return (
      <button type="button" className={className} onClick={tomar} disabled={disabled}>
        <CameraIcon className="h-4 w-4" />
        {label}
      </button>
    );
  }
  return (
    <label className={className}>
      <CameraIcon className="h-4 w-4" />
      {label}
      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onChange} disabled={disabled} />
    </label>
  );
};
