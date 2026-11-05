import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { BackLink } from "../../components/ui/BackLink";
import { Button } from "../../components/ui/Button";
import { ClientAutocomplete } from "../../components/ui/ClientAutocomplete";
import { GlassCard } from "../../components/ui/GlassCard";
import { Select } from "../../components/ui/Select";
import { SlideOverPanel } from "../../components/ui/SlideOverPanel";
import { TextField } from "../../components/ui/TextField";
import { Textarea } from "../../components/ui/Textarea";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { listClientsRequest } from "../../lib/clients.api";
import { APLICATIVO_OPTIONS, TIPO_PEDIDO_OPTIONS } from "../../lib/constants";
import { paisOptions } from "../../lib/paises";
import { userAreaKeys } from "../../lib/roles";
import { AREAS_BY_KEY } from "../../lib/recordAreas";
import { crearDesdeTextoRequest, leerTextoRequest } from "../../lib/solicitudes.api";
import { formatFechaHora, notifySolicitudesChanged, toRomeInput } from "../../lib/solicitudes";

// DHL Milano, DHL Roma, AB Service y Extra Piazza Milano / Roma (Extras Stefania todavia no). areas: las claves de area que dan acceso al servicio; area: donde se
// abre el formulario real; tipo: el tipo de servicio que entiende el servidor (Extra Piazza va por zona, cada una sale de su lugar de espera).
const SERVICIOS = {
  DHL_MILANO: { label: "DHL Milano", zona: "MILANO", numeroLabel: "Numero di Milano", areas: ["dhl-milano"], area: "dhl-milano" },
  DHL_ROMA: { label: "DHL Roma", zona: "ROMA", numeroLabel: "Numero di Roma", areas: ["dhl-roma"], area: "dhl-roma" },
  AB_SERVICE: { label: "AB Service", zona: null, areas: ["ab-service"], area: "ab-service" },
  EXTRA_PIAZZA_MILANO: { label: "Extra Piazza Milano", tipo: "EXTRA_PIAZZA", zonaExtra: "MILANO", zona: null, areas: ["piazza-milano"], area: "piazza-milano" },
  EXTRA_PIAZZA_ROMA: { label: "Extra Piazza Roma", tipo: "EXTRA_PIAZZA", zonaExtra: "ROMA", zona: null, areas: ["piazza-roma"], area: "piazza-roma" },
};

// Tipo dell'ordine: menu a tendina con ASAP / SCHEDULED. Quello scritto nel testo o dedotto dall'ETA arriva già scelto (e con "suggerito" accanto),
// e si cambia scegliendo un'altra voce.
const TipoSelect = ({ value, origen, onChange }) => (
  <div>
    <Select
      id="lec-tipo"
      label="Tipo"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={[
        { value: "", label: "— Scegli il tipo —" },
        ...TIPO_PEDIDO_OPTIONS.map((o) => ({ value: o.value, label: value === o.value && origen === "eta" ? `${o.label} (suggerito)` : o.label })),
      ]}
    />
    <span className="mt-1.5 block text-[12px] text-ink-400">
      {origen === "texto" && "Letto dal testo."}
      {origen === "eta" && "Suggerito in base all'ETA: cambialo se non è così."}
      {!origen && !value && "Non è stato possibile dedurlo: scegline uno."}
    </span>
  </div>
);

// Servicio desde un texto pegado (todo el proceso va en italiano): el bot de reglas (sin IA, sin costo) lee el texto y rellena Shipment, Order, cliente, tipo, ciudad, ETA,
// y el numero de Milano / Roma.
// Quien pega corrige lo que haga falta y lo guarda como solicitud PENDIENTE (con el texto completo como descripcion); despues se completa el
// resto del formulario (chofer, vehiculo, km...) y al crear el servicio la solicitud queda aceptada.
export const ServicioDesdeTextoPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const closeTo = "/records/dhl-ab-service";

  // Cada uno ve los servicios de sus areas (el Owner, todos).
  const areasUsuario = userAreaKeys(user);
  const permitidos = Object.entries(SERVICIOS).filter(([, s]) => areasUsuario === null || s.areas.some((k) => areasUsuario.includes(k)));
  const [servicio, setServicio] = useState(() => permitidos[0]?.[0] ?? "DHL_MILANO");
  const zona = SERVICIOS[servicio];
  const esExtra = zona.tipo === "EXTRA_PIAZZA";
  const esDhl = servicio === "DHL_MILANO" || servicio === "DHL_ROMA";
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
      const d = await leerTextoRequest(zona.tipo ?? servicio, texto, zona.zonaExtra);
      setLectura({
        descripcion: d.descripcion,
        shipment: d.shipment ?? "",
        orderNumero: d.orderNumero ?? "",
        clientId: d.clienteId ?? "",
        clienteTexto: d.cliente ?? "",
        tipoPedido: d.tipoPedido ?? "",
        tipoOrigen: d.tipoOrigen ?? null,
        ciudad: d.ciudad ?? "",
        calle: d.calle ?? "",
        cap: d.cap ?? "",
        pais: d.pais ?? "",
        aplicativo: d.aplicativo ?? "",
        ritiro: d.ritiro ?? "",
        km: d.km != null ? String(d.km) : "",
        lugares: d.lugares ?? [],
        eta: d.eta ? toRomeInput(d.eta) : "",
        avisos: d.avisos ?? [],
        verificacion: d.verificacion ?? null,
        duplicados: d.duplicados ?? [],
      });
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setLeyendo(false);
    }
  };

  const faltan = lectura ? [!esExtra && !clienteNombre && "cliente", !lectura.ciudad.trim() && (esExtra ? "consegna" : "città"), !lectura.eta && "ETA"].filter(Boolean) : [];

  const guardar = async () => {
    setGuardando(true);
    setError("");
    try {
      const solicitud = await crearDesdeTextoRequest({
        servicio: zona.tipo ?? servicio,
        ...(zona.zonaExtra ? { zona: zona.zonaExtra } : {}),
        cliente: clienteNombre,
        destinazione: lectura.ciudad.trim(),
        ...(esExtra ? {} : { calle: lectura.calle.trim(), cap: lectura.cap.trim(), pais: lectura.pais }),
        fechaHora: lectura.eta,
        descripcion: lectura.descripcion,
        shipment: lectura.shipment,
        orderNumero: lectura.orderNumero,
        tipoPedido: esExtra ? "" : lectura.tipoPedido,
        aplicativo: esDhl ? lectura.aplicativo : "",
        ritiro: esExtra ? lectura.ritiro : "",
        km: esExtra ? "" : lectura.km,
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

  // Completa ora = abrir el formulario real del servicio con lo leido; al crearlo la solicitud queda aceptada.
  const completarAhora = () => {
    const area = AREAS_BY_KEY[zona.area];
    navigate(area.newPath, { replace: true, state: { backgroundLocation: location.state?.backgroundLocation, ...area.newState, solicitud: creada } });
  };

  if (!isPrivileged) return <Navigate to="/" replace />;

  return (
    <SlideOverPanel closeTo={closeTo}>
      <div className="flex flex-col gap-6">
        <div>
          <BackLink to={closeTo} className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
            &larr; Registri
          </BackLink>
        </div>

        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">Servizio da un testo - {zona.label}</h1>
          <p className="mt-1 text-[14px] text-ink-300">
            Incolla il testo del servizio: si leggono codici, cliente, tipo, luoghi, ETA e km quando ci sono. Il resto lo completa una persona prima di accettarlo.
          </p>
        </div>

        {creada ? (
          <GlassCard>
            <h2 className="text-[17px] font-medium text-ink-50">Salvato come in sospeso</h2>
            <p className="mt-2 text-[14px] text-ink-300">
              {creada.cliente} · {creada.destinazione} · {formatFechaHora(creada.fechaHora)}
              {creada.shipment ? ` · Shipment ${creada.shipment}` : ""}
              {creada.orderNumero ? ` · Order ${creada.orderNumero}` : ""}
            </p>
            <p className="mt-1 text-[13px] text-ink-400">
              Resta tra le richieste in sospeso. Completando il modulo (autista, veicolo, km...) e creando il servizio, viene accettata.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button className="w-auto" onClick={completarAhora}>
                Completa ora
              </Button>
              <Button className="w-auto" variant="ghost" onClick={nuevo}>
                Incolla un altro testo
              </Button>
            </div>
          </GlassCard>
        ) : (
          <>
            <GlassCard>
              <h2 className="text-[17px] font-medium text-ink-50">Testo del servizio</h2>
              <Alert>{error}</Alert>
              <div className="mt-4 flex flex-wrap gap-2">
                {permitidos.map(([value, s]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setServicio(value);
                      setLectura(null);
                    }}
                    className={`rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${servicio === value ? "bg-brand text-brand-foreground" : "bg-line/10 text-ink-300 hover:text-ink-50"}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <Textarea
                  id="texto"
                  label="Incolla qui il testo"
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
                  Leggi testo
                </Button>
              </div>
            </GlassCard>

            {lectura && (
              <GlassCard>
                <h2 className="text-[17px] font-medium text-ink-50">Ecco cosa è stato letto</h2>
                <p className="mt-1 text-[13px] text-ink-300">Controlla e correggi quello che serve. La descrizione sarà il testo completo.</p>

                {lectura.duplicados.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-[13px] text-ink-100">
                    <span className="block font-semibold text-danger-500">Questo ordine sembra già caricato</span>
                    {lectura.duplicados.map((d) => (
                      <span key={`${d.tipo}-${d.id}`} className="mt-1 block text-ink-200">
                        {d.tipo === "SERVICIO"
                          ? `Servizio ${d.codigo} (${d.estado}) del ${formatFechaHora(d.fecha)}`
                          : `Richiesta in sospeso di ${d.cliente} del ${formatFechaHora(d.fecha)}`}
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

                {lectura.lugares?.length > 0 && (
                  <ul className="mt-4 flex flex-col gap-1.5 rounded-xl border border-line/15 px-3 py-2 text-[12.5px]">
                    {lectura.lugares.map((l, i) => (
                      <li key={`${l.rol}-${i}`} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                        <span className="shrink-0 font-semibold text-ink-100">{l.rol === "ritiro" ? "Ritiro" : "Consegna"}</span>
                        <span className="text-ink-200">{l.texto}</span>
                        {l.localizado ? (
                          <span className="text-success-500">✓ Localizzato{l.localizado !== l.texto ? `: ${l.localizado}` : ""}</span>
                        ) : (
                          <span className="text-warning-500">⚠ Non localizzato: controlla l'indirizzo</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField id="lec-shipment" label={esExtra ? "Codice" : "Shipment"} value={lectura.shipment} onChange={(e) => setCampo("shipment", e.target.value)} />
                  <TextField id="lec-order" label={esExtra ? "Secondo codice (facoltativo)" : "Order"} value={lectura.orderNumero} onChange={(e) => setCampo("orderNumero", e.target.value)} />
                  {esExtra && <TextField className="sm:col-span-2" id="lec-ritiro" label="Ritiro" value={lectura.ritiro} onChange={(e) => setCampo("ritiro", e.target.value)} />}
                  <ClientAutocomplete
                    id="lec-cliente"
                    label={`${lectura.clientId || !lectura.clienteTexto ? "Cliente" : `Cliente (nel testo: ${lectura.clienteTexto})`}${esExtra ? " (facoltativo)" : ""}`}
                    clients={clients ?? []}
                    value={lectura.clientId}
                    onChange={(clientId) => setCampo("clientId", clientId)}
                    onClientCreated={(client) => setClients((prev) => [...(prev ?? []), client])}
                  />
                  {!esExtra && (
                    <TipoSelect
                      value={lectura.tipoPedido}
                      origen={lectura.tipoOrigen}
                      onChange={(v) => setLectura((prev) => ({ ...prev, tipoPedido: v, tipoOrigen: v ? "manual" : null }))}
                    />
                  )}
                  {esDhl && (
                    <Select
                      id="lec-numero"
                      label={`${zona.numeroLabel} (facoltativo)`}
                      value={lectura.aplicativo}
                      onChange={(e) => setCampo("aplicativo", e.target.value)}
                      options={[{ value: "", label: "— Nessuno —" }, ...APLICATIVO_OPTIONS.filter((o) => o.value.startsWith(`${zona.zona}_`))]}
                    />
                  )}
                  {!esExtra && <TextField id="lec-calle" label="Destinazione (indirizzo)" className="sm:col-span-2" value={lectura.calle} onChange={(e) => setCampo("calle", e.target.value)} />}
                  {!esExtra && <TextField id="lec-cap" label="CAP" value={lectura.cap} onChange={(e) => setCampo("cap", e.target.value)} />}
                  <TextField id="lec-ciudad" label={esExtra ? "Consegna" : "Città"} value={lectura.ciudad} onChange={(e) => setCampo("ciudad", e.target.value)} />
                  {!esExtra && <Select id="lec-pais" label="Paese (se non è l'Italia)" value={lectura.pais} onChange={(e) => setCampo("pais", e.target.value)} options={paisOptions("it", "predefinito")} />}
                  {!esExtra && <TextField id="lec-km" label="KM (facoltativo)" value={lectura.km} onChange={(e) => setCampo("km", e.target.value)} />}
                  <TextField
                    id="lec-eta"
                    label="ETA"
                    type="datetime-local"
                    value={lectura.eta}
                    onChange={(e) => setCampo("eta", e.target.value)}
                  />
                </div>

                {/* Paese e CAP si confermano a vicenda: Google trova l'indirizzo e si confrontano paese e CAP del testo con quelli trovati. */}
                {!esExtra && lectura.verificacion?.encontrada && (
                  <p className={`mt-4 rounded-xl px-3.5 py-2.5 text-[13px] ${lectura.verificacion.estado === "ok" ? "bg-success-500/10 text-ink-200" : "bg-warning-500/10 text-ink-200"}`}>
                    {lectura.verificacion.estado === "ok" ? (
                      <b className="text-success-500">✓ Paese e CAP coincidono.</b>
                    ) : (
                      <b className="text-warning-500">Controlla paese e CAP.</b>
                    )}{" "}
                    Google trova: {lectura.verificacion.encontrada}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button className="w-auto" onClick={guardar} loading={guardando} disabled={faltan.length > 0}>
                    Salva come in sospeso
                  </Button>
                  {faltan.length > 0 && <span className="text-[13px] text-warning-500">Da completare: {faltan.join(", ")}.</span>}
                </div>
              </GlassCard>
            )}
          </>
        )}
      </div>
    </SlideOverPanel>
  );
};
