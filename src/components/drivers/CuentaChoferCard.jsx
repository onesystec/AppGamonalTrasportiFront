import { useState } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { CopyButton } from "../ui/CopyButton";
import { GlassCard } from "../ui/GlassCard";
import { KeyIcon } from "../ui/icons";
import { PasswordField } from "../ui/PasswordField";
import { parseApiError } from "../../lib/api";
import { APP_URL, enlaceWhatsapp, generarPassword, mensajeCuenta, numeroWhatsapp } from "../../lib/cuentaWhatsapp";
import { updateUserRequest } from "../../lib/users.api";

const WhatsappIcon = ({ className = "h-[18px] w-[18px]" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z" />
  </svg>
);

const Fila = ({ label, value, copy = true }) => (
  <div className="flex items-center justify-between gap-3 rounded-xl glass-surface-sm px-4 py-3">
    <div className="min-w-0">
      <p className="text-[12px] text-ink-400">{label}</p>
      <p className="truncate text-[15px] text-ink-50">{value || "Sin completar"}</p>
    </div>
    {copy && value && <CopyButton value={value} label={`Copiar ${label.toLowerCase()}`} iconClassName="h-4 w-4" />}
  </div>
);

// Cuenta de acceso del chofer: su usuario y la app, para mandarselos por WhatsApp.
// La contrasena actual no se puede ver (se guarda cifrada): el Admin puede poner una nueva y mandarla.
export const CuentaChoferCard = ({ driver, isAdmin, onUpdated }) => {
  const [password, setPassword] = useState("");
  const [enviable, setEnviable] = useState(""); // la contrasena recien guardada, para incluirla en el mensaje
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(false);

  const texto = mensajeCuenta({ nombre: driver.nombre, correo: driver.correoElectronico, password: enviable });
  const sinNumero = !numeroWhatsapp(driver.numeroCelular);

  const guardar = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await updateUserRequest(driver.id, { password });
      setEnviable(password);
      setPassword("");
      setAbierto(false);
      onUpdated?.(updated);
    } catch (err) {
      const parsed = parseApiError(err);
      setError(parsed.fieldErrors?.password?.[0] ?? parsed.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassCard>
      <div className="flex items-center gap-2">
        <KeyIcon className="h-5 w-5 text-accent-400" />
        <h2 className="text-[17px] font-semibold text-ink-50">Cuenta de acceso</h2>
      </div>
      <p className="mt-1 text-[13px] text-ink-300">Con estos datos entra a la app.</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Fila label="Usuario" value={driver.correoElectronico} />
        <Fila label="Celular" value={driver.numeroCelular} copy={false} />
        <div className="sm:col-span-2">
          <Fila label="App" value={APP_URL} />
        </div>
        <div className="sm:col-span-2">
          <Fila
            label="Contraseña"
            value={enviable || "•••••••• (guardada cifrada, no se puede ver)"}
            copy={Boolean(enviable)}
          />
        </div>
      </div>

      {enviable && (
        <div className="mt-4">
          <Alert variant="success">
            Contraseña nueva guardada. Mándasela ahora por WhatsApp: al salir de esta pantalla ya no se vuelve a mostrar.
          </Alert>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <a
          href={enlaceWhatsapp(driver.numeroCelular, texto)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-[15px] font-semibold text-[#0b2e1a] transition hover:brightness-95 active:scale-[0.98]"
        >
          <WhatsappIcon />
          {enviable ? "Enviar usuario y contraseña" : "Enviar acceso por WhatsApp"}
        </a>
        {isAdmin && !abierto && (
          <Button variant="ghost" className="sm:w-auto sm:px-6" onClick={() => { setAbierto(true); setError(""); }}>
            Cambiar contraseña
          </Button>
        )}
      </div>
      {sinNumero && (
        <p className="mt-2 text-[12px] text-ink-400">No tiene un celular válido: WhatsApp se abrirá para que elijas el contacto.</p>
      )}

      {isAdmin && abierto && (
        <div className="mt-5 flex flex-col gap-3 border-t border-line/10 pt-5">
          <Alert>{error}</Alert>
          <PasswordField
            id="cuenta-password"
            label="Contraseña nueva"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="ghost" className="sm:w-auto sm:px-5" onClick={() => setPassword(generarPassword())}>
              Generar una
            </Button>
            <Button className="sm:w-auto sm:px-6" loading={saving} disabled={password.length < 8} onClick={guardar}>
              Guardar contraseña
            </Button>
            <Button variant="link" className="sm:ml-auto" onClick={() => { setAbierto(false); setPassword(""); }}>
              Cancelar
            </Button>
          </div>
          <p className="text-[12px] text-ink-400">Al cambiarla se cierran las sesiones abiertas del chofer.</p>
        </div>
      )}

      {!isAdmin && (
        <p className="mt-4 text-[12px] text-ink-400">Solo el Admin puede cambiar contraseñas y crear cuentas.</p>
      )}
    </GlassCard>
  );
};
