import { CameraIcon } from "./icons";

// Boton "Tomar foto": abre directo la camara del celular (solo imagenes). Va al lado del boton de elegir archivo de cada pantalla
// (que sigue aceptando galeria y PDF); usa el mismo manejador, que recibe el evento del input.
export const CameraPickButton = ({ onChange, disabled, className, label = "Tomar foto" }) => (
  <label className={className}>
    <CameraIcon className="h-4 w-4" />
    {label}
    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onChange} disabled={disabled} />
  </label>
);
