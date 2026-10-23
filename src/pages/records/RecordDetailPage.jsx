import { useCallback, useEffect, useRef, useState } from "react";
import { FaltantesCard } from "../../components/records/FaltantesPanel";
import { ViajeCompactoCard } from "../../components/records/ViajeCompactoCard";
import { BackLink } from "../../components/ui/BackLink";
import { useCloseOverlay } from "../../hooks/useCloseOverlay";
import { Link, useLocation, useParams } from "react-router-dom";
import { CerrarServicioModal } from "../../components/horas/CerrarServicioModal";
import { HorasEstadoChip } from "../../components/horas/HorasEstadoChip";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ClientAutocomplete } from "../../components/ui/ClientAutocomplete";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { GlassCard } from "../../components/ui/GlassCard";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { PageLoader } from "../../components/ui/PageLoader";
import { CameraPickButton } from "../../components/ui/CameraPickButton";
import { Spinner } from "../../components/ui/Spinner";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { TextField } from "../../components/ui/TextField";
import { Textarea } from "../../components/ui/Textarea";
import { SlideOverPanel } from "../../components/ui/SlideOverPanel";
import { CircuitoDetalle } from "../../components/records/CircuitoDetalle";
import { RetiroPaqueteField } from "../../components/records/RetiroPaqueteField";
import { FechasAviso } from "../../components/records/FechasAviso";
import { ReprogramacionModal } from "../../components/records/ReprogramacionModal";
import { MOTIVO_LABEL, ReprogramacionPanel, buildReprogBody, emptyReprog, reprogError } from "../../components/records/ReprogramacionPanel";
import { combineStopAddress, StopListEditor } from "../../components/records/StopListEditor";
import { buildSalidaPayload } from "../../components/records/SalidaField";
import { useAuth } from "../../context/AuthContext";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { listClientsRequest } from "../../lib/clients.api";
import {
  APLICATIVO_OPTIONS,
  RECORD_STATUS_OPTIONS,
  TIPO_ARCHIVO_LABELS,
  ZONA_LABELS,
  ZONA_OPTIONS,
  destinoSugerencias,
  salidaPorDefectoLabel,
} from "../../lib/constants";
import {
  formatCurrency,
  formatDateTime,
  formatRomeDateTime,
  toRomeDateTimeInputValue,
} from "../../lib/format";
import {
  deleteRecordRequest,
  deshacerReprogramacionRequest,
  getRecordRequest,
  listRecordFilesRequest,
  reprogramarRecordRequest,
  updateRecordRequest,
  uploadRecordFileRequest,
} from "../../lib/records.api";
import { formatHours, pagaPorKm } from "../../lib/horas";
import { listUsersRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

// Jornada declarada por el chofer (inicio/fin, espera, pausa) y su estado de aprobacion. El chofer
// puede cargarla o corregirla mientras no este aprobada; la oficina las revisa en Finanzas > Horas.
// "isChofer" aqui es quien declara las horas: el chofer, o un Admin/Responsable que manejo este servicio.
const JornadaOfService = ({ record, isChofer, onOpenHours }) => {
  const location = useLocation();
  const viaje = record.compactado;
  // Servicio que no es el principal de un viaje compacto: las horas son las del viaje, se cargan en el principal.
  if (viaje && !viaje.principal) {
    return (
      <div className="mt-6 border-t border-line/10 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[13px] font-medium uppercase tracking-wide text-ink-400">Horas trabajadas</h3>
          <HorasEstadoChip estado={viaje.principalHoras} />
        </div>
        <p className="mt-2 text-[13px] text-ink-300">
          Las horas de este viaje se cargan una sola vez, en{" "}
          <Link
            to={`/records/${viaje.principalId}`}
            state={{ backgroundLocation: location.state?.backgroundLocation ?? location }}
            replace
            className="font-semibold text-accent-300 hover:underline"
          >
            {viaje.principalCodigo}
          </Link>
          .{" "}
          {viaje.principalHoras
            ? "Ya están cargadas (estado arriba)."
            : isChofer
              ? "Todavía no las cargaste."
              : "El chofer todavía no las cargó."}
        </p>
      </div>
    );
  }
  const j = record.jornada ?? {};
  // Desde el pago por km no hay horas declaradas: se muestra el cierre del servicio (espera y bolla).
  if (pagaPorKm(record)) {
    const finished = ["CONSEGNATO", "RITIRATO"].includes(record.estado);
    const canClose = isChofer && !["ANNULLATO", "RISCHEDULATO"].includes(record.estado);
    return (
      <div className="mt-6 border-t border-line/10 pt-6">
        <h3 className="text-[13px] font-medium uppercase tracking-wide text-ink-400">Cierre del servicio</h3>
        {finished && <p className="mt-2 text-[13px] text-ink-300">Espera declarada: {j.esperaMin ?? 0} min.</p>}
        {canClose && (
          <Button className="mt-3 sm:w-auto sm:px-5 sm:py-2 sm:text-[13px]" onClick={onOpenHours}>
            {finished ? "Espera y bolla de trabajo" : "Terminar servicio"}
          </Button>
        )}
      </div>
    );
  }
  // Un servicio reprogramado por la oficina tambien se carga: el chofer manejo hasta ahi y se le paga.
  const delivered = ["CONSEGNATO", "RITIRATO", "IN_CONSEGNA"].includes(record.estado) || (record.estado === "RISCHEDULATO" && Boolean(record.reprogramado));
  const canLoad = isChofer && delivered && j.estado !== "APROBADAS" && j.estado !== "PENDIENTE";
  const canEdit = isChofer && j.estado === "PENDIENTE";
  return (
    <div className="mt-6 border-t border-line/10 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[13px] font-medium uppercase tracking-wide text-ink-400">Horas trabajadas</h3>
        <HorasEstadoChip estado={j.estado} />
      </div>
      {j.estado ? (
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {j.inicio && <InfoRow label="Inicio" value={formatRomeDateTime(j.inicio)} />}
          {j.fin && <InfoRow label="Fin" value={formatRomeDateTime(j.fin)} />}
          <InfoRow label="Dia / noche" value={`${formatHours(j.horasDia)} / ${formatHours(j.horasNoche)}`} />
          <InfoRow label="Espera" value={`${j.esperaMin} min`} />
          <InfoRow label="Pausa no trabajada" value={`${j.pausaMin} min`} />
        </div>
      ) : (
        <p className="mt-2 text-[13px] text-ink-400">El chofer todavia no cargo sus horas.</p>
      )}
      {j.estado === "APROBADAS" && j.auto && (
        <p className="mt-3 rounded-lg bg-success-500/10 px-3 py-2 text-[12px] text-ink-200">
          <b className="text-success-500">Aprobadas automáticamente:</b> las horas y los km quedaron dentro de lo planificado
          (circuito, ruta{record.compactado ? " y viaje" : ""}), así que no pasaron por la cola de aprobación.
        </p>
      )}
      {j.nota && (
        <p className="mt-3 rounded-lg bg-line/5 px-3 py-2 text-[12px] text-ink-200">
          <b className="text-ink-50">Nota del responsable:</b> {j.nota}
        </p>
      )}
      {(canLoad || canEdit) && (
        <Button className="mt-3 sm:w-auto sm:px-5 sm:py-2 sm:text-[13px]" onClick={onOpenHours}>
          {j.estado === "DEVUELTAS" ? "Corregir horas" : canEdit ? "Editar horas enviadas" : "Cargar horas"}
        </Button>
      )}
    </div>
  );
};

// Traspaso entre choferes: quien termino el servicio (si el chofer asignado no pudo) o de quien se recibio, y donde se paso
// el paquete. El chofer que recibe ya no indica ninguna hora: su servicio arranca solo.
const TraspasoOfService = ({ record, isChofer }) => {
  const { relevo, origen } = record;
  if (!relevo && !origen) return null;
  const name = (p) => (p ? `${p.nombre} ${p.apellido}` : "otro chofer");

  return (
    <div className="mt-6 rounded-xl border border-accent-500/30 bg-accent-500/5 px-4 py-3">
      <h3 className="text-[13px] font-medium uppercase tracking-wide text-ink-400">Traspaso entre choferes</h3>
      {relevo && (
        <p className="mt-1.5 text-[14px] text-ink-100">
          Lo termino <b>{name(relevo.chofer)}</b>
          {relevo.lugar ? `, en ${relevo.lugar}` : ""}
          {relevo.traspasoHora ? `, que recibio el paquete el ${formatRomeDateTime(relevo.traspasoHora)}` : ""}.{" "}
          <Link to={`/records/${relevo.recordId}`} className="font-medium text-accent-400 hover:text-accent-300">
            Ver su servicio &rarr;
          </Link>
        </p>
      )}
      {origen && (
        <>
          <p className="mt-1.5 text-[14px] text-ink-100">
            Recibido de <b>{name(origen.chofer)}</b> (servicio{" "}
            <Link to={`/records/${origen.recordId}`} className="font-medium text-accent-400 hover:text-accent-300">
              {origen.codigo}
            </Link>
            ){origen.lugar ? ` en ${origen.lugar}` : ""}.{" "}
            {record.traspasoHora && `Recibio el paquete el ${formatRomeDateTime(record.traspasoHora)}.`}
          </p>
        </>
      )}
      {isChofer && relevo && (
        <p className="mt-1 text-[12px] text-ink-400">
          Tu jornada no termina al entregar el paquete: termina cuando vuelves al lugar de espera.
        </p>
      )}
    </div>
  );
};

// Reprogramacion: del servicio reprogramado, los km que hizo el chofer y el servicio nuevo; del servicio nuevo, de cual viene.
// La oficina puede deshacerla mientras el servicio nuevo no tenga movimiento.
const ReprogramacionOfService = ({ record, isChofer, onChanged }) => {
  const { reprogramado, reprogramadoDe } = record;
  const [confirming, setConfirming] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [error, setError] = useState("");
  if (!reprogramado && !reprogramadoDe) return null;

  const undo = async () => {
    setUndoing(true);
    setError("");
    try {
      await deshacerReprogramacionRequest(record.id);
      setConfirming(false);
      onChanged();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-status-rischedulato/30 bg-status-rischedulato/5 px-4 py-3">
      <h3 className="text-[13px] font-medium uppercase tracking-wide text-ink-400">Reprogramacion</h3>
      {reprogramado && (
        <>
          <p className="mt-1.5 text-[14px] text-ink-100">
            {reprogramado.kmHechos != null && !isChofer ? (
              <>
                El chofer hizo <b>{reprogramado.kmHechos} km</b>
                {reprogramado.kmPlanificados != null ? ` de ${reprogramado.kmPlanificados}` : ""}; se facturan y se pagan.{" "}
              </>
            ) : (
              "Reprogramado. "
            )}
            {reprogramado.motivo ? `Motivo: ${MOTIVO_LABEL[reprogramado.motivo] ?? reprogramado.motivo}. ` : ""}
            {reprogramado.nuevoId && (
              <>
                Reprogramado como{" "}
                <Link to={`/records/${reprogramado.nuevoId}`} className="font-medium text-accent-400 hover:text-accent-300">
                  {reprogramado.nuevoCodigo} &rarr;
                </Link>
              </>
            )}
          </p>
          {!isChofer && reprogramado.nuevoId && (
            <div className="mt-2">
              <button type="button" onClick={() => setConfirming(true)} className="text-[13px] font-medium text-danger-500 hover:brightness-110">
                Deshacer la reprogramacion
              </button>
            </div>
          )}
        </>
      )}
      {reprogramadoDe && (
        <p className="mt-1.5 text-[14px] text-ink-100">
          Reprogramacion de{" "}
          <Link to={`/records/${reprogramadoDe.recordId}`} className="font-medium text-accent-400 hover:text-accent-300">
            {reprogramadoDe.codigo ?? "otro servicio"} &rarr;
          </Link>
        </p>
      )}
      <ConfirmModal
        open={confirming}
        title="Deshacer la reprogramacion"
        description={`Se borra el servicio nuevo ${reprogramado?.nuevoCodigo ?? ""} y ${record.codigo} vuelve a su estado y sus km originales. Solo se puede si el servicio nuevo todavia no tiene movimiento.`}
        confirmLabel="Deshacer"
        error={error}
        loading={undoing}
        onConfirm={undo}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
};

// Peajes (mancato pagamento) que el sistema asigno a este servicio, con cuantos fueron de ida y
// de vuelta. Un servicio puede tener varios en cada tramo.
const MancatosOfService = ({ mancatos }) => {
  const location = useLocation();
  if (!mancatos || mancatos.length === 0) return null;
  const ida = mancatos.filter((m) => m.tramo === "IDA").length;
  const vuelta = mancatos.filter((m) => m.tramo === "VUELTA").length;
  const total = mancatos.reduce((sum, m) => sum + m.costo, 0);

  return (
    <div className="mt-6 border-t border-line/10 pt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-medium uppercase tracking-wide text-ink-400">
          Peajes (mancato pagamento)
        </h3>
        <span className="text-[12px] text-ink-400">
          {mancatos.length} {mancatos.length === 1 ? "peaje" : "peajes"} - {ida} de ida, {vuelta} de vuelta -{" "}
          {formatCurrency(total)}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {mancatos.map((m) => (
          <li key={m.id}>
            <Link
              to={`/finanzas/mancato/${m.id}`}
              state={{ backgroundLocation: location }}
              className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg bg-line/[0.06] px-3 py-2 text-[13px] transition-colors hover:bg-line/10"
            >
              <span className="font-medium text-ink-50">#{m.numero}</span>
              <span className="text-ink-300">{formatRomeDateTime(m.fechaHoraTransito)}</span>
              {m.tramo && (
                <span className="rounded-full bg-line/10 px-2 py-0.5 text-[11px] text-ink-200">
                  {m.tramo === "IDA" ? "Ida" : "Vuelta"}
                </span>
              )}
              <span className="ml-auto font-semibold text-ink-50">{formatCurrency(m.costo)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

// Combustible del servicio: los comprobantes asignados mandan; si no hay, vale lo cargado a mano.
// Si lo cargado a mano es casi el doble (o mas) de lo que suman los comprobantes, se avisa para
// auditar. Nunca se suman las dos fuentes.
const FuelOfService = ({ record }) => {
  const location = useLocation();
  const fuel = record.combustible;
  if (!fuel) return null;
  const items = fuel.comprobantes?.items ?? [];

  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <InfoRow
        label="Combustible (fuera del total)"
        value={
          fuel.total
            ? `${formatCurrency(fuel.total)} - ${
                fuel.fuente === "COMPROBANTES"
                  ? `${fuel.comprobantes.count} ${fuel.comprobantes.count === 1 ? "comprobante" : "comprobantes"}`
                  : "estimado (a mano, sin comprobantes)"
              }`
            : "-"
        }
      />
      {items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                to={`/finanzas/combustible/${c.id}`}
                state={{ backgroundLocation: location }}
                className="flex flex-wrap items-center gap-x-3 rounded-lg bg-line/[0.06] px-3 py-1.5 text-[12px] transition-colors hover:bg-line/10"
              >
                <span className="text-ink-300">{formatRomeDateTime(c.fechaHora)}</span>
                <span className="text-ink-200">{c.metodo}</span>
                <span className="ml-auto font-semibold text-ink-50">{formatCurrency(c.monto)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {fuel.auditar && (
        <div className="rounded-xl bg-warning-500/10 px-3 py-2 text-[12px] text-warning-500">
          A auditar: el combustible cargado a mano ({formatCurrency(fuel.manual)}) es casi el doble o mas de lo
          que suman los comprobantes ({formatCurrency(fuel.comprobantes.total)}). Se usa el de los
          comprobantes; revisa si falta subir alguno o si el valor a mano esta inflado.
        </div>
      )}
    </div>
  );
};

// Estados de un servicio todavia abierto: el chofer mueve el viaje compacto entre estos; lo entrega terminando el viaje.
const OPEN_STATUSES = ["IN_SOSPESO", "IN_CONSEGNA", "RITIRATO"];
// Se puede reprogramar desde el formulario un servicio abierto y comun (sin viaje compacto ni traspaso entre choferes).
const canReprogramar = (record) => OPEN_STATUSES.includes(record.estado) && !record.compactado && !record.relevo && !record.origen;
const STATUS_LABEL = Object.fromEntries(RECORD_STATUS_OPTIONS.map((opt) => [opt.value, opt.label]));

const OPERATIONAL_FIELDS = [
  "estado",
  "horasDia",
  "horasNoche",
  "tiempoEspera",
  "comentarios",
  "kilometrosReales",
];

// Solo OWNER/ADMIN pueden tocar estos campos; el backend ya lo restringe igual
// (SELF_EDITABLE_FIELDS en record.service.js), esto es solo para no mandarlos si es CHOFER.
const OWNER_FIELDS = [
  "codigo",
  "clientId",
  "driverId",
  "vehicleId",
  "aplicativo",
  "extrasPiazzaZona",
  "stops",
  "descripcion",
  "ciudad",
  "kilometros",
  "precioKm",
  "areaC",
  "costoEspera",
  "costoTraforoFrejusBrennero",
  "peajes",
  "vignetta",
  "costoHotel",
  "costoOtros",
  "pagoRecibido",
  "costoCombustible",
  "clienteConfirmado",
];

const toFormState = (record) => ({
  estado: record.estado ?? "",
  // Datos de la reprogramacion (solo se usan si el estado pasa a Reprogramado, ver ReprogramacionPanel).
  reprog: emptyReprog(),
  horasDia: record.horasDia ?? "",
  horasNoche: record.horasNoche ?? "",
  tiempoEspera: record.tiempoEspera ?? "",
  comentarios: record.comentarios ?? "",
  kilometrosReales: record.kilometrosReales ?? "",
  codigo: record.codigo ?? "",
  clientId: record.client?.id ?? "",
  driverId: record.driver?.id ?? "",
  // Traspaso: otro chofer termino el servicio (ver Record.servicioOrigenId en el backend).
  otroChoferTermino: Boolean(record.relevo),
  choferRelevoId: record.relevo?.driverId ?? "",
  traspasoLugar: record.relevo?.lugar ?? "",
  cambioFurgon: Boolean(record.vehiculoFinal),
  vehiculoFinalId: record.vehiculoFinal?.id ?? "",
  vehicleId: record.vehicle?.id ?? "",
  salida: {
    direccion: record.salida?.direccion ?? "",
    lat: record.salida?.lat ?? null,
    lng: record.salida?.lng ?? null,
  },
  pasaPorBrennero: Boolean(record.pasaPorBrennero),
  pasaPorFrejus: Boolean(record.pasaPorFrejus),
  aplicativo: record.aplicativo ?? "",
  extrasPiazzaZona: record.extrasPiazzaZona ?? "",
  stops: record.stops?.length
    ? record.stops.map((s) => ({ direccion: s.direccion, cap: "", lat: null, lng: null }))
    : [{ direccion: "", cap: "", lat: null, lng: null }],
  descripcion: record.descripcion ?? "",
  ciudad: record.ciudad ?? "",
  // Las tres fechas van en hora de pared de Roma (el backend las interpreta asi): lo que escribe la
  // oficina es lo que se guarda. No entran en OWNER_FIELDS: se mandan solo si cambiaron (y "" en
  // fechaRetiro significa "borrar"), ver handleSave.
  eta: toRomeDateTimeInputValue(record.eta),
  fechaRetiro: toRomeDateTimeInputValue(record.fechaRetiro),
  retiroPaqueteAt: toRomeDateTimeInputValue(record.retiroPaqueteAt),
  kilometros: record.kilometros ?? "",
  precioKm: record.precioKm ?? "",
  areaC: record.areaC ?? "",
  costoEspera: record.costoEspera ?? "",
  costoTraforoFrejusBrennero: record.costoTraforoFrejusBrennero ?? "",
  // Lo que se escribio a mano (record.peajes es el efectivo: mancatos asignados o, si no hay, este valor).
  peajes: record.peajesManual ?? "",
  vignetta: record.vignetta ?? "",
  costoHotel: record.costoHotel ?? "",
  costoOtros: record.costoOtros ?? "",
  pagoRecibido: record.pagoRecibido ?? "",
  // Lo que se escribio a mano (record.costoCombustible es el efectivo: comprobantes o, si no hay,
  // este valor). Si se cargara el efectivo aca, al guardar se pisaria el valor a mano.
  costoCombustible: record.costoCombustibleManual ?? "",
  clienteConfirmado: record.clienteConfirmado ?? false,
});

// A que lista volver segun el tipo de servicio (tambien usado tras eliminar uno).
const backToSection = (record) =>
  record.spedizzione === "DHL" || record.spedizzione === "AB_SERVICE"
    ? "/records/dhl-ab-service"
    : record.spedizzione === "EXTRAS_STEFANIA"
      ? "/records/extras-stefania"
      : "/records/extras-piazza";

const TrashIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

// Mismos componentes de "total" que ya calcula el backend (ver computeTotals en
// record.service.js): costoCombustible y pagoRecibido quedan fuera a proposito - el
// pedido puntual de este texto es poder ver/pasar rapido cuanto cuesta el servicio
// SIN combustible (costo operativo real), no el total facturado.
const COST_BREAKDOWN_FIELDS = [
  ["areaC", "Area C"],
  ["costoEspera", "Espera"],
  ["costoTraforoFrejusBrennero", "Traforo Frejus/Brennero"],
  ["peajes", "Peajes"],
  ["vignetta", "Vignetta"],
  ["costoHotel", "Hotel"],
  ["costoOtros", "Otros"],
];

// DHL, DHL Roma y AB Service: los km que manda el cliente son de ida (se cuentan x2 y se pagan a la tarifa de DHL).
const isDhlAb = (record) => record.spedizzione === "DHL" || record.spedizzione === "AB_SERVICE";

// Peajes del servicio: los mancatos asignados si hay (mandan), si no lo cargado a mano. Nunca la suma de ambos.
const peajesText = (record) => {
  const d = record.peajesDetalle;
  if (!record.peajes) return "-";
  if (d?.fuente !== "MANCATOS") return formatCurrency(record.peajes);
  const n = d.mancatos.count;
  const manual = d.manual > 0 ? ` · a mano ${formatCurrency(d.manual)} (no cuenta)` : "";
  return `${formatCurrency(record.peajes)} · ${n} ${n === 1 ? "mancato" : "mancatos"}${manual}`;
};

const buildCostText = (record) => {
  const lines = [
    `Costos del servicio ${record.codigo}`,
    `${record.client?.nombre ?? "Sin cliente"} - ${record.destinazione}`,
    formatDateTime(record.fechaRetiro ?? record.eta),
    "",
  ];

  if (record.kilometros != null && record.precioKm != null) {
    lines.push(`Km (${record.kilometros} x ${formatCurrency(record.precioKm)}/km): ${formatCurrency(record.totalKm)}`);
  }
  COST_BREAKDOWN_FIELDS.forEach(([field, label]) => {
    if (record[field]) lines.push(`${label}: ${formatCurrency(record[field])}`);
  });

  lines.push("", `TOTAL sin combustible: ${formatCurrency(record.total)}`);
  lines.push("", `Combustible (no incluido en el total): ${formatCurrency(record.costoCombustible)}`);
  lines.push(`Monto recibido: ${formatCurrency(record.pagoRecibido)}`);

  return lines.join("\n");
};

const CopyIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </svg>
);

const PencilIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export const RecordDetailPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const isChofer = user?.cargo === "CHOFER";
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const { refresh: refreshRecords } = useDataRefresh("records");

  const [record, setRecord] = useState(null);
  const [files, setFiles] = useState([]);
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [drivers, setDrivers] = useState(null);
  const [vehicles, setVehicles] = useState(null);
  const [clients, setClients] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Cerrar el servicio vuelve a la pantalla desde la que se abrio (Dashboard, Pago a choferes, Mapa, una lista...); la lista de su seccion es solo
  // el respaldo si se abrio directo por la URL.
  const fallbackCloseTo = location.state?.from ?? (record ? backToSection(record) : "/records/extras-piazza");
  const closeDetail = useCloseOverlay(fallbackCloseTo);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showHours, setShowHours] = useState(false);
  const [showReprog, setShowReprog] = useState(false);
  const [reprogSaving, setReprogSaving] = useState(false);
  const [reprogErr, setReprogErr] = useState("");
  const [reprogDone, setReprogDone] = useState(null);

  // El aviso "Cambios guardados" se va solo.
  useEffect(() => {
    if (!saveSuccess || isEditing) return undefined;
    const timer = setTimeout(() => setSaveSuccess(false), 5000);
    return () => clearTimeout(timer);
  }, [saveSuccess, isEditing]);

  // Al pasar de la edicion a la vista del servicio (o al reves) el panel vuelve arriba, no queda a mitad de pagina.
  useEffect(() => {
    document.querySelector("[data-slideover-scroll]")?.scrollTo({ top: 0 });
  }, [isEditing]);

  const editarRef = useRef(false);
  useEffect(() => {
    editarRef.current = Boolean(location.state?.editar);
  }, [location.key, location.state]);

  const load = useCallback(() => {
    setLoadError("");
    setIsEditing(false);
    setShowReprog(false);
    setReprogDone(null);
    Promise.all([getRecordRequest(id), listRecordFilesRequest(id)])
      .then(([recordData, filesData]) => {
        setRecord(recordData);
        setForm(toFormState(recordData));
        setFiles(filesData);
        // Venir del aviso "Servicio reprogramado" (abrir el servicio nuevo para retocarlo): entra directo a editar.
        if (editarRef.current && !isChofer) {
          editarRef.current = false;
          setIsEditing(true);
        }
      })
      .catch((err) => setLoadError(parseApiError(err).message));
  }, [id, isChofer]);

  // Al pasar a otro servicio (por ejemplo del original al reprogramado) no queda a la vista el anterior mientras carga el nuevo.
  useEffect(() => {
    setRecord(null);
    setForm(null);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isChofer) return;
    Promise.all([listUsersRequest(), listVehiclesRequest(), listClientsRequest()])
      .then(([users, vehiclesData, clientsData]) => {
        setDrivers(users.filter((u) => u.estado === "ACTIVO"));
        setVehicles(vehiclesData);
        setClients(clientsData);
      })
      .catch((err) => setLoadError(parseApiError(err).message));
  }, [isChofer]);

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleCheckboxChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.checked }));

  // Datos a guardar segun lo escrito en el formulario. null si falta algo (el aviso ya quedo en saveError).
  const buildSavePayload = () => {
    const HOURS_TOTALS = ["horasDia", "horasNoche", "tiempoEspera"];
    const fieldsToSubmit = isChofer
      ? OPERATIONAL_FIELDS.filter((field) => !HOURS_TOTALS.includes(field))
      : [...OPERATIONAL_FIELDS, ...OWNER_FIELDS];

    const payload = Object.fromEntries(
      fieldsToSubmit
        .map((field) => [
          field,
          field === "stops" ? form.stops.map(combineStopAddress).filter(Boolean) : form[field],
        ])
        .filter(([, value]) => value !== "" && value !== undefined)
    );

    // Servicio de un viaje compacto: los km son los del viaje (no se mandan) y el estado solo si cambio.
    if (record.compactado) {
      delete payload.kilometrosReales;
      if (payload.estado === record.estado) delete payload.estado;
    }

    // Salida: solo si cambio respecto de lo guardado; vacia = vuelve al deposito.
    if (!isChofer) {
      const saved = record.salida;
      const next = form.salida;
      const changed =
        next.direccion.trim() !== (saved?.direccion ?? "") || next.lat !== (saved?.lat ?? null) || next.lng !== (saved?.lng ?? null);
      if (changed) payload.salida = buildSalidaPayload(next) ?? null;
      if (form.pasaPorBrennero !== Boolean(record.pasaPorBrennero)) payload.pasaPorBrennero = form.pasaPorBrennero;
      if (form.pasaPorFrejus !== Boolean(record.pasaPorFrejus)) payload.pasaPorFrejus = form.pasaPorFrejus;
    }

    // Cambio de furgon (el mismo chofer termino con otro furgon): solo si cambio respecto de lo guardado.
    if (!isChofer) {
      if (form.cambioFurgon && !form.vehiculoFinalId) {
        setSaveError("Selecciona el furgon con el que termino el servicio");
        return null;
      }
      const finalWanted = form.cambioFurgon ? form.vehiculoFinalId : null;
      if (finalWanted !== (record.vehiculoFinal?.id ?? null)) payload.vehiculoFinalId = finalWanted;
    }

    // Traspaso: solo si cambio respecto de lo guardado.
    if (!isChofer && !record.origen) {
      if (form.otroChoferTermino && !form.choferRelevoId) {
        setSaveError("Selecciona el chofer que termino el servicio");
        return null;
      }
      const wanted = form.otroChoferTermino ? form.choferRelevoId : null;
      if (wanted !== (record.relevo?.driverId ?? null)) payload.choferRelevoId = wanted;
      // Donde se paso el paquete: con eso se calcula el circuito (y las horas de manejo) de cada chofer.
      const lugar = form.traspasoLugar.trim();
      if (wanted && lugar !== (record.relevo?.lugar ?? "")) payload.traspasoLugar = lugar || null;
    }

    // Fecha retiro: solo la oficina; "" la borra, asi que se manda aunque este vacia (pero
    // solo si cambio, para no disparar re-evaluaciones de mancatos de balde).
    if (!isChofer && form.fechaRetiro !== toRomeDateTimeInputValue(record.fechaRetiro)) {
      payload.fechaRetiro = form.fechaRetiro;
    }
    if (!isChofer && form.retiroPaqueteAt !== toRomeDateTimeInputValue(record.retiroPaqueteAt)) {
      payload.retiroPaqueteAt = form.retiroPaqueteAt;
    }
    // ETA: igual, solo si cambio (reenviarlas sin tocar les borraria los segundos).
    if (!isChofer) {
      for (const field of ["eta"]) {
        if (form[field] && form[field] !== toRomeDateTimeInputValue(record[field])) payload[field] = form[field];
      }
    }
    return payload;
  };

  // Marcar el servicio como Reprogramado abre el panel de reprogramacion: se guarda con la confirmacion de abajo.
  const wantsReprogramar = !isChofer && form?.estado === "RISCHEDULATO" && record?.estado !== "RISCHEDULATO" && record && canReprogramar(record);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError("");
    setSaveSuccess(false);

    if (wantsReprogramar) {
      const missing = reprogError(form.reprog, record.kmFacturables);
      if (missing) {
        setSaveError(missing);
        return;
      }
      if (!buildSavePayload()) return;
      setReprogErr("");
      setShowReprog(true);
      return;
    }

    setSaving(true);
    const payload = buildSavePayload();
    if (!payload) {
      setSaving(false);
      return;
    }

    try {
      const updated = await updateRecordRequest(id, payload);
      setRecord(updated);
      setForm(toFormState(updated));
      // Guardado: sale de la edicion y vuelve a la vista de informacion del servicio (con el aviso de que se guardo).
      setIsEditing(false);
      setSaveSuccess(true);
      refreshRecords();
    } catch (err) {
      setSaveError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  // Confirmada la reprogramacion: primero se guardan los demas cambios del formulario (el servicio nuevo sale ya con ellos) y luego
  // se reprograma. El estado no se manda en el guardado: lo cambia la reprogramacion.
  const handleConfirmReprogramacion = async () => {
    setReprogSaving(true);
    setReprogErr("");
    try {
      // Solo se guarda antes lo que se haya cambiado en el formulario (la reprogramacion ya cambia el estado y los km): asi un
      // servicio que solo se reprograma no espera un guardado completo.
      const initial = toFormState(record);
      const rest = (f) => JSON.stringify({ ...f, estado: null, reprog: null });
      if (rest(form) !== rest(initial)) {
        const payload = buildSavePayload();
        if (!payload) return;
        delete payload.estado;
        if (Object.keys(payload).length > 0) await updateRecordRequest(id, payload);
      }
      const result = await reprogramarRecordRequest(id, buildReprogBody(form.reprog));
      setRecord(result.original);
      setForm(toFormState(result.original));
      setIsEditing(false);
      setSaveSuccess(false);
      setReprogDone(result);
      refreshRecords();
    } catch (err) {
      setReprogErr(parseApiError(err).message);
    } finally {
      setReprogSaving(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadError("");

    try {
      const newFile = await uploadRecordFileRequest(id, file, "FOTO_ENTREGA");
      setFiles((prev) => [newFile, ...prev]);
    } catch (err) {
      setUploadError(parseApiError(err).message);
    } finally {
      setUploading(false);
    }
  };

  const handleCancelEdit = () => {
    setForm(toFormState(record));
    setSaveError("");
    setSaveSuccess(false);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteRecordRequest(id);
      refreshRecords();
      closeDetail();
    } catch (err) {
      setDeleteError(parseApiError(err).message);
      setDeleting(false);
    }
  };

  if (loadError) {
    return (
      <SlideOverPanel closeTo={fallbackCloseTo}>
        <Alert>{loadError}</Alert>
      </SlideOverPanel>
    );
  }

  const dropdownsLoaded = isChofer || (drivers && vehicles && clients);

  if (!record || !form || !dropdownsLoaded) {
    return (
      <SlideOverPanel closeTo={fallbackCloseTo}>
        <PageLoader />
      </SlideOverPanel>
    );
  }

  const driverOptions = !isChofer
    ? drivers.map((d) => ({ value: d.id, label: `${d.nombre} ${d.apellido}` }))
    : [];
  const vehicleOptions = !isChofer
    ? vehicles.map((v) => ({ value: v.id, label: `${v.targa} - ${v.modelo}` }))
    : [];

  const backTo = fallbackCloseTo;

  return (
    <SlideOverPanel closeTo={backTo}>
    <div className="flex flex-col gap-6">
      <div>
        <BackLink to={backTo} className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
          &larr; Volver
        </BackLink>
      </div>

      {isEditing ? (
        <RecordEditForm
          record={record}
          form={form}
          isChofer={isChofer}
          driverOptions={driverOptions}
          vehicleOptions={vehicleOptions}
          clients={clients}
          setClients={setClients}
          saving={saving}
          saveError={saveError}
          saveSuccess={saveSuccess}
          reprogramar={wantsReprogramar}
          handleChange={handleChange}
          setField={setField}
          handleCheckboxChange={handleCheckboxChange}
          onSubmit={handleSave}
          onCancel={handleCancelEdit}
        />
      ) : (
        <RecordSummaryView
          record={record}
          files={files}
          isChofer={isChofer}
          isPrivileged={isPrivileged}
          isMine={isPrivileged && record.driver?.id === user?.id}
          onEdit={() => {
            setSaveSuccess(false);
            setIsEditing(true);
          }}
          saveSuccess={saveSuccess}
          onDeleteClick={() => {
            setDeleteError("");
            setShowDeleteConfirm(true);
          }}
          uploading={uploading}
          uploadError={uploadError}
          onUpload={handleUpload}
          onOpenHours={() => setShowHours(true)}
          onReload={load}
        />
      )}
    </div>

    {showHours && (
      <CerrarServicioModal
        record={record}
        onClose={() => setShowHours(false)}
        onDone={() => {
          load();
          refreshRecords();
        }}
      />
    )}

    <ReprogramacionModal
      open={showReprog || Boolean(reprogDone)}
      record={record}
      value={form.reprog}
      driverOptions={driverOptions}
      vehicleOptions={vehicleOptions}
      loading={reprogSaving}
      error={reprogErr}
      done={reprogDone}
      onConfirm={handleConfirmReprogramacion}
      onCancel={() => setShowReprog(false)}
      onClose={() => {
        setShowReprog(false);
        setReprogDone(null);
      }}
    />

    <ConfirmModal
      open={showDeleteConfirm}
      title="Eliminar servicio"
      description={`Esta accion no se puede deshacer. Se va a eliminar el servicio ${record.codigo} - ${record.destinazione}.`}
      confirmLabel="Eliminar"
      error={deleteError}
      loading={deleting}
      onConfirm={handleDelete}
      onCancel={() => setShowDeleteConfirm(false)}
    />
    </SlideOverPanel>
  );
};

// Vista de solo lectura: resumen del servicio + archivos. Es la vista por defecto al
// abrir un registro - el formulario de edicion (RecordEditForm) es una vista aparte,
// no un bloque que se despliega debajo de esta (ver isEditing en RecordDetailPage).
const RecordSummaryView = ({
  record,
  files,
  isChofer,
  isPrivileged,
  isMine,
  onEdit,
  onDeleteClick,
  uploading,
  uploadError,
  onUpload,
  onOpenHours,
  onReload,
  saveSuccess,
}) => {
  const [copyCostsFeedback, setCopyCostsFeedback] = useState("");
  const onCopyCosts = () => {
    navigator.clipboard
      .writeText(buildCostText(record))
      .then(() => {
        setCopyCostsFeedback("Copiado");
        setTimeout(() => setCopyCostsFeedback(""), 2000);
      })
      .catch(() => setCopyCostsFeedback("No se pudo copiar"));
  };

  return (
  <>
    {saveSuccess && (
      <div className="mb-4">
        <Alert variant="success">Cambios guardados correctamente.</Alert>
      </div>
    )}
    <GlassCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[13px] font-medium text-ink-400">{record.codigo}</span>
          <h1 className="mt-0.5 text-[22px] font-semibold text-ink-50">{record.destinazione}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={record.estado} />
          {/* El chofer no edita el servicio: sus horas y km se cargan con "Cargar horas" / "Terminar servicio". */}
          {!isChofer && (
            <button
              type="button"
              aria-label="Editar servicio"
              title="Editar servicio"
              onClick={onEdit}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full glass-surface-sm text-ink-300 transition-colors hover:bg-accent-500/15 hover:text-accent-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-500/20"
            >
              <PencilIcon className="h-[16px] w-[16px]" />
            </button>
          )}
          {isPrivileged && (
            <button
              type="button"
              aria-label="Eliminar servicio"
              title="Eliminar servicio"
              onClick={onDeleteClick}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full glass-surface-sm text-ink-300 transition-colors hover:bg-danger-500/15 hover:text-danger-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-danger-500/20"
            >
              <TrashIcon className="h-[17px] w-[17px]" />
            </button>
          )}
        </div>
      </div>

      <p className="mt-3 text-[15px] text-ink-200">{record.descripcion}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {record.retiroPaqueteAt && (
          <InfoRow label="Retiro del paquete" value={formatRomeDateTime(record.retiroPaqueteAt)} />
        )}
        <InfoRow
          label={record.retiroPaqueteAt ? "Salida a entregar" : "Salida / retiro"}
          value={record.fechaRetiro ? formatRomeDateTime(record.fechaRetiro) : "Sin cargar"}
        />
        <InfoRow label="ETA" value={formatRomeDateTime(record.eta)} />
        {record.salida?.direccion && <InfoRow label="Salida" value={record.salida.direccion} />}
        {(record.pasaPorBrennero || record.pasaPorFrejus) && (
          <InfoRow label="Ruta" value={[record.pasaPorBrennero && "Pasa por Brennero", record.pasaPorFrejus && "Pasa por Frejus"].filter(Boolean).join(" y ")} />
        )}
        <InfoRow
          label="Vehiculo"
          value={`${record.vehicle?.targa ?? "-"} - ${record.vehicle?.modelo ?? ""}`}
        />
        {record.vehiculoFinal && (
          <InfoRow
            label="Cambio de furgon"
            value={`Termino con ${record.vehiculoFinal.targa}${record.vehiculoFinal.modelo ? ` - ${record.vehiculoFinal.modelo}` : ""}`}
          />
        )}
        <InfoRow label="Cliente" value={record.client?.nombre} />
        {record.ciudad && <InfoRow label="Ciudad" value={record.ciudad} />}
        {record.extrasPiazzaZona && (
          <InfoRow label="Zona" value={ZONA_LABELS[record.extrasPiazzaZona]} />
        )}
        <InfoRow
          label="Chofer"
          value={`${record.driver?.nombre ?? ""} ${record.driver?.apellido ?? ""}`}
        />
        {record.ruta?.duracionMin != null && (
          <InfoRow
            label="Ruta estimada"
            value={`${record.ruta.distanciaKm.toFixed(1)} km - ${Math.round(record.ruta.duracionMin)} min`}
          />
        )}
      </div>

      <TraspasoOfService record={record} isChofer={isChofer} />
      <ReprogramacionOfService record={record} isChofer={isChofer} onChanged={onReload} />

      <MancatosOfService mancatos={record.mancatos} />

      <div className="mt-6 border-t border-line/10 pt-6">
        <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-ink-400">
          Kilometraje
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <InfoRow
            label={isDhlAb(record) ? "Km del cliente (ida) / facturables" : "Km planificados"}
            value={
              (isDhlAb(record) ? `${record.kilometros ?? "-"} → x2 = ${record.kmFacturables ?? "-"}` : (record.kilometros ?? "-")) +
              (record.compactado?.km
                ? ` (viaje: ${record.compactado.km.planificado})`
                : record.circuito?.km
                  ? ` (circuito: ${record.circuito.km})`
                  : "")
            }
          />
          <InfoRow
            label={record.compactado?.km ? "Km reales (de este servicio)" : "Km reales"}
            value={
              record.compactado?.km?.real != null
                ? `${record.kilometrosReales ?? "-"} (viaje: ${record.compactado.km.real})`
                : (record.kilometrosReales ?? "-")
            }
          />
          {!isChofer && (
            <InfoRow
              label="Diferencia"
              value={
                record.diferenciaKm != null
                  ? `${record.diferenciaKm > 0 ? "+" : ""}${record.diferenciaKm} km`
                  : "-"
              }
              tone={
                record.diferenciaKm > 0 ? "amber" : record.diferenciaKm < 0 ? "blue" : undefined
              }
            />
          )}
        </div>
      </div>

      <CircuitoDetalle circuito={record.circuito} recordId={record.id} recorridoEstado={record.recorridoEstado} className="mt-4 rounded-xl bg-line/[0.05] px-4 py-3" />

      <ViajeCompactoCard record={record} isChofer={isChofer} onChanged={onReload} />

      <JornadaOfService record={record} isChofer={isChofer || isMine} onOpenHours={onOpenHours} />

      <FaltantesCard record={record} onReload={onReload} />

      {!isChofer && (
        <div className="mt-6 border-t border-line/10 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-[13px] font-medium uppercase tracking-wide text-ink-400">
              Detalle economico
            </h3>
            <button
              type="button"
              onClick={onCopyCosts}
              className="flex items-center gap-1.5 rounded-full glass-surface-sm px-3 py-1.5 text-[12px] font-medium text-ink-200 transition-colors hover:bg-line/10"
            >
              <CopyIcon className="h-[14px] w-[14px]" />
              {copyCostsFeedback || "Copiar costos"}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <InfoRow label="Precio/km" value={record.precioKm ?? "-"} />
            <InfoRow label="Km x precio" value={record.totalKm != null ? formatCurrency(record.totalKm) : "-"} />
            <InfoRow label="Area C" value={record.areaC ? formatCurrency(record.areaC) : "-"} />
            <InfoRow label="Espera" value={record.costoEspera ? formatCurrency(record.costoEspera) : "-"} />
            <InfoRow
              label="Traforo Frejus/Brennero"
              value={record.costoTraforoFrejusBrennero ? formatCurrency(record.costoTraforoFrejusBrennero) : "-"}
            />
            <InfoRow label="Peajes" value={peajesText(record)} />
            <InfoRow label="Vignetta" value={record.vignetta ? formatCurrency(record.vignetta) : "-"} />
            <InfoRow label="Hotel" value={record.costoHotel ? formatCurrency(record.costoHotel) : "-"} />
            <InfoRow label="Otros" value={record.costoOtros ? formatCurrency(record.costoOtros) : "-"} />
            <InfoRow
              label="Total sin combustible"
              value={record.total != null ? formatCurrency(record.total) : "-"}
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-line/10 pt-4 sm:grid-cols-3">
            <FuelOfService record={record} />
            <InfoRow label="Monto recibido" value={record.pagoRecibido ? formatCurrency(record.pagoRecibido) : "-"} />
            <InfoRow
              label={`Esperado (${record.kmFacturables ?? 0} km x ${record.precioKm ?? "-"})`}
              value={record.facturacion?.esperado ? formatCurrency(record.facturacion.esperado) : "-"}
            />
            {record.facturacion?.diferencia != null && (
              <InfoRow
                label="Recibido menos esperado"
                value={`${record.facturacion.diferencia > 0 ? "+" : ""}${formatCurrency(record.facturacion.diferencia)}`}
                tone={Math.abs(record.facturacion.diferencia) < 0.5 ? undefined : record.facturacion.diferencia < 0 ? "amber" : "blue"}
              />
            )}
          </div>
        </div>
      )}
    </GlassCard>

    <GlassCard>
      <h2 className="text-[17px] font-medium text-ink-50">Archivos</h2>
      <p className="mt-1 text-[13px] text-ink-300">
        {isChofer
          ? "Sube tu foto de entrega para confirmar el servicio."
          : "Documentos y comprobantes cargados para este registro."}
      </p>

      <Alert>{uploadError}</Alert>

      {isChofer && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <CameraPickButton
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl glass-input px-4 py-3 text-[14px] font-medium text-ink-50 hover:bg-line/10"
            label="Tomar foto de entrega"
            onChange={onUpload}
            disabled={uploading}
          />
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl glass-input px-4 py-3 text-[14px] font-medium text-ink-50 hover:bg-line/10">
            {uploading ? <Spinner /> : "Elegir foto o archivo"}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={onUpload}
              disabled={uploading}
            />
          </label>
        </div>
      )}

      <p className="mt-2 text-[12px] text-ink-400">
        Las fotos de comprobante se borran solas pasados 3 meses desde que se suben.
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {files.length === 0 && (
          <li className="text-[14px] text-ink-400">Todavia no hay archivos cargados.</li>
        )}
        {files.map((file) => (
          <li key={file.id}>
            <a
              href={file.archivoUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-xl glass-surface-sm px-4 py-3 text-[14px] text-ink-50 hover:bg-line/10"
            >
              <span>{TIPO_ARCHIVO_LABELS[file.tipoArchivo] ?? file.tipoArchivo}</span>
              <span className="text-[12px] text-ink-400">{formatDateTime(file.createdAt)}</span>
            </a>
          </li>
        ))}
      </ul>
    </GlassCard>
  </>
  );
};

// Vista de edicion, aparte de RecordSummaryView (ver comentario ahi) - se muestra en
// vez del resumen mientras isEditing es true, nunca junto a el.
const RecordEditForm = ({
  record,
  form,
  isChofer,
  driverOptions,
  vehicleOptions,
  clients,
  setClients,
  saving,
  saveError,
  saveSuccess,
  reprogramar,
  handleChange,
  setField,
  handleCheckboxChange,
  onSubmit,
  onCancel,
}) => {
  const isDhlAb = record.spedizzione === "DHL" || record.spedizzione === "AB_SERVICE";
  // Extras Stefania es el unico tipo sin Zona (Extras Piazza y DHL/AB Service si la
  // usan, ver ZONA_OPTIONS mas abajo - DHL empezo a operar tambien en Roma).
  const isExtrasStefania = record.spedizzione === "EXTRAS_STEFANIA";

  // Mismo criterio que NewDhlAbServiceRecordPage.jsx: el Aplicativo se acota a la zona
  // elegida (MILANO_1..18 o ROMA_1..10), y cambiar de zona limpia un aplicativo que ya
  // no corresponde.
  const aplicativoOptions = APLICATIVO_OPTIONS.filter((opt) =>
    opt.value.startsWith(`${form.extrasPiazzaZona}_`)
  );
  const handleChangeZona = (zona) => {
    setField("extrasPiazzaZona", zona);
    if (form.aplicativo && !form.aplicativo.startsWith(`${zona}_`)) setField("aplicativo", "");
  };

  return (
    <GlassCard>
      <h2 className="text-[17px] font-medium text-ink-50">
        {isChofer ? "Cargar datos de mi viaje" : "Editar servicio"}
      </h2>
      <p className="mt-1 text-[13px] text-ink-300">
        {isChofer
          ? record.compactado
            ? "Estado y comentarios del servicio. Tus horas y los km del viaje se cargan con el boton Cargar horas."
            : "Kilometros reales y comentarios del servicio. Tus horas se cargan con el boton Cargar horas."
          : "Modifica cualquier dato del servicio, incluidos los planificados y economicos."}
      </p>

      <form className="mt-6 flex flex-col gap-5" onSubmit={onSubmit}>
        {saveSuccess && <Alert variant="success">Cambios guardados correctamente.</Alert>}
        <Alert>{saveError}</Alert>

        {isChofer && record.compactado && !OPEN_STATUSES.includes(record.estado) ? (
          <p className="text-[13px] text-ink-300">
            Estado: <b className="text-ink-50">{STATUS_LABEL[record.estado] ?? record.estado}</b>. Los servicios de un
            viaje se entregan todos juntos al terminar el viaje.
          </p>
        ) : (
          <div>
            <SearchableSelect
              id="estado"
              label="Estado"
              placeholder="Escribe para buscar un estado"
              options={
                isChofer && record.compactado
                  ? RECORD_STATUS_OPTIONS.filter((opt) => OPEN_STATUSES.includes(opt.value))
                  : RECORD_STATUS_OPTIONS
              }
              maxSuggestions={RECORD_STATUS_OPTIONS.length}
              value={form.estado}
              onChange={(v) => setField("estado", v)}
            />
            {isChofer && record.compactado && (
              <p className="mt-1.5 text-[12px] text-ink-400">
                Cambia el estado de todo el viaje. Para entregarlo usa «Terminar viaje».
              </p>
            )}
          </div>
        )}

        {reprogramar && (
          <ReprogramacionPanel
            record={record}
            value={form.reprog}
            onChange={(v) => setField("reprog", v)}
            driverOptions={driverOptions}
            vehicleOptions={vehicleOptions}
            disabled={saving}
          />
        )}

        {!isChofer && (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <TextField
                id="codigo"
                label="Codigo"
                value={form.codigo}
                onChange={handleChange("codigo")}
              />
              <ClientAutocomplete
                id="clientId"
                label="Cliente"
                clients={clients}
                value={form.clientId}
                onChange={(clientId) => setField("clientId", clientId)}
                onClientCreated={(client) => setClients((prev) => [...prev, client])}
              />
              <div className="flex flex-col gap-3">
                <SearchableSelect
                  id="driverId"
                  label="Chofer"
                  placeholder="Escribe para buscar un chofer"
                  options={driverOptions}
                  value={form.driverId}
                  onChange={(v) => setField("driverId", v)}
                />
                {record.origen ? (
                  <p className="text-[12px] text-ink-400">
                    Servicio recibido de{" "}
                    {record.origen.chofer ? `${record.origen.chofer.nombre} ${record.origen.chofer.apellido}` : "otro chofer"}{" "}
                    (continuacion de {record.origen.codigo}).
                  </p>
                ) : (
                  <>
                    <label className="flex w-fit items-center gap-2 text-[14px] text-ink-200">
                      <input
                        type="checkbox"
                        checked={form.otroChoferTermino}
                        onChange={(e) => {
                          setField("otroChoferTermino", e.target.checked);
                          if (!e.target.checked) setField("choferRelevoId", "");
                        }}
                        className="h-4 w-4 rounded border-line/20 bg-transparent accent-accent-500"
                      />
                      ¿Otro chofer termino el servicio?
                    </label>
                    {form.otroChoferTermino && (
                      <div>
                        <SearchableSelect
                          id="choferRelevoId"
                          label="Chofer que termino el servicio"
                          placeholder="Escribe para buscar un chofer"
                          options={driverOptions.filter((o) => o.value !== form.driverId)}
                          value={form.choferRelevoId}
                          onChange={(v) => setField("choferRelevoId", v)}
                        />
                        <p className="mt-1.5 text-[12px] text-ink-400">
                          Al guardar, a ese chofer le llega un aviso con el lugar donde recoger el paquete.
                        </p>
                        <div className="mt-3">
                          <TextField
                            id="traspasoLugar"
                            label="Lugar del traspaso"
                            placeholder="Ciudad o direccion donde se paso el paquete (ej: Firenze)"
                            value={form.traspasoLugar}
                            onChange={handleChange("traspasoLugar")}
                          />
                          <p className="mt-1.5 text-[12px] text-ink-400">
                            Con el lugar se calcula el circuito de cada chofer desde la base de su zona. Sin el, ninguno
                            de los dos tiene km para el pago.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <SearchableSelect
                  id="vehicleId"
                  label="Vehiculo"
                  placeholder="Escribe para buscar un vehiculo"
                  options={vehicleOptions}
                  value={form.vehicleId}
                  onChange={(v) => setField("vehicleId", v)}
                />
                <label className="flex w-fit items-center gap-2 text-[14px] text-ink-200">
                  <input
                    type="checkbox"
                    checked={form.cambioFurgon}
                    onChange={(e) => {
                      setField("cambioFurgon", e.target.checked);
                      if (!e.target.checked) setField("vehiculoFinalId", "");
                    }}
                    className="h-4 w-4 rounded border-line/20 bg-transparent accent-accent-500"
                  />
                  ¿Cambio de furgon para terminar el servicio?
                </label>
                {form.cambioFurgon && (
                  <div>
                    <SearchableSelect
                      id="vehiculoFinalId"
                      label="Furgon con el que termino el servicio"
                      placeholder="Escribe para buscar un vehiculo"
                      options={vehicleOptions.filter((o) => o.value !== form.vehicleId)}
                      value={form.vehiculoFinalId}
                      onChange={(v) => setField("vehiculoFinalId", v)}
                    />
                    <p className="mt-1.5 text-[12px] text-ink-400">
                      Queda registrado con que furgon se termino. El chofer y el pago no cambian, y los peajes y el combustible de los
                      dos furgones se asignan a este servicio.
                    </p>
                  </div>
                )}
              </div>
              {!isExtrasStefania && (
                <SearchableSelect
                  id="extrasPiazzaZona"
                  label="Zona"
                  placeholder="Escribe para buscar una zona"
                  options={ZONA_OPTIONS}
                  value={form.extrasPiazzaZona}
                  onChange={handleChangeZona}
                />
              )}
              {isDhlAb && (
                <SearchableSelect
                  id="aplicativo"
                  label="Numero de aplicativo"
                  placeholder="Escribe para buscar un aplicativo"
                  options={aplicativoOptions}
                  value={form.aplicativo}
                  onChange={(v) => setField("aplicativo", v)}
                />
              )}
              <TextField
                id="ciudad"
                label="Ciudad"
                value={form.ciudad}
                onChange={handleChange("ciudad")}
              />
              <div>
                <TextField
                  id="fechaRetiro"
                  label="Fecha retiro"
                  type="datetime-local"
                  value={form.fechaRetiro}
                  onChange={handleChange("fechaRetiro")}
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
              />
              <TextField
                id="eta"
                label="ETA"
                type="datetime-local"
                value={form.eta}
                onChange={handleChange("eta")}
              />
            </div>

            <FechasAviso
              fechas={form}
              original={{
                eta: toRomeDateTimeInputValue(record.eta),
              }}
            />

            <StopListEditor
              stops={form.stops}
              onChange={(stops) => setField("stops", stops)}
              salida={form.salida}
              onSalidaChange={(salida) => setField("salida", salida)}
              pasaPorBrennero={form.pasaPorBrennero}
              onPasaPorBrenneroChange={(value) => setField("pasaPorBrennero", value)}
              pasaPorFrejus={form.pasaPorFrejus}
              onPasaPorFrejusChange={(value) => setField("pasaPorFrejus", value)}
              sugerencias={destinoSugerencias(record.spedizzione, record.extrasPiazzaZona)}
              salidaPorDefecto={salidaPorDefectoLabel(record.spedizzione, record.extrasPiazzaZona)}
              disabled={saving}
            />

            <Textarea
              id="descripcion"
              label="Descripcion"
              value={form.descripcion}
              onChange={handleChange("descripcion")}
            />
          </>
        )}

        {record.compactado ? (
          <div className="rounded-xl bg-accent-500/10 px-4 py-3 text-[13px] text-ink-200">
            <b className="text-accent-300">Km reales del viaje compacto.</b>{" "}
            {record.kilometrosReales != null ? `Este servicio: ${record.kilometrosReales} km (viaje: ${record.compactado.km?.real ?? "-"} km). ` : ""}
            {isChofer
              ? `Los km se cargan para todo el viaje, junto con tus horas (en ${record.compactado.principalCodigo}): el sistema los reparte entre los servicios.`
              : "Los km se reparten entre los servicios del viaje: usa «Ajustar reparto de km» en la tarjeta del viaje."}
          </div>
        ) : (
          <TextField
            id="kilometrosReales"
            label={`Kilometros reales${record.kilometros != null ? ` (planificado: ${record.kilometros} km)` : ""}`}
            type="number"
            step="0.1"
            min="0"
            placeholder="Kilometros recorridos"
            value={form.kilometrosReales}
            onChange={handleChange("kilometrosReales")}
          />
        )}

        {!isChofer && (
        <div>
        <p className="mb-2 text-[12px] text-ink-400">
          Horas a mano: si cambias estos totales quedan aprobadas. Lo normal es que el chofer las cargue y
          se aprueben en Finanzas &gt; Horas.
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <TextField
            id="horasDia"
            label="Horas dia"
            type="number"
            step="0.5"
            min="0"
            value={form.horasDia}
            onChange={handleChange("horasDia")}
          />
          <TextField
            id="horasNoche"
            label="Horas noche"
            type="number"
            step="0.5"
            min="0"
            value={form.horasNoche}
            onChange={handleChange("horasNoche")}
          />
          <TextField
            id="tiempoEspera"
            label="Tiempo de espera (h)"
            type="number"
            step="0.5"
            min="0"
            value={form.tiempoEspera}
            onChange={handleChange("tiempoEspera")}
          />
        </div>
        </div>
        )}

        <Textarea
          id="comentarios"
          label="Comentarios"
          placeholder="Notas sobre el servicio..."
          value={form.comentarios}
          onChange={handleChange("comentarios")}
        />

        {!isChofer && (
          <div className="border-t border-line/10 pt-5">
            <h3 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-ink-400">
              Datos economicos
            </h3>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <TextField
                id="kilometros"
                label={isDhlAb ? "Km del cliente (solo ida, se cuentan x2)" : "Kilometros planificados"}
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
              <div>
                <TextField
                  id="peajes"
                  label={record.peajesDetalle?.fuente === "MANCATOS" ? "Peajes (a mano)" : "Peajes"}
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.peajes}
                  onChange={handleChange("peajes")}
                />
                {record.peajesDetalle?.fuente === "MANCATOS" && (
                  <p className="mt-1.5 text-[12px] text-ink-400">
                    Hay {record.peajesDetalle.mancatos.count} {record.peajesDetalle.mancatos.count === 1 ? "mancato asignado" : "mancatos asignados"}{" "}
                    que suman {formatCurrency(record.peajesDetalle.mancatos.total)}: ese valor es el que cuenta en las finanzas; este
                    campo solo vale si no hay mancatos.
                  </p>
                )}
              </div>
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

            <label className="mt-5 flex w-fit items-center gap-2 text-[14px] text-ink-200">
              <input
                type="checkbox"
                checked={form.clienteConfirmado}
                onChange={handleCheckboxChange("clienteConfirmado")}
                className="h-4 w-4 rounded border-line/20 bg-transparent accent-accent-500"
              />
              Cliente confirmado
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={saving} className="sm:w-auto sm:px-8">
            Guardar cambios
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={saving}
            className="sm:w-auto sm:px-8"
          >
            Cancelar
          </Button>
        </div>
      </form>
    </GlassCard>
  );
};

const TONE_CLASSES = {
  amber: "text-status-rischedulato",
  blue: "text-accent-300",
};

const InfoRow = ({ label, value, tone }) => (
  <div className="glass-surface-sm rounded-xl px-4 py-3">
    <span className="block text-[12px] uppercase tracking-wide text-ink-400">{label}</span>
    <span className={`mt-0.5 block text-[15px] ${TONE_CLASSES[tone] ?? "text-ink-50"}`}>
      {value || "-"}
    </span>
  </div>
);
