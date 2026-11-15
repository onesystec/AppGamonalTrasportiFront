import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { PageLoader } from "../../components/ui/PageLoader";
import { CheckIcon, CopyIcon } from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { listClientsRequest } from "../../lib/clients.api";
import {
  accettaCollegamentoRequest,
  getCollegamentiRequest,
  rifiutaCollegamentoRequest,
  rigeneraCodiceRequest,
  scollegaRequest,
} from "../../lib/collegamenti.api";

const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Rome" }) : "—");

// Mi codigo: se comparte con la otra app (se pega en la ficha del fornitore de App Piazza). Vale unas horas y se usa una sola vez.
const MiCodigo = ({ codice, scadeAt, onChange }) => {
  const [copiado, setCopiado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codice);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No se pudo copiar: selecciona el codigo y copialo a mano.");
    }
  };
  const regenerar = async () => {
    setSaving(true);
    setError("");
    try {
      onChange(await rigeneraCodiceRequest());
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass-surface rounded-3xl p-5 sm:p-6">
      <h2 className="text-[16px] font-semibold text-ink-50">Mi codigo de conexion</h2>
      <p className="mt-1 text-[13px] text-ink-300">Pegalo en la ficha de tu proveedor dentro de la otra app. Se usa una sola vez y se renueva solo.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 select-all break-all rounded-xl border border-line/15 bg-line/5 px-4 py-3 text-[14px] font-semibold tracking-wide text-ink-50">{codice}</code>
        <div className="flex gap-2">
          <Button className="!w-auto px-4 py-2 text-[13px]" onClick={copiar}>
            {copiado ? <CheckIcon className="mr-1.5 h-4 w-4" /> : <CopyIcon className="mr-1.5 h-4 w-4" />}
            {copiado ? "Copiado" : "Copiar"}
          </Button>
          <Button variant="ghost" className="!w-auto px-4 py-2 text-[13px]" onClick={regenerar} loading={saving}>
            Generar otro
          </Button>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-ink-400">Vale hasta {fechaHora(scadeAt)}.</p>
      <Alert>{error}</Alert>
    </section>
  );
};

// Solicitud de conexion que llego de la otra app: elegir (o crear) el cliente y aceptar, o rechazar.
const SolicitudConexion = ({ item, clientes, onDone }) => {
  const [clientId, setClientId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn) => {
    setSaving(true);
    setError("");
    try {
      await fn();
      onDone();
    } catch (err) {
      setError(parseApiError(err).message);
      setSaving(false);
    }
  };

  return (
    <li className="glass-surface-sm rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[15px] font-semibold text-ink-50">{item.remotoNome}</p>
          <p className="text-[12px] text-ink-400">
            Quiere conectar su app con la tuya{item.remotoPartitaIva ? ` · P.IVA ${item.remotoPartitaIva}` : ""} · {fechaHora(item.createdAt)}
          </p>
        </div>
      </div>
      <label className="mt-3 block text-[12px] text-ink-300" htmlFor={`cliente-${item.id}`}>
        Cliente en tu Anagrafica
      </label>
      <select
        id={`cliente-${item.id}`}
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        className="mt-1 w-full rounded-xl border border-line/20 bg-background px-3 py-2.5 text-[14px] text-ink-50"
      >
        <option value="">Crear uno nuevo: {item.remotoNome}</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id} disabled={c.tieneApp}>
            {c.nombre}
            {c.tieneApp ? " (ya tiene una app conectada)" : ""}
          </option>
        ))}
      </select>
      <Alert>{error}</Alert>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button className="!w-auto px-4 py-2 text-[13px]" loading={saving} onClick={() => run(() => accettaCollegamentoRequest(item.id, clientId))}>
          Aceptar
        </Button>
        <Button variant="ghost" className="!w-auto px-4 py-2 text-[13px] text-danger-500" disabled={saving} onClick={() => run(() => rifiutaCollegamentoRequest(item.id))}>
          Rechazar
        </Button>
      </div>
    </li>
  );
};

const ConexionActiva = ({ item, onScollega }) => (
  <li className="glass-surface-sm rounded-2xl p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-ink-50">{item.remotoNome}</p>
        <p className="text-[12px] text-ink-400">
          Conectada{item.client ? ` · cliente: ${item.client.nombre}` : ""} · desde {fechaHora(item.updatedAt)}
        </p>
      </div>
      <Button variant="ghost" className="!w-auto px-3 py-1.5 text-[13px] text-danger-500" onClick={() => onScollega(item)}>
        Desconectar
      </Button>
    </div>
    {item.ultimoErrore && (
      <p className="mt-2 rounded-lg bg-danger-500/10 px-3 py-2 text-[12px] text-danger-500">
        Ultimo problema al avisar a la otra app ({fechaHora(item.ultimoErroreAt)}): {item.ultimoErrore}. Se reintenta con el siguiente cambio, o usa &quot;Reenviar&quot; en la solicitud.
      </p>
    )}
  </li>
);

export const AppCollegatePage = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [error, setError] = useState("");
  const [aDesconectar, setADesconectar] = useState(null);
  const [desconectando, setDesconectando] = useState(false);
  const [errorDesconectar, setErrorDesconectar] = useState("");

  const load = useCallback(() => {
    setError("");
    return Promise.all([getCollegamentiRequest(), listClientsRequest()])
      .then(([estado, lista]) => {
        setData(estado);
        const ocupados = new Set(estado.collegamenti.map((c) => c.client?.id).filter(Boolean));
        setClientes(lista.map((c) => ({ id: c.id, nombre: c.nombre, tieneApp: ocupados.has(c.id) })));
      })
      .catch((err) => setError(parseApiError(err).message));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (user?.cargo !== "OWNER") return <Navigate to="/" replace />;

  const pendientes = data?.collegamenti.filter((c) => c.stato === "DA_APPROVARE") ?? [];
  const activas = data?.collegamenti.filter((c) => c.stato === "ATTIVO") ?? [];

  const desconectar = async () => {
    setDesconectando(true);
    setErrorDesconectar("");
    try {
      await scollegaRequest(aDesconectar.id);
      setADesconectar(null);
      await load();
    } catch (err) {
      setErrorDesconectar(parseApiError(err).message);
    } finally {
      setDesconectando(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-50">App collegate</h1>
        <p className="mt-1 text-[13px] text-ink-300">
          Conecta tu app con la de un cliente (por ejemplo App Piazza): los servicios que te asigne llegan a Solicitudes para que los aceptes, y ella ve el estado, el chofer y la targa. No puede ver ni cambiar nada mas.
        </p>
      </div>
      <Alert>{error}</Alert>
      {!data && !error && <PageLoader />}
      {data && (
        <>
          {!data.cifratura && (
            <Alert>Falta configurar la clave de cifrado (COLLEGAMENTI_ENCRYPTION_KEY) en el servidor: hasta entonces no se pueden aceptar conexiones.</Alert>
          )}
          <MiCodigo codice={data.codice} scadeAt={data.scadeAt} onChange={(r) => setData((d) => ({ ...d, codice: r.codice, scadeAt: r.scadeAt }))} />

          <section>
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-400">Solicitudes de conexion</h2>
            {pendientes.length === 0 ? (
              <p className="glass-surface-sm rounded-2xl px-4 py-5 text-[13px] text-ink-300">No hay solicitudes por aprobar.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {pendientes.map((p) => (
                  <SolicitudConexion key={p.id} item={p} clientes={clientes} onDone={load} />
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-400">Apps conectadas</h2>
            {activas.length === 0 ? (
              <p className={clsx("glass-surface-sm rounded-2xl px-4 py-5 text-[13px] text-ink-300")}>Todavia no hay ninguna app conectada.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {activas.map((c) => (
                  <ConexionActiva key={c.id} item={c} onScollega={setADesconectar} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      <ConfirmModal
        open={Boolean(aDesconectar)}
        title="Desconectar app"
        description={`${aDesconectar?.remotoNome ?? ""} dejara de poder mandarte servicios. Los servicios que ya recibiste se conservan.`}
        confirmLabel="Desconectar"
        loading={desconectando}
        error={errorDesconectar}
        onConfirm={desconectar}
        onCancel={() => {
          setADesconectar(null);
          setErrorDesconectar("");
        }}
      />
    </div>
  );
};
