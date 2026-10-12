import { BackLink } from "../../components/ui/BackLink";
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ClientAutocomplete } from "../../components/ui/ClientAutocomplete";
import { GlassCard } from "../../components/ui/GlassCard";
import { PageLoader } from "../../components/ui/PageLoader";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { TextField } from "../../components/ui/TextField";
import { Textarea } from "../../components/ui/Textarea";
import { SlideOverPanel } from "../../components/ui/SlideOverPanel";
import { RetiroPaqueteField } from "../../components/records/RetiroPaqueteField";
import { FechasAviso } from "../../components/records/FechasAviso";
import { combineStopAddress, StopListEditor } from "../../components/records/StopListEditor";
import { buildSalidaPayload, EMPTY_SALIDA } from "../../components/records/SalidaField";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { listClientsRequest } from "../../lib/clients.api";
import { RECORD_STATUS_OPTIONS } from "../../lib/constants";
import { createRecordRequest } from "../../lib/records.api";
import { listUsersRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

const INITIAL_FORM = {
  codigo: "",
  clientId: "",
  driverId: "",
  vehicleId: "",
  stops: [{ direccion: "", cap: "", lat: null, lng: null }],
  // Punto de salida: en blanco al empezar (si queda vacio se usa el deposito).
  salida: EMPTY_SALIDA,
  pasaPorBrennero: false,
  descripcion: "",
  eta: "",
  fechaRetiro: "",
  retiroPaqueteAt: "",
  estado: "IN_SOSPESO",
  kilometros: "",
  precioKm: "",
  pagoRecibido: "",
  costoCombustible: "",
  peajes: "",
  vignetta: "",
  costoHotel: "",
  costoTraforoFrejusBrennero: "",
  areaC: "",
  costoEspera: "",
  costoOtros: "",
};

export const NewExtrasStefaniaRecordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh: refreshRecords } = useDataRefresh("records");
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const [form, setForm] = useState(INITIAL_FORM);
  const [drivers, setDrivers] = useState(null);
  const [vehicles, setVehicles] = useState(null);
  const [clients, setClients] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    Promise.all([listUsersRequest(), listVehiclesRequest(), listClientsRequest()])
      .then(([users, vehiclesData, clientsData]) => {
        setDrivers(users.filter((u) => u.estado === "ACTIVO"));
        setVehicles(vehiclesData);
        setClients(clientsData);
      })
      .catch((err) => setLoadError(parseApiError(err).message));
  }, []);

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    setFieldErrors({});

    const trimmedStops = form.stops.map(combineStopAddress).filter(Boolean);

    // Esta pantalla es la unica alta de la seccion "Extras Stefania", asi que el
    // spedizzione queda fijo aca (igual que "Extras Piazza" en NewRecordPage.jsx).
    const { salida, ...formWithoutSalida } = form;
    const salidaPayload = buildSalidaPayload(salida);
    const payload = Object.fromEntries(
      Object.entries({ ...formWithoutSalida, ...(salidaPayload ? { salida: salidaPayload } : {}), stops: trimmedStops, spedizzione: "EXTRAS_STEFANIA" }).filter(
        ([key, value]) => key === "stops" || key === "pasaPorBrennero" || value !== ""
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

  if (!isPrivileged) return <Navigate to="/records/extras-stefania" replace />;

  if (loadError) {
    return (
      <SlideOverPanel closeTo="/records/extras-stefania">
        <Alert>{loadError}</Alert>
      </SlideOverPanel>
    );
  }

  const loaded = drivers && vehicles && clients;

  if (!loaded) {
    return (
      <SlideOverPanel closeTo="/records/extras-stefania">
        <PageLoader />
      </SlideOverPanel>
    );
  }

  const driverOptions = drivers.map((d) => ({ value: d.id, label: `${d.nombre} ${d.apellido}` }));
  const vehicleOptions = vehicles.map((v) => ({
    value: v.id,
    label: `${v.targa} - ${v.modelo}`,
  }));

  return (
    <SlideOverPanel closeTo="/records/extras-stefania">
    <div className="flex flex-col gap-6">
      <div>
        <BackLink
          to="/records/extras-stefania"
          className="text-[13px] font-medium text-accent-400 hover:text-accent-300"
        >
          &larr; Mis registros
        </BackLink>
      </div>

      <div>
        <h1 className="text-[24px] font-semibold text-ink-50">Nuevo servicio - Extras Stefania</h1>
        <p className="mt-1 text-[14px] text-ink-300">Completa los datos para crear un servicio.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <GlassCard>
          <h2 className="text-[17px] font-medium text-ink-50">Datos del servicio</h2>

          <Alert>{formError}</Alert>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField
              id="codigo"
              label="Codigo"
              placeholder="Ej: GT-0001"
              value={form.codigo}
              onChange={handleChange("codigo")}
              error={fieldErrors.codigo?.[0]}
              required
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
              label="Vehiculo"
              placeholder="Escribe para buscar un vehiculo"
              options={vehicleOptions}
              value={form.vehicleId}
              onChange={(v) => setField("vehicleId", v)}
              error={fieldErrors.vehicleId?.[0]}
            />

            <SearchableSelect
              id="estado"
              label="Estado inicial"
              placeholder="Escribe para buscar un estado"
              options={RECORD_STATUS_OPTIONS}
              maxSuggestions={RECORD_STATUS_OPTIONS.length}
              value={form.estado}
              onChange={(v) => setField("estado", v)}
            />

            <div>
              <TextField
                id="fechaRetiro"
                label="Fecha retiro (hora de Roma)"
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
              label="ETA (hora de Roma)"
              type="datetime-local"
              value={form.eta}
              onChange={handleChange("eta")}
              error={fieldErrors.eta?.[0]}
              required
            />

            <FechasAviso fechas={form} />
          </div>

          <div className="mt-5">
            <StopListEditor
              stops={form.stops}
              onChange={(stops) => setField("stops", stops)}
              salida={form.salida}
              onSalidaChange={(salida) => setField("salida", salida)}
              pasaPorBrennero={form.pasaPorBrennero}
              onPasaPorBrenneroChange={(value) => setField("pasaPorBrennero", value)}
              salidaError={fieldErrors.salida?.[0]}
              error={fieldErrors.stops?.[0]}
              disabled={submitting}
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
        </GlassCard>

        <GlassCard>
          <h2 className="text-[17px] font-medium text-ink-50">Datos economicos</h2>
          <p className="mt-1 text-[13px] text-ink-300">
            Opcional. El chofer despues carga los kilometros reales para comparar.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <TextField
              id="kilometros"
              label="Kilometros planificados"
              type="number"
              step="0.1"
              min="0"
              value={form.kilometros}
              onChange={handleChange("kilometros")}
            />
            <TextField
              id="precioKm"
              label="Precio por km"
              type="number"
              step="0.01"
              min="0"
              value={form.precioKm}
              onChange={handleChange("precioKm")}
            />
            <TextField
              id="pagoRecibido"
              label="Monto recibido"
              type="number"
              step="0.01"
              min="0"
              placeholder="Lo que efectivamente se cobro (columna MONTO en Sheets)"
              value={form.pagoRecibido}
              onChange={handleChange("pagoRecibido")}
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
              label="Peajes"
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
