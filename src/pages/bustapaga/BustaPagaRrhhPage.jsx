import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { ConstanciaModal } from "../../components/bustapaga/ConstanciaModal";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { PageLoader } from "../../components/ui/PageLoader";
import { Select } from "../../components/ui/Select";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { TextField } from "../../components/ui/TextField";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import {
  deleteBustaPagaRequest,
  getBustaPagaFileRequest,
  listBustasPagaRequest,
  listDestinatariosRequest,
  uploadBustaPagaRequest,
} from "../../lib/bustaPaga.api";
import { MESES, openPdfFromRequest, periodoLabel } from "../../lib/bustaPaga";
import { formatDateTime } from "../../lib/format";
import { CARGO_LABELS } from "../../lib/constants";

const MONTH_OPTIONS = MESES.map((label, index) => ({ value: String(index + 1), label }));

// Recursos Humanos (y el Admin): sube la busta paga de cada persona del equipo (chofer, Responsable, Recursos
// Humanos o Admin) y ve cuales ya firmaron.
export const BustaPagaRrhhPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const allowed = user?.cargo === "RRHH" || user?.cargo === "OWNER";

  const now = new Date();
  const [drivers, setDrivers] = useState(null);
  const [bustas, setBustas] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [choferId, setChoferId] = useState(searchParams.get("chofer") ?? "");
  const [mes, setMes] = useState(String(now.getMonth() + 1));
  const [anio, setAnio] = useState(String(now.getFullYear()));
  const [archivo, setArchivo] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [filterChofer, setFilterChofer] = useState(searchParams.get("chofer") ?? "");
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [constanciaId, setConstanciaId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const loadBustas = useCallback(() => {
    listBustasPagaRequest()
      .then(setBustas)
      .catch((err) => setError(parseApiError(err).message));
  }, []);

  useEffect(() => {
    if (!allowed) return;
    listDestinatariosRequest()
      .then(setDrivers)
      .catch((err) => setError(parseApiError(err).message));
    loadBustas();
  }, [allowed, loadBustas]);

  const driverOptions = useMemo(
    () => (drivers ?? []).map((d) => ({ value: d.id, label: `${d.nombre} ${d.apellido} · ${CARGO_LABELS[d.cargo] ?? d.cargo}` })),
    [drivers]
  );

  const visible = useMemo(
    () =>
      (bustas ?? []).filter((b) => (!filterChofer || b.choferId === filterChofer) && (!soloPendientes || !b.firmada)),
    [bustas, filterChofer, soloPendientes]
  );
  const pendientes = (bustas ?? []).filter((b) => !b.firmada).length;

  if (!allowed) return <Navigate to="/" replace />;

  const handleUpload = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!choferId) return setError("Elige a quién se la envías");
    if (!archivo) return setError("Selecciona el PDF de la busta paga");
    setUploading(true);
    try {
      await uploadBustaPagaRequest({ choferId, anio: Number(anio), mes: Number(mes), archivo });
      const name = driverOptions.find((d) => d.value === choferId)?.label ?? "la persona";
      setSuccess(`Busta paga de ${periodoLabel(anio, Number(mes))} enviada a ${name}. Se le envió un aviso al celular.`);
      setArchivo(null);
      e.target.reset();
      loadBustas();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (busta) => {
    setError("");
    setBusyId(busta.id);
    try {
      await openPdfFromRequest(() => getBustaPagaFileRequest(busta.id));
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (busta) => {
    if (!window.confirm(`¿Eliminar la busta paga de ${busta.chofer} (${periodoLabel(busta.anio, busta.mes)})?`)) return;
    setError("");
    setBusyId(busta.id);
    try {
      await deleteBustaPagaRequest(busta.id);
      loadBustas();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const changeFilter = (value) => {
    setFilterChofer(value);
    setSearchParams(value ? { chofer: value } : {}, { replace: true });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[14px] text-ink-300">
          Envía la busta paga a cada persona del equipo (choferes, Responsables, Recursos Humanos y Admin). Para abrirla, quien la recibe tiene que firmar y queda el comprobante.
        </p>
      </div>

      <GlassCard>
        <h2 className="text-[17px] font-semibold text-ink-50">Enviar una busta paga</h2>
        <form className="mt-4 flex flex-col gap-4" onSubmit={handleUpload}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <SearchableSelect
                id="bp-chofer"
                label="Enviar a"
                placeholder="Escribe para buscar una persona"
                options={driverOptions}
                value={choferId}
                onChange={setChoferId}
                maxSuggestions={8}
              />
            </div>
            <Select id="bp-mes" label="Mes" value={mes} onChange={(e) => setMes(e.target.value)} options={MONTH_OPTIONS} />
            <TextField
              id="bp-anio"
              label="Año"
              type="number"
              min="2000"
              max="2100"
              value={anio}
              onChange={(e) => setAnio(e.target.value)}
            />
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2 rounded-full glass-input px-4 py-2.5 text-[14px] font-medium text-ink-50 hover:bg-line/10">
            {archivo ? archivo.name : "Elegir PDF de la busta paga"}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
          </label>
          <Alert>{error}</Alert>
          {success && <Alert variant="success">{success}</Alert>}
          <div>
            <Button type="submit" loading={uploading} className="sm:w-auto sm:px-8">
              Enviar busta paga
            </Button>
          </div>
        </form>
      </GlassCard>

      <GlassCard>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-ink-50">Enviadas</h2>
            <p className="text-[13px] text-ink-400">
              {bustas ? `${bustas.length} en total · ${pendientes} pendientes de firma` : "Cargando…"}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-64">
              <SearchableSelect
                id="bp-filtro"
                label="Filtrar por persona"
                placeholder="Todos"
                options={[{ value: "", label: "Todos" }, ...driverOptions]}
                value={filterChofer}
                onChange={changeFilter}
                maxSuggestions={8}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 pb-3 text-[13px] text-ink-300">
              <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} />
              Solo pendientes de firma
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {bustas === null && !error && <PageLoader />}
          {bustas && visible.length === 0 && <p className="text-[14px] text-ink-400">No hay busta paga con estos filtros.</p>}
          {visible.map((busta) => (
            <div key={busta.id} className="glass-surface-sm flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3">
              <div className="min-w-0">
                <span className="block truncate text-[15px] font-medium text-ink-50">{busta.chofer}</span>
                <span className="block text-[12px] text-ink-400">
                  {CARGO_LABELS[busta.cargo] ?? ""} · {periodoLabel(busta.anio, busta.mes)} · enviada {formatDateTime(busta.subidaAt)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    busta.firmada
                      ? "rounded-full bg-success-500/15 px-3 py-1 text-[12px] font-medium text-success-500"
                      : "rounded-full bg-warning-500/20 px-3 py-1 text-[12px] font-medium text-warning-500"
                  }
                >
                  {busta.firmada ? `Firmada ${formatDateTime(busta.firmadaAt)}` : "Pendiente de firma"}
                </span>
                <Button variant="ghost" className="!w-auto px-4 py-2 text-[13px]" loading={busyId === busta.id} onClick={() => handleView(busta)}>
                  Ver PDF
                </Button>
                {busta.firmada ? (
                  <Button variant="ghost" className="!w-auto px-4 py-2 text-[13px]" onClick={() => setConstanciaId(busta.id)}>
                    Comprobante
                  </Button>
                ) : (
                  <Button variant="ghost" className="!w-auto px-4 py-2 text-[13px]" onClick={() => handleDelete(busta)}>
                    Eliminar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {constanciaId && <ConstanciaModal id={constanciaId} onClose={() => setConstanciaId(null)} />}
    </div>
  );
};
