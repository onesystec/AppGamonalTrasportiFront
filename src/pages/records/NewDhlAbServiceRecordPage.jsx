import { BackLink } from "../../components/ui/BackLink";
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { SlideOverPanel } from "../../components/ui/SlideOverPanel";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ClientAutocomplete } from "../../components/ui/ClientAutocomplete";
import { GlassCard } from "../../components/ui/GlassCard";
import { PageLoader } from "../../components/ui/PageLoader";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { TextField } from "../../components/ui/TextField";
import { Textarea } from "../../components/ui/Textarea";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { listClientsRequest } from "../../lib/clients.api";
import { APLICATIVO_OPTIONS, RECORD_STATUS_OPTIONS, SPEDIZZIONE_OPTIONS, ZONA_OPTIONS, destinoSugerencias, salidaPorDefectoLabel } from "../../lib/constants";
import { useTarifasKm } from "../../hooks/useTarifasKm";
import { formatCurrency } from "../../lib/format";
import { createRecordRequest } from "../../lib/records.api";
import { DestinoSugerencias } from "../../components/records/DestinoSugerencias";
import { RetiroPaqueteField } from "../../components/records/RetiroPaqueteField";
import { FechasAviso } from "../../components/records/FechasAviso";
import { PasosFronteraCheckboxes } from "../../components/records/BrenneroCheckbox";
import { buildSalidaPayload, EMPTY_SALIDA, SalidaField } from "../../components/records/SalidaField";
import { listUsersRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

const INITIAL_FORM = {
  clientId: "",
  driverId: "",
  vehicleId: "",
  aplicativo: "",
  // Default Milano (no vacio) - mismo criterio que NewRecordPage.jsx, para que el
  // switch Milano/Roma de Registros no vuelva a quedar con registros "sin zona".
  extrasPiazzaZona: "MILANO",
  spedizzione: "DHL",
  estado: "IN_SOSPESO",
  eta: "",
  fechaRetiro: "",
  retiroPaqueteAt: "",
  descripcion: "",
  comentarios: "",
  ciudad: "",
  calle: "",
  cap: "",
  kilometros: "",
  areaC: "",
  costoEspera: "",
  costoOtros: "",
  costoCombustible: "",
  peajes: "",
  vignetta: "",
  costoHotel: "",
  costoTraforoFrejusBrennero: "",
  // Punto de salida: en blanco al empezar (si queda vacio se usa el deposito).
  salida: EMPTY_SALIDA,
  pasaPorBrennero: false,
  pasaPorFrejus: false,
};

// Arma la direccion de la parada final a partir de calle/CAP/ciudad, en el mismo
// formato que ya geocodifica el backend (ej: "Via Roma 5, 20100 Milano").
const buildAddress = ({ calle, cap, ciudad }) => {
  const parts = [calle.trim()];
  const capCiudad = [cap.trim(), ciudad.trim()].filter(Boolean).join(" ");
  if (capCiudad) parts.push(capCiudad);
  return parts.filter(Boolean).join(", ");
};

export const NewDhlAbServiceRecordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh: refreshRecords } = useDataRefresh("records");
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  // Zona activa en Registros al abrir "Nuevo servicio" (ver RecordsListPage.jsx) pisa
  // el default Milano de INITIAL_FORM, para que crear desde la pestana Roma arranque
  // en Roma igual que crear desde Milano arranca en Milano.
  const [form, setForm] = useState(() => ({
    ...INITIAL_FORM,
    extrasPiazzaZona: location.state?.zona ?? INITIAL_FORM.extrasPiazzaZona,
    spedizzione: location.state?.spedizzione ?? INITIAL_FORM.spedizzione,
  }));
  const [drivers, setDrivers] = useState(null);
  const [vehicles, setVehicles] = useState(null);
  const [clients, setClients] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  // Los km del cliente son de ida: se cuentan x2 y se pagan a la tarifa de DHL / AB Service.
  const tarifas = useTarifasKm();
  const kmCliente = Number(form.kilometros) || 0;

  useEffect(() => {
    Promise.all([listUsersRequest(), listVehiclesRequest(), listClientsRequest()])
      .then(([users, vehiclesData, clientsData]) => {
        setDrivers(users.filter((u) => u.estado === "ACTIVO"));
        setVehicles(vehiclesData);
        setClients(clientsData);
      })
      .catch((err) => setLoadError(parseApiError(err).message));
  }, []);

  // Destino elegido de las sugerencias (ubicacion exacta): { lat, lng }. Escribir la calle a mano lo descarta.
  const [destinoExacto, setDestinoExacto] = useState(null);
  const sugerenciasDestino = destinoSugerencias(form.spedizzione, form.extrasPiazzaZona);
  const exactoVigente =
    destinoExacto && sugerenciasDestino.some((s) => s.lat === destinoExacto.lat && s.lng === destinoExacto.lng)
      ? destinoExacto
      : null;

  const pickDestino = (s) => {
    setForm((prev) => ({ ...prev, calle: s.label, cap: "" }));
    setDestinoExacto({ lat: s.lat, lng: s.lng });
  };

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    setFieldErrors({});

    const { calle, cap, ciudad, salida, ...rest } = form;
    const salidaPayload = buildSalidaPayload(salida);
    // Con una sugerencia (ubicacion exacta) la parada es solo el nombre del destino y sus coordenadas.
    const direccion = exactoVigente
      ? { direccion: calle.trim(), lat: exactoVigente.lat, lng: exactoVigente.lng }
      : buildAddress({ calle, cap, ciudad });
    // DHL/AB Service no maneja codigos propios: se genera uno interno solo para
    // cumplir la columna unica de la base, no se le muestra al usuario.
    const codigo = `${form.spedizzione}-${Date.now()}`;

    const payload = Object.fromEntries(
      Object.entries({ ...rest, ...(salidaPayload ? { salida: salidaPayload } : {}), codigo, ciudad, stops: [direccion] }).filter(
        ([key, value]) => key === "stops" || key === "pasaPorBrennero" || key === "pasaPorFrejus" || value !== ""
      )
    );

    try {
      const record = await createRecordRequest(payload);
      refreshRecords();
      // Se preserva backgroundLocation (si esta pantalla se abrio como overlay sobre
      // una lista, ver App.jsx) para que el detalle del registro recien creado
      // tambien se muestre como overlay, en vez de que la lista de fondo se
      // desmonte en esta transicion.
      navigate(`/records/${record.id}`, {
        replace: true,
        state: { backgroundLocation: location.state?.backgroundLocation },
      });
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.message);
      setFieldErrors(parsed.fieldErrors || {});
    } finally {
      setSubmitting(false);
    }
  };

  if (!isPrivileged) return <Navigate to="/records/dhl-ab-service" replace />;

  if (loadError) {
    return (
      <SlideOverPanel closeTo="/records/dhl-ab-service">
        <Alert>{loadError}</Alert>
      </SlideOverPanel>
    );
  }

  const loaded = drivers && vehicles && clients;

  if (!loaded) {
    return (
      <SlideOverPanel closeTo="/records/dhl-ab-service">
        <PageLoader />
      </SlideOverPanel>
    );
  }

  const driverOptions = drivers.map((d) => ({ value: d.id, label: `${d.nombre} ${d.apellido}` }));
  const vehicleOptions = vehicles.map((v) => ({
    value: v.id,
    label: `${v.targa} - ${v.modelo}`,
  }));
  // Aplicativo acotado a la zona elegida (MILANO_1..18 o ROMA_1..10) - mezclar los 28
  // en una sola lista larga hacia mas dificil encontrar el circuito correcto, sobre
  // todo en Roma (10 circuitos perdidos entre los 18 de Milano).
  const aplicativoOptions = APLICATIVO_OPTIONS.filter((opt) =>
    opt.value.startsWith(`${form.extrasPiazzaZona}_`)
  );

  // Si se cambia la zona con un aplicativo ya elegido de la otra, se limpia - un
  // MILANO_5 cargado con Zona Roma quedaria inconsistente (y probablemente ni pase la
  // validacion si mas adelante el backend cruza ambos campos).
  const handleChangeZona = (zona) => {
    setForm((prev) => ({
      ...prev,
      extrasPiazzaZona: zona,
      aplicativo: prev.aplicativo.startsWith(`${zona}_`) ? prev.aplicativo : "",
    }));
  };

  return (
    <SlideOverPanel closeTo="/records/dhl-ab-service">
    <div className="flex flex-col gap-6">
      <div>
        <BackLink
          to="/records/dhl-ab-service"
          className="text-[13px] font-medium text-accent-400 hover:text-accent-300"
        >
          &larr; Mis registros
        </BackLink>
      </div>

      <div>
        <h1 className="text-[24px] font-semibold text-ink-50">Nuevo servicio - DHL / AB Service</h1>
        <p className="mt-1 text-[14px] text-ink-300">Completa los datos para crear un servicio.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <GlassCard>
          <h2 className="text-[17px] font-medium text-ink-50">Datos del servicio</h2>

          <Alert>{formError}</Alert>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <SearchableSelect
                id="estado"
                label="Estado"
                placeholder="Escribe para buscar un estado"
                options={RECORD_STATUS_OPTIONS}
                maxSuggestions={RECORD_STATUS_OPTIONS.length}
                value={form.estado}
                onChange={(v) => setField("estado", v)}
              />
            </div>

            <SearchableSelect
              id="driverId"
              label="Chofer"
              placeholder="Escribe para buscar un chofer"
              options={driverOptions}
              value={form.driverId}
              onChange={(v) => setField("driverId", v)}
              error={fieldErrors.driverId?.[0]}
            />

            <SearchableSelect
              id="vehicleId"
              label="Targa"
              placeholder="Escribe para buscar una targa"
              options={vehicleOptions}
              value={form.vehicleId}
              onChange={(v) => setField("vehicleId", v)}
              error={fieldErrors.vehicleId?.[0]}
            />

            <div>
              <TextField
                id="fechaRetiro"
                label="Fecha retiro"
                type="datetime-local"
                value={form.fechaRetiro}
                onChange={handleChange("fechaRetiro")}
                error={fieldErrors.fechaRetiro?.[0]}
              />
              <p className="mt-1.5 text-[12px] text-ink-400">
                Cuando sale el chofer a trabajar: de ahi cuentan sus horas y el dia del servicio. Si el paquete se retira antes y se
                entrega dias despues, pon aqui la hora en que sale a entregar.
              </p>
            </div>

            <RetiroPaqueteField
              value={form.retiroPaqueteAt}
              onChange={(v) => setField("retiroPaqueteAt", v)}
              fechaRetiro={form.fechaRetiro}
              error={fieldErrors.retiroPaqueteAt?.[0]}
            />

            <TextField
              id="eta"
              label="ETA"
              type="datetime-local"
              value={form.eta}
              onChange={handleChange("eta")}
              error={fieldErrors.eta?.[0]}
              required
            />

            <FechasAviso fechas={form} />

            <SearchableSelect
              id="spedizzione"
              label="Spedizzione"
              placeholder="Escribe para buscar una spedizzione"
              options={SPEDIZZIONE_OPTIONS}
              value={form.spedizzione}
              onChange={(v) => setField("spedizzione", v)}
              error={fieldErrors.spedizzione?.[0]}
            />

            <ClientAutocomplete
              id="clientId"
              label="Cliente"
              clients={clients}
              value={form.clientId}
              onChange={(clientId) => setField("clientId", clientId)}
              onClientCreated={(client) => setClients((prev) => [...prev, client])}
              error={fieldErrors.clientId?.[0]}
            />

            <SearchableSelect
              id="extrasPiazzaZona"
              label="Zona"
              placeholder="Escribe para buscar una zona"
              options={ZONA_OPTIONS}
              value={form.extrasPiazzaZona}
              onChange={handleChangeZona}
              error={fieldErrors.extrasPiazzaZona?.[0]}
            />

            <SearchableSelect
              id="aplicativo"
              label="Numero de aplicativo"
              placeholder="Escribe para buscar un aplicativo"
              options={aplicativoOptions}
              value={form.aplicativo}
              onChange={(v) => setField("aplicativo", v)}
              error={fieldErrors.aplicativo?.[0]}
            />
          </div>

          <div className="mt-5">
            <Textarea
              id="descripcion"
              label="Descripcion"
              placeholder="Detalle del servicio a realizar..."
              value={form.descripcion}
              onChange={handleChange("descripcion")}
              error={fieldErrors.descripcion?.[0]}
              required
            />
          </div>

          <div className="mt-5">
            <Textarea
              id="comentarios"
              label="Notas"
              placeholder="Notas adicionales del servicio..."
              value={form.comentarios}
              onChange={handleChange("comentarios")}
              error={fieldErrors.comentarios?.[0]}
            />
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-[17px] font-medium text-ink-50">Salida</h2>
          <p className="mt-1 text-[13px] text-ink-300">
            Desde donde sale el servicio. Elige una sugerencia o escribe una direccion.
          </p>
          <div className="mt-5">
            <SalidaField
              value={form.salida}
              onChange={(salida) => setField("salida", salida)}
              disabled={submitting}
              error={fieldErrors.salida?.[0]}
              porDefecto={salidaPorDefectoLabel(form.spedizzione, form.extrasPiazzaZona)}
            />
          </div>
          <div className="mt-4">
            <PasosFronteraCheckboxes
              brennero={form.pasaPorBrennero}
              onBrennero={(value) => setField("pasaPorBrennero", value)}
              frejus={form.pasaPorFrejus}
              onFrejus={(value) => setField("pasaPorFrejus", value)}
              disabled={submitting}
            />
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-[17px] font-medium text-ink-50">Destinazzione</h2>
          <p className="mt-1 text-[13px] text-ink-300">
            Lugar de consegna. Completa calle, CAP y ciudad por separado para que la busqueda en el
            mapa sea mas precisa.
          </p>

          <DestinoSugerencias
            className="mt-4"
            sugerencias={sugerenciasDestino}
            lat={exactoVigente?.lat}
            lng={exactoVigente?.lng}
            disabled={submitting}
            onPick={pickDestino}
          />

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <TextField
              id="calle"
              label="Calle / direccion"
              placeholder="Ej: Via delle Industrie, 2e"
              className="sm:col-span-2"
              value={form.calle}
              onChange={(e) => {
                setDestinoExacto(null);
                handleChange("calle")(e);
              }}
              error={fieldErrors.stops?.[0]}
              required
            />
            <TextField
              id="cap"
              label="CAP"
              placeholder="Ej: 26014"
              value={form.cap}
              disabled={Boolean(exactoVigente)}
              onChange={handleChange("cap")}
            />
            <TextField
              id="ciudad"
              label="Ciudad"
              placeholder="Ej: Romanengo CR"
              className="sm:col-span-3"
              value={form.ciudad}
              onChange={handleChange("ciudad")}
              error={fieldErrors.ciudad?.[0]}
              required={!exactoVigente}
            />
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-[17px] font-medium text-ink-50">Kilometraje y costos</h2>
          <p className="mt-1 text-[13px] text-ink-300">
            Kilometros planificados. El chofer carga despues los kilometros reales para la
            comparativa.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <TextField
                id="kilometros"
                label="Km del cliente (solo ida)"
                type="number"
                step="0.1"
                min="0"
                value={form.kilometros}
                onChange={handleChange("kilometros")}
              />
              <p className="mt-1.5 text-[12px] text-ink-400">
                {kmCliente > 0
                  ? `x 2 (ida y vuelta) = ${Math.round(kmCliente * 20) / 10} km facturables${
                      tarifas ? ` · a ${tarifas.DHL_AB} EUR/km = ${formatCurrency(kmCliente * 2 * tarifas.DHL_AB)}` : ""
                    }`
                  : "Los km que manda el cliente son de ida: se cuentan x2 y se pagan a la tarifa de DHL."}
              </p>
            </div>
            <TextField
              id="areaC"
              label="Area C"
              type="number"
              step="0.01"
              min="0"
              value={form.areaC}
              onChange={handleChange("areaC")}
            />
            <TextField
              id="costoEspera"
              label="Costo de espera"
              type="number"
              step="0.01"
              min="0"
              value={form.costoEspera}
              onChange={handleChange("costoEspera")}
            />
            <TextField
              id="costoCombustible"
              label="Costo combustible (a mano)"
              type="number"
              step="0.01"
              min="0"
              value={form.costoCombustible}
              onChange={handleChange("costoCombustible")}
            />
            <TextField
              id="peajes"
              label="Peajes exterior"
              type="number"
              step="0.01"
              min="0"
              value={form.peajes}
              onChange={handleChange("peajes")}
            />
            <TextField
              id="vignetta"
              label="Vignetta"
              type="number"
              step="0.01"
              min="0"
              value={form.vignetta}
              onChange={handleChange("vignetta")}
            />
            <TextField
              id="costoHotel"
              label="Costo de hotel"
              type="number"
              step="0.01"
              min="0"
              value={form.costoHotel}
              onChange={handleChange("costoHotel")}
            />
            <TextField
              id="costoTraforoFrejusBrennero"
              label="Traforo Frejus/Brennero"
              type="number"
              step="0.01"
              min="0"
              value={form.costoTraforoFrejusBrennero}
              onChange={handleChange("costoTraforoFrejusBrennero")}
            />
            <TextField
              id="costoOtros"
              label="Otros"
              type="number"
              step="0.01"
              min="0"
              placeholder="Viaticos, etc."
              value={form.costoOtros}
              onChange={handleChange("costoOtros")}
            />
          </div>
        </GlassCard>

        <Button type="submit" loading={submitting} className="sm:w-auto sm:px-8">
          Crear servicio
        </Button>
      </form>
    </div>
    </SlideOverPanel>
  );
};
