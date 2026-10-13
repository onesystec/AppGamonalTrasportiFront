import { api } from "./api";
import { sharedGet } from "./sharedRequest";

// Compartida (ver sharedRequest.js): al abrir la app la piden varias pantallas a la vez.
export const listVehiclesRequest = () => sharedGet("vehiculos", () => api.get("/vehiculos").then((res) => res.data.data.vehicles));

// GPS del vehiculo (Velocity Fleet, seccion Mapa) - solo trae los vehiculos que
// tienen ese dispositivo instalado (no todos todavia). Ver MapPage.jsx: se usa para
// reemplazar la posicion del celular del chofer por la del vehiculo cuando esta
// disponible, mas precisa.
export const listVehicleLivePositionsRequest = () =>
  api.get("/vehiculos/live-positions").then((res) => res.data.data.positions);

// ETA a un destino escrito a mano (buscador de targa del Mapa) - origen es la
// posicion que ya se esta mostrando en el marcador (GPS del vehiculo o del celular
// del chofer), destino es texto libre (direccion o ciudad), se geocodifica del lado
// del backend (mismo geocoder que ya usan los registros).
export const getEtaToDestinationRequest = (origenLat, origenLng, destino) =>
  api
    .post("/vehiculos/eta-a-destino", { origenLat, origenLng, destino })
    .then((res) => res.data.data.eta);

// Seccion "Area C" del Mapa (pestanias Pagado/No pagado) - todas las entradas, el
// front separa por "pagado".
export const listAreaCEntriesRequest = () =>
  api.get("/vehiculos/area-c-entries").then((res) => res.data.data.entries);

// Solo las que siguen sin pagar - para la campanita de notificaciones (ver
// computeAreaCAlerts en dashboardStats.js).
export const listUnpaidAreaCEntriesRequest = () =>
  api.get("/vehiculos/area-c-entries/unpaid").then((res) => res.data.data.entries);

// Marca (o desmarca) una entrada de Area C como pagada, con opcionalmente una foto
// del comprobante (formData: "pagado" + opcional "comprobante").
export const updateAreaCEntryRequest = (id, formData) =>
  api.patch(`/vehiculos/area-c-entries/${id}`, formData).then((res) => res.data.data.entry);

// Los excesos de velocidad del propio usuario en los ultimos 7 dias: lo que ve el chofer en sus avisos. La oficina ya no recibe estos avisos en la
// campanita: los ve en Vehiculos > Avisos de velocidad (ver getSpeedingSummaryRequest).
export const listMySpeedingEventsRequest = () =>
  api.get("/vehiculos/speeding-events/mine").then((res) => res.data.data.events);

// Importa a demanda (boton "Importar de Velocity Fleet" en Vehiculos) las targas que
// reporte el GPS y que todavia no tengan ficha en la app - se crean con area "Sin
// asignar" para revisar despues.
export const syncVehiclesFromVelocityFleetRequest = () =>
  api.post("/vehiculos/sync-from-velocity-fleet").then((res) => res.data.data);

export const getVehicleRequest = (id) =>
  api.get(`/vehiculos/${id}`).then((res) => res.data.data.vehicle);

export const createVehicleRequest = (formData) =>
  api.post("/vehiculos", formData).then((res) => res.data.data.vehicle);

export const updateVehicleRequest = (id, formData) =>
  api.patch(`/vehiculos/${id}`, formData).then((res) => res.data.data.vehicle);

export const deleteVehicleRequest = (id) => api.delete(`/vehiculos/${id}`);

export const registerVehicleKmRequest = (id, data) =>
  api.post(`/vehiculos/${id}/mantenimiento`, data).then((res) => res.data.data.vehicle);

export const listVehicleMantenimientosRequest = (id) =>
  api.get(`/vehiculos/${id}/mantenimiento`).then((res) => res.data.data.mantenimientos);

export const deleteVehicleMantenimientoRequest = (vehicleId, mantenimientoId) =>
  api.delete(`/vehiculos/${vehicleId}/mantenimiento/${mantenimientoId}`);

// Elimina una entrada de Area C que no queremos guardar (Mapa > Area C, siempre despues
// de confirmar en un modal). El backend borra tambien el comprobante.
export const deleteAreaCEntryRequest = (id) =>
  api.delete(`/vehiculos/area-c-entries/${id}`).then((res) => res.data.data);

// Excesos de velocidad: resumen liviano por vehiculo y el detalle de uno. Solo se piden cuando se abre Vehiculos > Avisos de velocidad (o la
// seccion de la ficha del vehiculo), nunca al cargar la pagina.
export const getSpeedingSummaryRequest = () =>
  api.get("/vehiculos/speeding-events/summary").then((res) => res.data.data.summary);

export const listSpeedingEventsByVehicleRequest = (vehicleId) =>
  api.get("/vehiculos/speeding-events", { params: { vehicleId } }).then((res) => res.data.data.events);
