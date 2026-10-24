import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CloseIcon, SEVERITY_DOT_CLASSES, SEVERITY_ITEM_CLASSES } from "../../components/layout/NotificationsBell";
import { Alert } from "../../components/ui/Alert";
import { AsignarServicioFuturoModal } from "../../components/ui/AsignarServicioFuturoModal";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { PageLoader } from "../../components/ui/PageLoader";
import { ProgressRing } from "../../components/ui/ProgressRing";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { TextField } from "../../components/ui/TextField";
import { ServicesTrendChart } from "../../components/charts/ServicesTrendChart";
import { ServicesWeekBarChart } from "../../components/charts/ServicesWeekBarChart";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationsContext";
import { parseApiError } from "../../lib/api";
import {
  computeDriverStats,
  computeEconomicStats,
  computeExtrasPiazzaZonaBreakdown,
  computeReperibilidadPiazza,
  computeServicePeriodStats,
  computeVehicleStats,
  computeWeeklyServiceTrend,
  filterToPiazzaYDhlRoma,
  isReperibilidadNoDisponibleHoy,
} from "../../lib/dashboardStats";
import { RECORD_STATUS_LABELS } from "../../lib/constants";
import { formatCurrency, formatDate, formatDateTime } from "../../lib/format";
import { getKmRankingRequest } from "../../lib/finanzas.api";
import { listRecordsRequest, searchRecordsRequest } from "../../lib/records.api";
import { listUsersRequest, updateUserRequest } from "../../lib/users.api";
import { listVehiclesRequest } from "../../lib/vehicles.api";

const DISPONIBLE_OPTIONS = [
  { value: "SI", label: "Si" },
  { value: "NO", label: "No" },
];

// Filtro de zona de la pestana Semanal (rentabilidad, ranking de choferes/vehiculos) -
// "Todos" por defecto para no cambiar lo que ya se ve hoy (Milano+Roma mezclado).
// Areas que cuentan en esta pantalla (ver filterToPiazzaYDhlRoma).
const RANKING_AREAS = ["piazza-milano", "piazza-roma", "dhl-roma"];

const SEMANAL_ZONA_OPTIONS = [
  { value: "TODOS", label: "Todos" },
  { value: "MILANO", label: "Milano" },
  { value: "ROMA", label: "Roma" },
];

// Choferes/vehiculos no tienen extrasPiazzaZona (eso es del Record) - se usan de grupo
// (MILANO_NORD/MILANO_SUD/ROMA, el mismo campo que ya separa Reperibilita) para saber
// si entran en el filtro de zona de Semanal.
const grupoMatchesZona = (grupo, zona) => {
  if (zona === "TODOS") return true;
  if (zona === "MILANO") return grupo === "MILANO_NORD" || grupo === "MILANO_SUD";
  return grupo === "ROMA";
};

// Misma fuente que useNotifications (ver dashboardStats.js): cada alerta arma su id con
// un prefijo por tipo de origen. Se usa solo para agrupar visualmente aca, no cambia la
// logica de que alertas existen (esa sigue siendo la unica fuente de verdad).
const CATEGORY_RULES = [
  { prefix: "driver-doc-", label: "Documentos de choferes" },
  { prefix: "vehicle-poliza-", label: "Documentos de vehiculos" },
  { prefix: "vehicle-rtecnica-", label: "Documentos de vehiculos" },
  { prefix: "vehicle-tagliando-", label: "Mantenimiento (Tagliando)" },
  { prefix: "location-permission-", label: "Ubicacion GPS" },
  { prefix: "birthday-", label: "Cumpleanios" },
  { prefix: "overdue-", label: "Servicios vencidos" },
  { prefix: "maintenance-", label: "Vehiculo en mantenimiento" },
  { prefix: "evidence-", label: "Evidencia faltante" },
  { prefix: "appsheet-sync-", label: "Sincronizacion con AppSheet" },
];
const OTHER_LABEL = "Otros";
const CATEGORY_ORDER = [...CATEGORY_RULES.map((r) => r.label), OTHER_LABEL].filter(
  (label, idx, arr) => arr.indexOf(label) === idx
);

const categoryFor = (alert) => CATEGORY_RULES.find((r) => alert.id.startsWith(r.prefix))?.label ?? OTHER_LABEL;

const groupAlerts = (alerts) => {
  const byLabel = new Map();
  alerts.forEach((alert) => {
    const label = categoryFor(alert);
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label).push(alert);
  });
  return CATEGORY_ORDER.map((label) => ({ label, items: byLabel.get(label) ?? [] })).filter(
    (group) => group.items.length > 0
  );
};

const todayLabel = () =>
  new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

// Mismo formato que el value crudo de un <input type="date"> ("yyyy-mm-dd", hora local
// del navegador) - para comparar sin pasar por Date/UTC.
const todayDateInputValue = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const TAB_OPTIONS = [
  { value: "general", label: "General" },
  { value: "diario", label: "Diario" },
  { value: "semanal", label: "Semanal" },
  { value: "reperibilidad", label: "Reperibilita" },
];

// Mismo criterio que driverName en RecordsListPage.jsx (version local, esta pagina no
// importa de ahi para no acoplar los dos archivos).
const driverName = (record) =>
  record.driver ? `${record.driver.nombre} ${record.driver.apellido}` : "Sin chofer";

const fmtKm = (km) => Math.round(km).toLocaleString("es-AR");

// Bloque de texto de una zona para el "Copiar como texto" de Reperibilita - describe
// cada servicio/chofer/vehiculo en una oracion natural, como si un coordinador se lo
// explicara de palabra a otra persona, en vez de filas tecnicas separadas por "|" -
// pedido explicito: este texto lo termina leyendo el jefe, no alguien mirando la
// base de datos, y las filas tecnicas eran ilegibles para el.
const buildZoneBlock = (label, servicios, choferesDisp, vehiculosDisp) => {
  const lines = [label, ""];

  if (servicios.length === 0) {
    lines.push("No hay servicios pendientes por ahora.");
  } else {
    lines.push(servicios.length === 1 ? "Hay 1 servicio pendiente:" : `Hay ${servicios.length} servicios pendientes:`);
    servicios.forEach((r, idx) => {
      const vehiculo = r.vehicle?.targa ? `con la ${r.vehicle.targa}` : "todavia sin vehiculo asignado";
      const cliente = r.client?.nombre ? ` para ${r.client.nombre}` : "";
      const estado = (RECORD_STATUS_LABELS[r.estado] ?? r.estado).toLowerCase();
      let frase = `${idx + 1}. ${driverName(r)} (${vehiculo}) va a ${r.destinazione}${cliente} - esta ${estado}, llega aprox a las ${formatDateTime(r.eta)}.`;
      if (r.comentarios) frase += ` Nota: ${r.comentarios}`;
      lines.push(frase);
    });
  }

  lines.push("");
  if (choferesDisp.length === 0) {
    lines.push("No hay choferes disponibles esta noche.");
  } else {
    const nombres = choferesDisp.map((u) => {
      const vehiculo = u.vehiculoAsignado
        ? `con la ${u.vehiculoAsignado.targa}${u.vehiculoAsignado.modelo ? ` (${u.vehiculoAsignado.modelo})` : ""}`
        : "sin vehiculo asignado todavia";
      return `${u.nombre} ${u.apellido} (${vehiculo})`;
    });
    const plural = choferesDisp.length === 1;
    lines.push(
      `Esta noche ${plural ? "esta disponible" : "estan disponibles"} ${choferesDisp.length} chofer${plural ? "" : "es"}: ${nombres.join(", ")}.`
    );
  }

  lines.push("");
  if (vehiculosDisp.length === 0) {
    lines.push("No hay vehiculos libres.");
  } else {
    const nombresVehiculos = vehiculosDisp.map((v) => `${v.targa}${v.modelo ? ` (${v.modelo})` : ""}`);
    lines.push(`Vehiculos libres: ${nombresVehiculos.join(", ")}.`);
  }

  return lines;
};

// Ranking de choferes o vehiculos por KM esta semana (getKmRankingRequest), mas quien de la lista activa no aparece en el ranking - no
// tuvo ningun servicio esta semana.
const RankingCard = ({ title, subtitle, entries, emptyLabel, inactiveLabel, inactiveNames }) => (
  <GlassCard>
    <h2 className="text-[15px] font-semibold text-ink-50">{title}</h2>
    <p className="mt-1 text-[12px] text-ink-400">{subtitle}</p>

    {entries.length === 0 ? (
      <p className="mt-3 text-[13px] text-ink-300">{emptyLabel}</p>
    ) : (
      <ul className="mt-3 flex flex-col gap-1.5">
        {entries.map((entry, idx) => (
          <li
            key={entry.id}
            className="flex items-center gap-3 rounded-xl glass-surface-sm px-3 py-2 text-[13px]"
          >
            <span className="w-4 shrink-0 text-center text-[12px] font-medium text-ink-400">{idx + 1}</span>
            <span className="min-w-0 flex-1 truncate text-ink-50">{entry.nombre}</span>
            <span className="shrink-0 text-[12px] text-ink-300">
              {fmtKm(entry.km)} km &middot; {entry.servicios} serv.
            </span>
          </li>
        ))}
      </ul>
    )}

    {inactiveNames.length > 0 && (
      <div className="mt-3 rounded-xl border border-status-rischedulato/25 bg-status-rischedulato/5 px-3 py-2.5">
        <p className="text-[12px] font-medium text-status-rischedulato">{inactiveLabel}</p>
        <p className="mt-1 text-[12px] text-ink-300">{inactiveNames.join(", ")}</p>
      </div>
    )}
  </GlassCard>
);

// Tabla de "Servicios pendientes" (Reperibilita > Extras Piazza) - se reusa tal cual
// para el desglose por zona (Milano/Roma) que se agrega debajo del listado general,
// asi no se duplica el markup de la tabla 3 veces.
const PendingServicesCard = ({ title, subtitle, items, emptyLabel }) => (
  <GlassCard>
    <h2 className="text-[15px] font-semibold text-ink-50">{title}</h2>
    <p className="mt-1 text-[12px] text-ink-400">{subtitle}</p>

    {items.length === 0 ? (
      <p className="mt-3 text-[13px] text-ink-300">{emptyLabel}</p>
    ) : (
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-ink-500">
              <th className="pb-2 pr-3 font-medium">Chofer</th>
              <th className="pb-2 pr-3 font-medium">Vehiculo</th>
              <th className="pb-2 pr-3 font-medium">Cliente</th>
              <th className="pb-2 pr-3 font-medium">Lugar</th>
              <th className="pb-2 pr-3 font-medium">Estado</th>
              <th className="pb-2 pr-3 font-medium">ETA</th>
              <th className="pb-2 font-medium">Comentarios</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t border-line/10">
                <td className="py-2 pr-3">
                  <Link to={`/records/${r.id}`} className="text-ink-50 hover:underline">
                    {driverName(r)}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-ink-300">{r.vehicle?.targa ?? "-"}</td>
                <td className="py-2 pr-3 text-ink-300">{r.client?.nombre ?? "-"}</td>
                <td className="py-2 pr-3 text-ink-300">{r.destinazione}</td>
                <td className="py-2 pr-3">
                  <StatusBadge status={r.estado} className="px-2 py-0.5 text-[11px]" />
                </td>
                <td className="py-2 pr-3 text-ink-300">{formatDateTime(r.eta)}</td>
                <td className="py-2 text-ink-300">{r.comentarios || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </GlassCard>
);

// Tabla de "Choferes disponibles esta noche" - se reusa para el desglose por zona
// (Milano/Roma) igual que PendingServicesCard arriba, mismo motivo (no duplicar el
// markup 3 veces).
const AvailableDriversCard = ({
  title,
  subtitle,
  drivers,
  emptyLabel,
  vehicleOptions,
  savingDriverField,
  driverFieldErrors,
  servicioActualPorChofer,
  onChangeDisponible,
  onChangeVehiculo,
}) => (
  <GlassCard>
    <h2 className="text-[15px] font-semibold text-ink-50">{title}</h2>
    <p className="mt-1 text-[12px] text-ink-400">{subtitle}</p>

    {drivers.length === 0 ? (
      <p className="mt-3 text-[13px] text-ink-300">{emptyLabel}</p>
    ) : (
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center gap-3 px-3 text-[11px] uppercase tracking-wide text-ink-500">
          <span className="min-w-0 flex-1">Chofer</span>
          <span className="w-20 shrink-0">Disponible</span>
          <span className="w-52 shrink-0">Vehiculo</span>
        </div>
        {drivers.map((u) => {
          const disponible = !isReperibilidadNoDisponibleHoy(u);
          const servicioActual = servicioActualPorChofer[u.id];
          return (
            <div key={u.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-3 rounded-xl glass-surface-sm px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-50">
                  {u.nombre} {u.apellido}
                </span>
                <Select
                  id={`disponible-${u.id}`}
                  className="w-20 px-2.5 py-1.5 pr-7 text-[12px]"
                  options={DISPONIBLE_OPTIONS}
                  value={disponible ? "SI" : "NO"}
                  disabled={Boolean(savingDriverField[`${u.id}:reperibilidadNoDisponible`])}
                  onChange={(e) => onChangeDisponible(u.id)(e.target.value)}
                />
                <Select
                  id={`vehiculo-${u.id}`}
                  className="w-52 px-2.5 py-1.5 pr-7 text-[12px]"
                  options={vehicleOptions}
                  value={u.vehiculoAsignadoId ?? ""}
                  disabled={Boolean(savingDriverField[`${u.id}:vehiculoAsignadoId`])}
                  onChange={(e) => onChangeVehiculo(u.id)(e.target.value)}
                />
              </div>
              {servicioActual && (
                <Link
                  to={`/records/${servicioActual.id}`}
                  className="px-3 text-[12px] text-ink-400 hover:text-ink-200 hover:underline"
                >
                  {RECORD_STATUS_LABELS[servicioActual.estado] ?? servicioActual.estado} a{" "}
                  {servicioActual.destinazione} &middot; ETA {formatDateTime(servicioActual.eta)}
                </Link>
              )}
              {driverFieldErrors[u.id] && (
                <span className="px-3 text-[12px] text-danger-500">{driverFieldErrors[u.id]}</span>
              )}
            </div>
          );
        })}
      </div>
    )}
  </GlassCard>
);

// Lista de "Vehiculos disponibles" - se reusa para el desglose por zona (Milano/Roma),
// mismo motivo que PendingServicesCard/AvailableDriversCard arriba.
const AvailableVehiclesCard = ({ title, subtitle, vehicles, emptyLabel }) => (
  <GlassCard>
    <h2 className="text-[15px] font-semibold text-ink-50">{title}</h2>
    <p className="mt-1 text-[12px] text-ink-400">{subtitle}</p>
    {vehicles.length === 0 ? (
      <p className="mt-3 text-[13px] text-ink-300">{emptyLabel}</p>
    ) : (
      <ul className="mt-3 flex flex-col gap-1.5">
        {vehicles.map((v) => (
          <li key={v.id} className="rounded-xl glass-surface-sm px-3 py-2 text-[13px] text-ink-50">
            {v.targa}
            {v.modelo ? ` - ${v.modelo}` : ""}
          </li>
        ))}
      </ul>
    )}
  </GlassCard>
);

// Mismo patron que RankedList de OwnerDashboardPage (servicios mas rentables / con
// perdidas), version chica local para no acoplar esta pagina con esa.
const ProfitLossList = ({ title, items, tone }) => (
  <div>
    <h3 className="mb-2 text-[13px] font-medium uppercase tracking-wide text-ink-400">{title}</h3>
    {items.length === 0 ? (
      <p className="text-[13px] text-ink-300">Sin datos esta semana.</p>
    ) : (
      <ul className="flex flex-col gap-2">
        {items.map(({ record, profit }) => (
          <li key={record.id}>
            <Link
              to={`/records/${record.id}`}
              className="flex items-center justify-between gap-3 rounded-xl glass-surface-sm px-4 py-2.5 text-[13px] hover:bg-line/10"
            >
              <span className="min-w-0 truncate text-ink-50">
                {record.codigo} - {record.destinazione}
              </span>
              <span className={clsx("shrink-0", tone === "green" ? "text-success-500" : "text-danger-500")}>
                {formatCurrency(profit)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export const DailySummaryPage = () => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const { alerts, loading, dismiss } = useNotifications();
  const groups = useMemo(() => groupAlerts(alerts), [alerts]);
  // Filtro de zona del Diario (solo OWNER/ADMIN - el chofer no ve este switch, sus
  // alertas son personales y no llevan grupo). Alertas sin grupo (cumpleanios,
  // servicios vencidos, fallos de sync) se muestran siempre: no son de un chofer/
  // vehiculo puntual, no hay zona que filtrar.
  const [diarioZona, setDiarioZona] = useState("TODOS");
  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          items: group.items.filter((a) => a.grupo == null || grupoMatchesZona(a.grupo, diarioZona)),
        }))
        .filter((group) => group.items.length > 0),
    [groups, diarioZona]
  );

  const [tab, setTab] = useState(isPrivileged ? "general" : "diario");

  // Pestanias "General" y "Semanal" (solo OWNER/ADMIN) comparten estos 3 fetches: se
  // cargan recien la primera vez que se entra a cualquiera de las dos, no en cada
  // visita a "Resumen diario", y no se repiten al alternar entre General y Semanal.
  // drivers/vehicles se guardan sin filtrar por estado: computeDriverStats/
  // computeVehicleStats (pestania General) necesitan el universo completo para sus
  // propios conteos (activos, disponibles, etc.) - el filtro de "activo"/"en
  // servicio" que solo necesita la pestania Semanal se aplica en el punto de uso.
  const [records, setRecords] = useState(null);
  const [drivers, setDrivers] = useState(null);
  const [vehicles, setVehicles] = useState(null);
  const [weeklyError, setWeeklyError] = useState("");

  useEffect(() => {
    if (
      !isPrivileged ||
      (tab !== "general" && tab !== "semanal" && tab !== "reperibilidad") ||
      records !== null
    )
      return;
    let cancelled = false;

    // General/Semanal/Reperibilita solo necesitan hoy/esta semana - pedir todo el
    // historico (miles de registros, ~2.7MB) para despues filtrar en el navegador era
    // el cuello de botella real de esta pagina. Acotado a Piazza + DHL Roma (ver
    // filterToPiazzaYDhlRoma) desde este unico punto: alcanza a las 3 pestanas que
    // usan "records" (General/Semanal/Reperibilita ya filtraba por su cuenta, pero
    // General y Semanal no lo hacian).
    listRecordsRequest({ days: 7 })
      .then((data) => {
        if (!cancelled) setRecords(filterToPiazzaYDhlRoma(data));
      })
      .catch((err) => {
        if (!cancelled) setWeeklyError(parseApiError(err).message);
      });
    listUsersRequest()
      .then((data) => {
        if (!cancelled) setDrivers(data);
      })
      .catch((err) => {
        if (!cancelled) setWeeklyError(parseApiError(err).message);
      });
    listVehiclesRequest()
      .then((data) => {
        if (!cancelled) setVehicles(data);
      })
      .catch((err) => {
        if (!cancelled) setWeeklyError(parseApiError(err).message);
      });

    return () => {
      cancelled = true;
    };
  }, [isPrivileged, tab, records]);

  const weeklyLoaded = Boolean(records && drivers && vehicles);

  // Filtro de zona de la pestana Semanal - acota SOLO lo que usa esta pestana
  // (ranking/rentabilidad), no "records" en si (records tambien alimenta General y
  // Reperibilita, que tienen su propio criterio de zona - ver computeReperibilidadPiazza).
  const [semanalZona, setSemanalZona] = useState("TODOS");
  const semanalRecords = useMemo(() => {
    if (!records) return null;
    if (semanalZona === "TODOS") return records;
    return records.filter((r) => r.extrasPiazzaZona === semanalZona);
  }, [records, semanalZona]);

  // Rankings de la semana: los mismos km que se pagan (los calcula el servidor), de Extras Piazza + DHL Roma y de la zona elegida.
  const [kmRankingSemana, setKmRankingSemana] = useState(null);
  useEffect(() => {
    if (!isPrivileged || tab !== "semanal") return undefined;
    let cancelled = false;
    getKmRankingRequest({ periodo: "semana", zona: semanalZona === "TODOS" ? undefined : semanalZona, areas: RANKING_AREAS })
      .then((data) => {
        if (!cancelled) setKmRankingSemana(data);
      })
      .catch((err) => {
        if (!cancelled) setWeeklyError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [isPrivileged, tab, semanalZona, records]);
  const driverRanking = useMemo(() => kmRankingSemana?.choferes ?? [], [kmRankingSemana]);
  const fleetRanking = useMemo(() => kmRankingSemana?.vehiculos ?? [], [kmRankingSemana]);
  const zonaBreakdown = useMemo(
    () => (records ? computeExtrasPiazzaZonaBreakdown(records, "semana") : []),
    [records]
  );
  const economicStats = useMemo(
    () => (semanalRecords ? computeEconomicStats(semanalRecords, "semana") : null),
    [semanalRecords]
  );
  const reperibilidad = useMemo(
    () => (records && drivers && vehicles ? computeReperibilidadPiazza(records, drivers, vehicles) : null),
    [records, drivers, vehicles]
  );
  // Servicios pendientes separados por zona (Milano/Roma), en vez de un solo listado
  // general - reemplaza la tabla unica de antes (mostrar ambas duplicaba cada fila).
  // SIN_ZONA junta los que todavia no tienen ZONA cargada, para no perderlos de vista.
  const pendientesPorZona = useMemo(() => {
    const groups = { MILANO: [], ROMA: [], SIN_ZONA: [] };
    reperibilidad?.serviciosPendientes.forEach((r) => {
      const key = r.extrasPiazzaZona === "MILANO" || r.extrasPiazzaZona === "ROMA" ? r.extrasPiazzaZona : "SIN_ZONA";
      groups[key].push(r);
    });
    return groups;
  }, [reperibilidad]);
  // Choferes disponibles esta noche, separados por zona igual que arriba - no hay un
  // campo "zona" propio del chofer, se usa "grupo" (sucursal) como proxy: MILANO_NORD/
  // MILANO_SUD -> Milano, ROMA -> Roma. El resto (SOCIEDAD, FARMACIA, sin grupo
  // cargado) cae en SIN_GRUPO para no perderlos de vista.
  const choferesPiazzaPorZona = useMemo(() => {
    const groups = { MILANO: [], ROMA: [], SIN_GRUPO: [] };
    reperibilidad?.choferesPiazza.forEach((u) => {
      const key =
        u.grupo === "MILANO_NORD" || u.grupo === "MILANO_SUD" ? "MILANO" : u.grupo === "ROMA" ? "ROMA" : "SIN_GRUPO";
      groups[key].push(u);
    });
    return groups;
  }, [reperibilidad]);
  // Vehiculos disponibles, separados por zona con el mismo criterio de grupo que los
  // choferes de arriba (Vehiculo tambien tiene "grupo", ver schema.prisma).
  const vehiculosDisponiblesPorZona = useMemo(() => {
    const groups = { MILANO: [], ROMA: [], SIN_GRUPO: [] };
    reperibilidad?.vehiculosDisponibles.forEach((v) => {
      const key =
        v.grupo === "MILANO_NORD" || v.grupo === "MILANO_SUD" ? "MILANO" : v.grupo === "ROMA" ? "ROMA" : "SIN_GRUPO";
      groups[key].push(v);
    });
    return groups;
  }, [reperibilidad]);
  // Edicion en linea de la tabla de choferes (Si/No + vehiculo asignado): guarda por
  // chofer, no bloquea el resto de la fila mientras una de las dos guarda. drivers
  // se actualiza en el propio array cargado (no se vuelve a pedir la lista completa),
  // asi el resto de la pagina (ranking, etc.) tambien ve el dato fresco al toque.
  const [savingDriverField, setSavingDriverField] = useState({});
  const [driverFieldErrors, setDriverFieldErrors] = useState({});

  const applyDriverUpdate = (driverId, field) => async (value) => {
    setSavingDriverField((prev) => ({ ...prev, [`${driverId}:${field}`]: true }));
    setDriverFieldErrors((prev) => ({ ...prev, [driverId]: "" }));
    try {
      const updated = await updateUserRequest(driverId, { [field]: value });
      setDrivers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch (err) {
      setDriverFieldErrors((prev) => ({ ...prev, [driverId]: parseApiError(err).message }));
    } finally {
      setSavingDriverField((prev) => ({ ...prev, [`${driverId}:${field}`]: false }));
    }
  };

  const handleChangeDisponible = (driverId) => (value) =>
    applyDriverUpdate(driverId, "reperibilidadNoDisponible")(value === "NO");

  const handleChangeVehiculo = (driverId) => (value) =>
    applyDriverUpdate(driverId, "vehiculoAsignadoId")(value || null);

  // "Agregar chofer" (cualquier area): un solo PATCH con los 4 campos juntos, no uno
  // por uno como en la tabla de arriba. Si la fecha elegida no es hoy, no se manda
  // reperibilidadNoDisponible - una nota sobre un servicio dentro de unos dias no debe
  // apagarle a nadie la disponibilidad de esta noche (ver isReperibilidadNoDisponibleHoy).
  const [showAgregarChofer, setShowAgregarChofer] = useState(false);
  const [agregarChoferSubmitting, setAgregarChoferSubmitting] = useState(false);
  const [agregarChoferError, setAgregarChoferError] = useState("");

  const handleAgregarChofer = async ({ driverId, vehiculoAsignadoId, disponible, fecha, nota }) => {
    setAgregarChoferSubmitting(true);
    setAgregarChoferError("");
    // Comparacion de strings "yyyy-mm-dd" (el value crudo del <input type="date">), no
    // Date: evita el desfasaje de huso horario de interpretar una fecha-sin-hora como
    // medianoche UTC.
    const esHoy = fecha === todayDateInputValue();
    const payload = {
      vehiculoAsignadoId,
      proximoServicioFecha: fecha,
      proximoServicioNota: nota,
      ...(esHoy ? { reperibilidadNoDisponible: !disponible } : {}),
    };
    try {
      const updated = await updateUserRequest(driverId, payload);
      setDrivers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setShowAgregarChofer(false);
    } catch (err) {
      setAgregarChoferError(parseApiError(err).message);
    } finally {
      setAgregarChoferSubmitting(false);
    }
  };

  const handleQuitarServicioFuturo = (driverId) => async () => {
    setSavingDriverField((prev) => ({ ...prev, [`${driverId}:proximoServicio`]: true }));
    try {
      const updated = await updateUserRequest(driverId, { proximoServicioFecha: null, proximoServicioNota: null });
      setDrivers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch (err) {
      setDriverFieldErrors((prev) => ({ ...prev, [driverId]: parseApiError(err).message }));
    } finally {
      setSavingDriverField((prev) => ({ ...prev, [`${driverId}:proximoServicio`]: false }));
    }
  };

  const vehicleOptions = useMemo(
    () => [
      { value: "", label: "Sin asignar" },
      ...(vehicles ?? []).map((v) => ({
        value: v.id,
        label: `${v.targa}${v.modelo ? ` - ${v.modelo}` : ""}`,
      })),
    ],
    [vehicles]
  );

  const [copyFeedback, setCopyFeedback] = useState("");
  const handleCopyReperibilidad = () => {
    if (!reperibilidad) return;

    // Mismo filtro de "disponible" que reperibilidad.choferesDisponibles, aplicado
    // sobre el desglose por zona en vez del listado plano.
    const choferesDispPorZona = {
      MILANO: choferesPiazzaPorZona.MILANO.filter((u) => !isReperibilidadNoDisponibleHoy(u)),
      ROMA: choferesPiazzaPorZona.ROMA.filter((u) => !isReperibilidadNoDisponibleHoy(u)),
      SIN_GRUPO: choferesPiazzaPorZona.SIN_GRUPO.filter((u) => !isReperibilidadNoDisponibleHoy(u)),
    };

    const lines = [`Reperibilita Extras Piazza + DHL Roma - ${todayLabel()}`, ""];
    lines.push(
      ...buildZoneBlock("MILANO", pendientesPorZona.MILANO, choferesDispPorZona.MILANO, vehiculosDisponiblesPorZona.MILANO)
    );
    lines.push(
      "",
      ...buildZoneBlock("ROMA", pendientesPorZona.ROMA, choferesDispPorZona.ROMA, vehiculosDisponiblesPorZona.ROMA)
    );

    const haySinGrupo =
      pendientesPorZona.SIN_ZONA.length > 0 ||
      choferesDispPorZona.SIN_GRUPO.length > 0 ||
      vehiculosDisponiblesPorZona.SIN_GRUPO.length > 0;
    if (haySinGrupo) {
      lines.push(
        "",
        ...buildZoneBlock(
          "SIN ZONA/GRUPO",
          pendientesPorZona.SIN_ZONA,
          choferesDispPorZona.SIN_GRUPO,
          vehiculosDisponiblesPorZona.SIN_GRUPO
        )
      );
    }

    const proximos = reperibilidad.choferesConServicioFuturo;
    lines.push(
      "",
      proximos.length === 0
        ? "Todavia no hay proximos servicios asignados."
        : proximos.length === 1
          ? "Ya hay 1 proximo servicio asignado:"
          : `Ya hay ${proximos.length} proximos servicios asignados:`
    );
    proximos.forEach((u) => {
      const vehiculo = u.vehiculoAsignado
        ? `con la ${u.vehiculoAsignado.targa}${u.vehiculoAsignado.modelo ? ` (${u.vehiculoAsignado.modelo})` : ""}`
        : "sin vehiculo asignado todavia";
      let frase = `- ${u.nombre} ${u.apellido} tiene un servicio el ${formatDate(u.proximoServicioFecha)}, ${vehiculo}.`;
      if (u.proximoServicioNota) frase += ` Nota: ${u.proximoServicioNota}`;
      lines.push(frase);
    });

    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => {
        setCopyFeedback("Copiado al portapapeles");
        setTimeout(() => setCopyFeedback(""), 2500);
      })
      .catch(() => setCopyFeedback("No se pudo copiar"));
  };

  const inactiveDriverNames = useMemo(() => {
    if (!drivers) return [];
    const activeIds = new Set(driverRanking.map((e) => e.id));
    return drivers
      .filter((d) => d.estado === "ACTIVO" && grupoMatchesZona(d.grupo, semanalZona) && !activeIds.has(d.id))
      .map((d) => `${d.nombre} ${d.apellido}`);
  }, [drivers, driverRanking, semanalZona]);

  const inactiveVehicleNames = useMemo(() => {
    if (!vehicles) return [];
    const activeIds = new Set(fleetRanking.map((e) => e.id));
    return vehicles
      .filter(
        (v) => v.estado !== "FUERA_DE_SERVICIO" && grupoMatchesZona(v.grupo, semanalZona) && !activeIds.has(v.id)
      )
      .map((v) => `${v.targa}${v.modelo ? ` - ${v.modelo}` : ""}`);
  }, [vehicles, fleetRanking, semanalZona]);

  const servicePeriodStats = useMemo(
    () => (records ? computeServicePeriodStats(records, "hoy") : null),
    [records]
  );
  const driverStats = useMemo(
    () => (records && drivers ? computeDriverStats(drivers, records) : null),
    [drivers, records]
  );
  const vehicleStats = useMemo(
    () => (records && vehicles ? computeVehicleStats(vehicles, records) : null),
    [vehicles, records]
  );
  const recentRecords = useMemo(
    () => (records ? [...records].sort((a, b) => new Date(b.fechaServicio) - new Date(a.fechaServicio)).slice(0, 6) : []),
    [records]
  );
  const weeklyServiceTrend = useMemo(() => (records ? computeWeeklyServiceTrend(records) : []), [records]);

  // Acceso rapido (todas las pestanias): buscar un servicio sin tener que ir a
  // Registros primero. Mismo debounce/umbral de 2 caracteres que el buscador de
  // RecordsListPage.jsx.
  const [quickSearchQuery, setQuickSearchQuery] = useState("");
  const [quickSearchResults, setQuickSearchResults] = useState(null);

  useEffect(() => {
    if (!isPrivileged) return;
    const query = quickSearchQuery.trim();
    if (query.length < 2) {
      setQuickSearchResults(null);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      searchRecordsRequest(query)
        .then((data) => {
          if (!cancelled) setQuickSearchResults(data.slice(0, 6));
        })
        .catch(() => {
          if (!cancelled) setQuickSearchResults([]);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isPrivileged, quickSearchQuery]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold capitalize text-ink-50">
            {
              {
                general: "Resumen general",
                diario: "Resumen diario",
                semanal: "Resumen semanal",
                reperibilidad: "Reperibilita",
              }[tab]
            }
          </h1>
          <p className="mt-1 text-[14px] text-ink-300">
            {
              {
                general: "La operacion de hoy, de un vistazo.",
                diario: `${todayLabel()} · todo lo que necesita tu atencion, en un solo lugar.`,
                semanal: "Patrones de la semana: quien rindio mas o menos, y que servicios dieron perdida.",
                reperibilidad: `${todayLabel()} · lo que queda pendiente y quien esta disponible por si sale un pedido.`,
              }[tab]
            }
          </p>
        </div>
        {isPrivileged && <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} />}
      </div>

      {isPrivileged && (
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/records/extras-piazza/new" className="w-auto shrink-0">
            <Button className="w-auto px-5">Nuevo servicio Extras Piazza</Button>
          </Link>

          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <TextField
              id="resumen-quick-search"
              placeholder="Buscar por codigo, cliente o chofer..."
              value={quickSearchQuery}
              onChange={(e) => setQuickSearchQuery(e.target.value)}
            />
            {quickSearchResults !== null && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl glass-surface p-2">
                {quickSearchResults.length === 0 ? (
                  <p className="px-3 py-2 text-[13px] text-ink-300">Sin resultados.</p>
                ) : (
                  quickSearchResults.map((record) => (
                    <Link
                      key={record.id}
                      to={`/records/${record.id}`}
                      onClick={() => setQuickSearchQuery("")}
                      className="block rounded-lg px-3 py-2 text-[13px] text-ink-100 hover:bg-line/10"
                    >
                      <span className="font-medium text-ink-50">{record.codigo}</span> - {record.destinazione}
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "general" && isPrivileged && (
        <>
          <Alert>{weeklyError}</Alert>

          {!weeklyLoaded && (
            <PageLoader />
          )}

          {weeklyLoaded && (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
                <GlassCard>
                  <h2 className="text-[15px] font-semibold text-ink-50">Servicios esta semana</h2>
                  <p className="mt-1 text-[12px] text-ink-400">Ultimos 7 dias, hoy resaltado.</p>
                  <div className="mt-3 h-[200px]">
                    <ServicesTrendChart data={weeklyServiceTrend} />
                  </div>
                </GlassCard>

                <GlassCard className="flex flex-col">
                  <h2 className="text-[15px] font-semibold text-ink-50">Servicios hoy</h2>
                  <span className="mt-2 block text-[32px] font-semibold text-ink-50">
                    {servicePeriodStats.total}
                  </span>
                  <div className="mt-3 h-[120px] flex-1">
                    <ServicesWeekBarChart data={weeklyServiceTrend} />
                  </div>
                </GlassCard>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <ProgressRing
                  label="Servicios completados"
                  value={`${servicePeriodStats.total > 0 ? Math.round((servicePeriodStats.completados / servicePeriodStats.total) * 100) : 0}%`}
                  percent={servicePeriodStats.total > 0 ? (servicePeriodStats.completados / servicePeriodStats.total) * 100 : 0}
                  color="#16a34a"
                  size={128}
                  legend={[
                    { label: "Completados", value: servicePeriodStats.completados, color: "#16a34a" },
                    { label: "Resto", value: servicePeriodStats.total - servicePeriodStats.completados, color: "#9ca3af" },
                  ]}
                />
                <Link to="/choferes" className="block">
                  <ProgressRing
                    label="Choferes activos"
                    value={`${driverStats.total > 0 ? Math.round((driverStats.activos / driverStats.total) * 100) : 0}%`}
                    percent={driverStats.total > 0 ? (driverStats.activos / driverStats.total) * 100 : 0}
                    color="#2563eb"
                    size={128}
                    legend={[
                      { label: "Activos", value: driverStats.activos, color: "#2563eb" },
                      { label: "Inactivos", value: driverStats.total - driverStats.activos, color: "#9ca3af" },
                    ]}
                  />
                </Link>
                <Link to="/vehiculos" className="block">
                  <ProgressRing
                    label="Vehiculos disponibles"
                    value={`${vehicleStats.total > 0 ? Math.round((vehicleStats.disponibles / vehicleStats.total) * 100) : 0}%`}
                    percent={vehicleStats.total > 0 ? (vehicleStats.disponibles / vehicleStats.total) * 100 : 0}
                    color="#f59e0b"
                    size={128}
                    legend={[
                      { label: "Disponibles", value: vehicleStats.disponibles, color: "#f59e0b" },
                      { label: "No disponibles", value: vehicleStats.total - vehicleStats.disponibles, color: "#9ca3af" },
                    ]}
                  />
                </Link>
              </div>

              <GlassCard>
                <h2 className="text-[15px] font-semibold text-ink-50">Ultimos servicios</h2>
                <p className="mt-1 text-[12px] text-ink-400">
                  Los 6 mas recientes, de cualquier seccion y estado.
                </p>

                {recentRecords.length === 0 ? (
                  <p className="mt-3 text-[13px] text-ink-300">Todavia no hay servicios cargados.</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {recentRecords.map((record) => (
                      <li key={record.id}>
                        <Link
                          to={`/records/${record.id}`}
                          className="flex items-center gap-3 rounded-xl glass-surface-sm px-3 py-2.5 text-[13px] transition-colors hover:bg-line/[0.08]"
                        >
                          <Avatar user={record.driver} className="h-8 w-8 shrink-0 text-[12px]" />
                          <span className="min-w-0 flex-1 truncate text-ink-50">
                            {record.codigo} <span className="text-ink-400">- {record.client?.nombre ?? "-"}</span>
                          </span>
                          <span className="hidden shrink-0 text-[12px] text-ink-400 sm:inline">
                            {formatDate(record.fechaServicio)}
                          </span>
                          <StatusBadge status={record.estado} className="shrink-0 px-2 py-0.5 text-[10px]" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </GlassCard>
            </>
          )}
        </>
      )}

      {tab === "diario" && (
        <>
          {isPrivileged && !loading && groups.length > 0 && (
            <div className="flex justify-end">
              <SegmentedControl options={SEMANAL_ZONA_OPTIONS} value={diarioZona} onChange={setDiarioZona} />
            </div>
          )}

          {loading && (
            <PageLoader />
          )}

          {!loading && visibleGroups.length === 0 && (
            <GlassCard className="text-center text-[14px] text-ink-300">
              Sin alertas pendientes. Todo al dia.
            </GlassCard>
          )}

          {!loading &&
            visibleGroups.map((group) => (
              <GlassCard key={group.label}>
                <h2 className="text-[15px] font-semibold text-ink-50">
                  {group.label} <span className="text-ink-400">({group.items.length})</span>
                </h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {group.items.map((alert) => {
                    const itemClassName = clsx(
                      "flex flex-1 items-start gap-2 rounded-xl border px-4 py-3 text-[13px]",
                      SEVERITY_ITEM_CLASSES[alert.severity] ?? SEVERITY_ITEM_CLASSES.warning
                    );
                    return (
                      <li key={alert.id} className="flex items-start gap-2.5">
                        <span
                          className={clsx(
                            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                            SEVERITY_DOT_CLASSES[alert.severity] ?? SEVERITY_DOT_CLASSES.warning
                          )}
                        />
                        <div className={itemClassName}>
                          {alert.link ? (
                            <Link to={alert.link} className="min-w-0 flex-1 hover:underline">
                              {alert.message}
                            </Link>
                          ) : (
                            <span className="min-w-0 flex-1">{alert.message}</span>
                          )}
                          {/* "Eliminar" no borra nada en el backend, ver comentario de
                              isDismissed en NotificationsContext.jsx. dismissible ===
                              false (ej. Area C): se resuelve marcando pagado en el
                              Mapa, no ocultandola a mano - ver NotificationsBell.jsx. */}
                          {alert.dismissible !== false && (
                            <button
                              type="button"
                              onClick={() => dismiss(alert)}
                              aria-label="Eliminar notificacion"
                              title="Eliminar notificacion"
                              className="shrink-0 rounded-full p-1 opacity-60 transition-opacity hover:bg-current/10 hover:opacity-100"
                            >
                              <CloseIcon className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </GlassCard>
            ))}
        </>
      )}

      {tab === "semanal" && isPrivileged && (
        <>
          <Alert>{weeklyError}</Alert>

          {!weeklyLoaded && (
            <PageLoader />
          )}

          {weeklyLoaded && (
            <>
              <div className="flex justify-end">
                <SegmentedControl options={SEMANAL_ZONA_OPTIONS} value={semanalZona} onChange={setSemanalZona} />
              </div>

              <RankingCard
                title="Choferes esta semana"
                subtitle="KM de la semana (los mismos que se pagan), de mayor a menor."
                entries={driverRanking.slice(0, 8)}
                emptyLabel="Sin servicios esta semana todavia."
                inactiveLabel={`Sin actividad esta semana (${inactiveDriverNames.length})`}
                inactiveNames={inactiveDriverNames}
              />
              <RankingCard
                title="Vehiculos esta semana"
                subtitle="KM recorridos, de mayor a menor."
                entries={fleetRanking.slice(0, 8)}
                emptyLabel="Sin servicios esta semana todavia."
                inactiveLabel={`Sin uso esta semana (${inactiveVehicleNames.length})`}
                inactiveNames={inactiveVehicleNames}
              />
              {semanalZona === "TODOS" && (
                <RankingCard
                  title="Extras Piazza por zona"
                  subtitle="Milano vs Roma, KM y servicios de la semana."
                  entries={zonaBreakdown}
                  emptyLabel="Sin servicios de Extras Piazza esta semana todavia."
                  inactiveLabel=""
                  inactiveNames={[]}
                />
              )}
              <GlassCard>
                <h2 className="mb-3 text-[15px] font-semibold text-ink-50">
                  Servicios de la semana &middot; Extras Piazza + DHL/AB Service
                  {semanalZona !== "TODOS" && ` (${SEMANAL_ZONA_OPTIONS.find((o) => o.value === semanalZona)?.label})`}
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ProfitLossList title="Mas rentables" items={economicStats.masRentables} tone="green" />
                  <ProfitLossList title="Con perdidas" items={economicStats.conPerdidas} tone="red" />
                </div>
              </GlassCard>
            </>
          )}
        </>
      )}

      {tab === "reperibilidad" && isPrivileged && (
        <>
          <Alert>{weeklyError}</Alert>

          {!weeklyLoaded && (
            <PageLoader />
          )}

          {weeklyLoaded && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-ink-400">
                  Extras Piazza + DHL Roma &middot; {reperibilidad.serviciosPendientes.length} servicio(s) pendiente(s)
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" className="w-auto px-4" onClick={() => setShowAgregarChofer(true)}>
                    Agregar chofer
                  </Button>
                  <Button variant="ghost" className="w-auto px-4" onClick={handleCopyReperibilidad}>
                    {copyFeedback || "Copiar como texto"}
                  </Button>
                </div>
              </div>

              <PendingServicesCard
                title="Servicios pendientes · Milano"
                subtitle="Extras Piazza de zona Milano que todavia hay que completar hoy."
                items={pendientesPorZona.MILANO}
                emptyLabel="No hay servicios pendientes en Milano."
              />

              <PendingServicesCard
                title="Servicios pendientes · Roma"
                subtitle="Extras Piazza + DHL de zona Roma que todavia hay que completar hoy."
                items={pendientesPorZona.ROMA}
                emptyLabel="No hay servicios pendientes en Roma."
              />

              {pendientesPorZona.SIN_ZONA.length > 0 && (
                <PendingServicesCard
                  title="Servicios pendientes · Sin zona"
                  subtitle="Todavia no tienen ZONA cargada (ver Nuevo servicio Extras Piazza)."
                  items={pendientesPorZona.SIN_ZONA}
                  emptyLabel=""
                />
              )}

              <AvailableDriversCard
                title="Choferes disponibles esta noche · Milano"
                subtitle="Grupo Milano Nord/Sud. Marca si esta disponible y con que vehiculo sale."
                drivers={choferesPiazzaPorZona.MILANO}
                emptyLabel="Sin choferes de Extras Piazza Milano activos."
                vehicleOptions={vehicleOptions}
                savingDriverField={savingDriverField}
                driverFieldErrors={driverFieldErrors}
                servicioActualPorChofer={reperibilidad.servicioActualPorChofer}
                onChangeDisponible={handleChangeDisponible}
                onChangeVehiculo={handleChangeVehiculo}
              />

              <AvailableDriversCard
                title="Choferes disponibles esta noche · Roma"
                subtitle="Grupo Roma (Extras Piazza + DHL). Marca si esta disponible y con que vehiculo sale."
                drivers={choferesPiazzaPorZona.ROMA}
                emptyLabel="Sin choferes de Extras Piazza Roma activos."
                vehicleOptions={vehicleOptions}
                savingDriverField={savingDriverField}
                driverFieldErrors={driverFieldErrors}
                servicioActualPorChofer={reperibilidad.servicioActualPorChofer}
                onChangeDisponible={handleChangeDisponible}
                onChangeVehiculo={handleChangeVehiculo}
              />

              {choferesPiazzaPorZona.SIN_GRUPO.length > 0 && (
                <AvailableDriversCard
                  title="Choferes disponibles esta noche · Sin grupo"
                  subtitle="Sin Milano Nord/Sud ni Roma cargado (ver ficha del chofer)."
                  drivers={choferesPiazzaPorZona.SIN_GRUPO}
                  emptyLabel=""
                  vehicleOptions={vehicleOptions}
                  savingDriverField={savingDriverField}
                  driverFieldErrors={driverFieldErrors}
                  servicioActualPorChofer={reperibilidad.servicioActualPorChofer}
                  onChangeDisponible={handleChangeDisponible}
                  onChangeVehiculo={handleChangeVehiculo}
                />
              )}

              <GlassCard>
                <h2 className="text-[15px] font-semibold text-ink-50">Proximos servicios</h2>
                <p className="mt-1 text-[12px] text-ink-400">
                  Choferes de cualquier area con un aviso manual de un servicio futuro (ver "Agregar
                  chofer" arriba).
                </p>

                {reperibilidad.choferesConServicioFuturo.length === 0 ? (
                  <p className="mt-3 text-[13px] text-ink-300">Sin proximos servicios anotados.</p>
                ) : (
                  <div className="mt-3 flex flex-col gap-2">
                    {reperibilidad.choferesConServicioFuturo.map((u) => (
                      <div key={u.id} className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-3 rounded-xl glass-surface-sm px-3 py-2">
                          <span className="min-w-0 flex-1 truncate text-[13px] text-ink-50">
                            {u.nombre} {u.apellido}
                          </span>
                          <span className="shrink-0 text-[12px] text-ink-300">
                            {formatDate(u.proximoServicioFecha)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[12px] text-ink-400">
                            {u.proximoServicioNota || "Sin nota"}
                          </span>
                          <span className="shrink-0 text-[12px] text-ink-400">
                            {u.vehiculoAsignado
                              ? `${u.vehiculoAsignado.targa}${u.vehiculoAsignado.modelo ? ` - ${u.vehiculoAsignado.modelo}` : ""}`
                              : "Sin vehiculo"}
                          </span>
                          <Button
                            variant="ghost"
                            className="w-auto shrink-0 px-3 py-1.5 text-[12px]"
                            loading={Boolean(savingDriverField[`${u.id}:proximoServicio`])}
                            onClick={handleQuitarServicioFuturo(u.id)}
                          >
                            Quitar
                          </Button>
                        </div>
                        {driverFieldErrors[u.id] && (
                          <span className="px-3 text-[12px] text-danger-500">{driverFieldErrors[u.id]}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>

              <AvailableVehiclesCard
                title="Vehiculos disponibles · Milano"
                subtitle="Grupo Milano Nord/Sud, disponibles y sin servicio en curso ahora."
                vehicles={vehiculosDisponiblesPorZona.MILANO}
                emptyLabel="Ninguno disponible en Milano ahora."
              />

              <AvailableVehiclesCard
                title="Vehiculos disponibles · Roma"
                subtitle="Grupo Roma (Extras Piazza + DHL), disponibles y sin servicio en curso ahora."
                vehicles={vehiculosDisponiblesPorZona.ROMA}
                emptyLabel="Ninguno disponible en Roma ahora."
              />

              {vehiculosDisponiblesPorZona.SIN_GRUPO.length > 0 && (
                <AvailableVehiclesCard
                  title="Vehiculos disponibles · Sin grupo"
                  subtitle="Sin Milano Nord/Sud ni Roma cargado (ver ficha del vehiculo)."
                  vehicles={vehiculosDisponiblesPorZona.SIN_GRUPO}
                  emptyLabel=""
                />
              )}
            </>
          )}
        </>
      )}

      {isPrivileged && drivers && vehicles && (
        <AsignarServicioFuturoModal
          open={showAgregarChofer}
          drivers={drivers}
          vehicles={vehicles}
          loading={agregarChoferSubmitting}
          error={agregarChoferError}
          onSubmit={handleAgregarChofer}
          onClose={() => setShowAgregarChofer(false)}
        />
      )}
    </div>
  );
};
