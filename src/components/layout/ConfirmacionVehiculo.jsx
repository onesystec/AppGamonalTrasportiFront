import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { formatCronologiaDate, confirmarUsoVehiculoRequest, getContextoVehiculoRequest } from "../../lib/cronologiaVehicular.api";
import { getToken } from "../../lib/token";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { SearchableSelect } from "../ui/SearchableSelect";

import { markConfirmed, wasConfirmed } from "../../lib/confirmacionVehiculo";

const PreguntaVehiculo = ({ session, onConfirmed }) => {
  const { logout, driverMode, setDriverMode } = useAuth();
  const [context, setContext] = useState(null);
  const [vehicleId, setVehicleId] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setContext(await getContextoVehiculoRequest());
    } catch (err) {
      setError(parseApiError(err).message);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const confirmar = async (id, continuar = false) => {
    setSaving(true);
    setError("");
    try {
      await confirmarUsoVehiculoRequest(id, continuar);
      if (getToken()?.split(".")[1] !== session) return;
      markConfirmed(session);
      onConfirmed();
    } catch (err) {
      if (err.response?.status === 409) {
        await load();
        setVehicleId("");
        setSelecting(true);
      }
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const suggested = context?.suggested;
  const options = context?.vehicles.map((v) => ({ value: v.id, label: `${v.targa} · ${v.modelo}` })) ?? [];
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <section className="glass-surface w-full max-w-lg space-y-4 rounded-3xl p-6" aria-labelledby="confirmacion-vehiculo-titulo">
        <h1 id="confirmacion-vehiculo-titulo" className="text-xl font-semibold text-ink-50">
          {suggested && !selecting ? `¿Sigues con ${suggested.targa}?` : "¿Qué vehículo tienes ahora?"}
        </h1>
        {context?.lastService && (
          <p className="text-sm text-ink-300">
            Último servicio con {context.lastService.targa} · {formatCronologiaDate(context.lastService.fecha)}
          </p>
        )}
        {!context && !error && <p role="status" className="text-sm text-ink-300">Consultando vehículos…</p>}
        <Alert>{error}</Alert>
        {!context && error && <Button onClick={load}>Reintentar</Button>}
        {context && (
          <fieldset disabled={saving} className="space-y-3">
            {suggested && !selecting ? (
              <div className="flex flex-wrap gap-2">
                <Button className="!w-auto" onClick={() => confirmar(suggested.id, true)}>Sí, sigo con {suggested.targa}</Button>
                <Button variant="ghost" className="!w-auto" onClick={() => setSelecting(true)}>Cambiar vehículo</Button>
              </div>
            ) : (
              <>
                <SearchableSelect id="vehiculo-actual" label="Vehículo" placeholder="Busca por matrícula o modelo"
                  options={options} value={vehicleId} onChange={setVehicleId} maxSuggestions={5} selectSingleMatch />
                <Button disabled={!vehicleId} onClick={() => confirmar(vehicleId)}>Confirmar vehículo</Button>
              </>
            )}
            <Button variant="ghost" className="!w-auto" onClick={() => confirmar(null)}>Ahora no tengo vehículo</Button>
            {saving && <p role="status" className="text-sm text-ink-300">Guardando…</p>}
          </fieldset>
        )}
        <div className="flex flex-wrap gap-2">
          {driverMode && <Button variant="ghost" disabled={saving} className="!w-auto" onClick={() => setDriverMode(false)}>Volver a oficina</Button>}
          <Button variant="ghost" className="!w-auto" onClick={logout}>Cerrar sesión</Button>
        </div>
      </section>
    </main>
  );
};

export const ConfirmacionVehiculo = ({ children }) => {
  const { user } = useAuth();
  const [, setRevision] = useState(0);
  const session = user?.cargo === "CHOFER" ? getToken()?.split(".")[1] : null;
  if (session && !wasConfirmed(session)) {
    return <PreguntaVehiculo key={session} session={session} onConfirmed={() => setRevision((revision) => revision + 1)} />;
  }
  return children;
};
