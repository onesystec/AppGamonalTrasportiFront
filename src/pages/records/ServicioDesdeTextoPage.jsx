import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { BackLink } from "../../components/ui/BackLink";
import { Button } from "../../components/ui/Button";
import { ClientAutocomplete } from "../../components/ui/ClientAutocomplete";
import { GlassCard } from "../../components/ui/GlassCard";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { SlideOverPanel } from "../../components/ui/SlideOverPanel";
import { TextField } from "../../components/ui/TextField";
import { Textarea } from "../../components/ui/Textarea";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { listClientsRequest } from "../../lib/clients.api";
import { TIPO_PEDIDO_OPTIONS } from "../../lib/constants";
import { crearDesdeTextoRequest, leerTextoRequest } from "../../lib/solicitudes.api";
import { formatFechaHora, notifySolicitudesChanged, toRomeInput } from "../../lib/solicitudes";

// Por ahora solo DHL Milano.
const SERVICIO = "DHL_MILANO";

// Servicio desde un texto pegado: el bot de reglas (sin IA, sin costo) lee el texto y rellena Shipment, Order, cliente, tipo, ciudad y ETA.
// Quien pega corrige lo que haga falta y lo guarda como solicitud PENDIENTE (con el texto completo como descripcion); despues se completa el
// resto del formulario (chofer, vehiculo, km...) y al crear el servicio la solicitud queda aceptada.
export const ServicioDesdeTextoPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const closeTo = "/records/dhl-ab-service";

  const [texto, setTexto] = useState("");
  const [clients, setClients] = useState(null);
  const [lectura, setLectura] = useState(null);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [creada, setCreada] = useState(null);

  useEffect(() => {
    listClientsRequest()
      .then(setClients)
      .catch(() => setClients([]));
  }, []);

  const setCampo = (campo, valor) => setLectura((prev) => ({ ...prev, [campo]: valor }));
  const clienteNombre = useMemo(
    () => (lectura ? ((clients ?? []).find((c) => c.id === lectura.clientId)?.nombre ?? lectura.clienteTexto) : ""),
    [lectura, clients]
  );

  const leer = async () => {
    setLeyendo(true);
    setError("");
    setCreada(null);
    try {
      const d = await leerTextoRequest(SERVICIO, texto);
      setLectura({
        descripcion: d.descripcion,
        shipment: d.shipment ?? "",
        orderNumero: d.orderNumero ?? "",
        clientId: d.clienteId ?? "",
        clienteTexto: d.cliente ?? "",
        tipoPedido: d.tipoPedido ?? "",
        ciudad: d.ciudad ?? "",
        eta: d.eta ? toRomeInput(d.eta) : "",
        avisos: d.avisos ?? [],
        duplicados: d.duplicados ?? [],
      });
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setLeyendo(false);
    }
  };

  const faltan = lectura ? [!clienteNombre && "el cliente", !lectura.ciudad.trim() && "la ciudad", !lectura.eta && "la ETA"].filter(Boolean) : [];

  const guardar = async () => {
    setGuardando(true);
    setError("");
    try {
      const solicitud = await crearDesdeTextoRequest({
        servicio: SERVICIO,
        cliente: clienteNombre,
        destinazione: lectura.ciudad.trim(),
        fechaHora: lectura.eta,
        descripcion: lectura.descripcion,
        shipment: lectura.shipment,
        orderNumero: lectura.orderNumero,
        tipoPedido: lectura.tipoPedido,
      });
      setCreada(solicitud);
      notifySolicitudesChanged();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setGuardando(false);
    }
  };

  const nuevo = () => {
    setTexto("");
    setLectura(null);
    setCreada(null);
    setError("");
  };

  // Completar ahora = abrir el formulario real del servicio con lo leido; al crearlo la solicitud queda aceptada.
  const completarAhora = () =>
    navigate("/records/dhl-ab-service/new", {
      replace: true,
      state: { backgroundLocation: location.state?.backgroundLocation, spedizzione: "DHL", zona: "MILANO", solicitud: creada },
    });

  if (!isPrivileged) return <Navigate to="/" replace />;

  return (
    <SlideOverPanel closeTo={closeTo}>
      <div className="flex flex-col gap-6">
        <div>
          <BackLink to={closeTo} className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
            &larr; Mis registros
          </BackLink>
        </div>

        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">Servicio desde un texto - DHL Milano</h1>
          <p className="mt-1 text-[14px] text-ink-300">
            Pega el texto del servicio: se leen Shipment, Order, cliente, tipo, ciudad y ETA. Lo demás lo completa una persona antes de aceptarlo.
          </p>
        </div>

        {creada ? (
          <GlassCard>
            <h2 className="text-[17px] font-medium text-ink-50">Guardado como pendiente</h2>
            <p className="mt-2 text-[14px] text-ink-300">
              {creada.cliente} · {creada.destinazione} · {formatFechaHora(creada.fechaHora)}
              {creada.shipment ? ` · Shipment ${creada.shipment}` : ""}
              {creada.orderNumero ? ` · Order ${creada.orderNumero}` : ""}
            </p>
            <p className="mt-1 text-[13px] text-ink-400">
              Queda en las solicitudes pendientes. Al completar el formulario (chofer, vehículo, km...) y crear el servicio, se acepta.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button className="w-auto" onClick={completarAhora}>
                Completar ahora
              </Button>
              <Button className="w-auto" variant="ghost" onClick={nuevo}>
                Pegar otro texto
              </Button>
            </div>
          </GlassCard>
        ) : (
          <>
            <GlassCard>
              <h2 className="text-[17px] font-medium text-ink-50">Texto del servicio</h2>
              <Alert>{error}</Alert>
              <div className="mt-4">
                <Textarea
                  id="texto"
                  label="Pega aquí el texto"
                  placeholder="Shipments: Customer ... Shipment # ... ETA ... Ship To City ... Order # ..."
                  rows={8}
                  value={texto}
                  onChange={(e) => {
                    setTexto(e.target.value);
                    if (lectura) setLectura(null);
                  }}
                />
              </div>
              <div className="mt-4">
                <Button className="w-auto" onClick={leer} loading={leyendo} disabled={!texto.trim()}>
                  Leer texto
                </Button>
              </div>
            </GlassCard>

            {lectura && (
              <GlassCard>
                <h2 className="text-[17px] font-medium text-ink-50">Esto es lo que se leyó</h2>
                <p className="mt-1 text-[13px] text-ink-300">Revisa y corrige lo que haga falta. La descripción será el texto completo.</p>

                {lectura.duplicados.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-[13px] text-ink-100">
                    <span className="block font-semibold text-danger-500">Este pedido parece ya estar cargado</span>
                    {lectura.duplicados.map((d) => (
                      <span key={`${d.tipo}-${d.id}`} className="mt-1 block text-ink-200">
                        {d.tipo === "SERVICIO"
                          ? `Servicio ${d.codigo} (${d.estado}) del ${formatFechaHora(d.fecha)}`
                          : `Solicitud pendiente de ${d.cliente} del ${formatFechaHora(d.fecha)}`}
                      </span>
                    ))}
                  </div>
                )}

                {lectura.avisos.length > 0 && (
                  <ul className="mt-4 list-disc rounded-2xl border border-warning-500/40 bg-warning-500/10 py-3 pl-8 pr-4 text-[13px] text-warning-500">
                    {lectura.avisos.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                )}

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField id="lec-shipment" label="Shipment" value={lectura.shipment} onChange={(e) => setCampo("shipment", e.target.value)} />
                  <TextField id="lec-order" label="Order" value={lectura.orderNumero} onChange={(e) => setCampo("orderNumero", e.target.value)} />
                  <ClientAutocomplete
                    id="lec-cliente"
                    label={lectura.clientId || !lectura.clienteTexto ? "Cliente" : `Cliente (en el texto: ${lectura.clienteTexto})`}
                    clients={clients ?? []}
                    value={lectura.clientId}
                    onChange={(clientId) => setCampo("clientId", clientId)}
                    onClientCreated={(client) => setClients((prev) => [...(prev ?? []), client])}
                  />
                  <SearchableSelect
                    id="lec-tipo"
                    label="Tipo"
                    placeholder="ASAP o SCHEDULED"
                    options={TIPO_PEDIDO_OPTIONS}
                    value={lectura.tipoPedido}
                    onChange={(v) => setCampo("tipoPedido", v)}
                  />
                  <TextField id="lec-ciudad" label="Ciudad" value={lectura.ciudad} onChange={(e) => setCampo("ciudad", e.target.value)} />
                  <TextField
                    id="lec-eta"
                    label="ETA"
                    type="datetime-local"
                    value={lectura.eta}
                    onChange={(e) => setCampo("eta", e.target.value)}
                  />
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button className="w-auto" onClick={guardar} loading={guardando} disabled={faltan.length > 0}>
                    Guardar como pendiente
                  </Button>
                  {faltan.length > 0 && <span className="text-[13px] text-warning-500">Falta {faltan.join(", ")}.</span>}
                </div>
              </GlassCard>
            )}
          </>
        )}
      </div>
    </SlideOverPanel>
  );
};
