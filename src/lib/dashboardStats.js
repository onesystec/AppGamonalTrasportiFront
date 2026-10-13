import { EN_PROCESO_STATUSES, TIPO_DOCUMENTO_LABELS, getTagliandoStatus } from "./constants";
import { desdeCorte } from "./fechasCorte";
import { formatCurrency, formatDate, formatDateTime } from "./format";
import { RECORD_AREAS, classifyRecord } from "./recordAreas";
import { kmRecorrido } from "./km";

const isSameDay = (a, b) => {
  const dateA = new Date(a);
  const dateB = new Date(b);
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
};

const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // semana arranca el lunes
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

// selectedMonth ({year, month(1-indexed)}) - solo se usa para period "mes": permite
// elegir un mes puntual (no solo el actual) en el Control economico del dashboard OWNER
// (ver PeriodPicker en OwnerDashboardPage.jsx). Sin selectedMonth, es el mes en curso -
// mismo comportamiento de siempre, salvo que ahora tambien queda acotado hacia arriba
// (antes "mes" no tenia techo: un registro de cualquier fecha futura, no solo de este
// mes, contaba igual - bug latente sin efecto practico porque nunca hubo datos tan
// adelantados, pero hacia falta un techo real para poder acotar un mes pasado).
const monthRange = (now, selectedMonth) => {
  const year = selectedMonth?.year ?? now.getFullYear();
  const month = selectedMonth?.month ?? now.getMonth() + 1;
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
};

const isWithinPeriod = (value, period, now, selectedMonth) => {
  const date = new Date(value);
  if (period === "hoy") return isSameDay(date, now);
  if (period === "semana") return date >= startOfWeek(now);
  if (period === "mes") {
    const { start, end } = monthRange(now, selectedMonth);
    return date >= start && date < end;
  }
  return true;
};

// Rango del periodo inmediatamente anterior al seleccionado (mismo largo), para
// poder mostrar "+X% vs periodo anterior" en los KPI economicos.
const isWithinPreviousPeriod = (value, period, now, selectedMonth) => {
  const date = new Date(value);
  if (period === "hoy") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return isSameDay(date, yesterday);
  }
  if (period === "semana") {
    const start = startOfWeek(now);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 7);
    return date >= prevStart && date < start;
  }
  if (period === "mes") {
    const { start } = monthRange(now, selectedMonth);
    const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    return date >= prevStart && date < start;
  }
  return false;
};

// null cuando no hay base de comparacion (evita mostrar "+Infinity%").
const percentChange = (current, previous) => {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const RECORD_STATUS_KEYS = [
  "IN_SOSPESO",
  "IN_CONSEGNA",
  "CONSEGNATO",
  "RITIRATO",
  "RISCHEDULATO",
  "ANNULLATO",
];

export const computeServiceStats = (records, now = new Date()) => {
  const byEstado = Object.fromEntries(RECORD_STATUS_KEYS.map((key) => [key, 0]));
  records.forEach((record) => {
    if (byEstado[record.estado] !== undefined) byEstado[record.estado] += 1;
  });

  return {
    creadosHoy: records.filter((r) => isSameDay(r.createdAt, now)).length,
    programadosHoy: records.filter((r) => isSameDay(r.fechaServicio, now)).length,
    byEstado,
  };
};

export const computeVehicleStats = (vehicles, records) => {
  const vehiculosEnServicio = new Set(
    records.filter((r) => r.estado === "IN_CONSEGNA").map((r) => r.vehicle?.id)
  );

  return {
    total: vehicles.length,
    disponibles: vehicles.filter((v) => v.estado === "DISPONIBLE").length,
    enMantenimiento: vehicles.filter((v) => v.estado === "EN_MANTENIMIENTO").length,
    fueraDeServicio: vehicles.filter((v) => v.estado === "FUERA_DE_SERVICIO").length,
    enServicioAhora: vehicles.filter((v) => vehiculosEnServicio.has(v.id)).length,
  };
};

// Cualquier usuario puede manejar un servicio sin importar su cargo (OWNER/ADMIN
// tambien pueden salir a repartir) - por eso "choferes" aca no filtra por cargo, solo
// por estado de la cuenta (ver pedido explicito: "todos sean choferes sin excepcion").
export const computeDriverStats = (users, records, now = new Date()) => {
  const choferes = users;
  const activos = choferes.filter((u) => u.estado === "ACTIVO");

  const conServicioHoyIds = new Set(
    records.filter((r) => isSameDay(r.fechaServicio, now)).map((r) => r.driver?.id)
  );
  const enRutaIds = new Set(
    records.filter((r) => r.estado === "IN_CONSEGNA").map((r) => r.driver?.id)
  );

  return {
    total: choferes.length,
    activos: activos.length,
    conServicioHoy: activos.filter((u) => conServicioHoyIds.has(u.id)).length,
    disponiblesAhora: activos.filter((u) => !enRutaIds.has(u.id)).length,
  };
};

const ECONOMIC_COST_FIELDS = [
  "costoCombustible",
  "peajes",
  "vignetta",
  "costoHotel",
  "costoTraforoFrejusBrennero",
  "areaC",
  "costoEspera",
  "costoOtros",
];

const ECONOMIC_COST_FIELD_LABELS = {
  costoCombustible: "Combustible",
  peajes: "Peajes",
  vignetta: "Vignetta",
  costoHotel: "Hotel",
  costoTraforoFrejusBrennero: "Traforo/Frejus/Brennero",
  areaC: "Area C",
  costoEspera: "Espera",
  costoOtros: "Otros",
};

export const isDhlAbRecord = (record) => record.spedizzione === "DHL" || record.spedizzione === "AB_SERVICE";
export const isExtrasStefaniaRecord = (record) => record.spedizzione === "EXTRAS_STEFANIA";

// Registros de las 3 areas que se manejan juntos: Extras Piazza (Milano + Roma) + DHL
// Roma - ver isDhlRomaRecord mas abajo. Deja afuera DHL Milano, AB Service y Extras
// Stefania en cualquier pantalla que muestre datos agregados (rankings, resumenes,
// mapa) - pedido explicito: esas 3 areas son las unicas utiles, en toda la app, no
// solo en Registros/Dashboard.
export const filterToPiazzaYDhlRoma = (records) =>
  records.filter((r) => (!isDhlAbRecord(r) && !isExtrasStefaniaRecord(r)) || isDhlRomaRecord(r));

// Tarifa de referencia para estimar lo facturado (rimborso km estandar).
const DHL_KM_RATE = 0.43;
const DHL_KM_MULTIPLIER = 2;

// Pago al chofer: 10€/hora de manejo, sea cual sea el tipo de servicio.
const DRIVER_HOURLY_RATE = 10;
// Si no hay horasDia/horasNoche cargadas (servicios importados, o uno recien
// creado antes de que el chofer cierre el servicio), se estima la hora manejada a
// un promedio de ~100km/hora en vez de dejar el pago al chofer en 0 por falta de
// dato. Sin duplicar por ida/vuelta aca: el KM cargado en el registro ya es el
// total recorrido (a diferencia de la tarifa de DHL, que si duplica el KM
// planificado porque ese es de un solo tramo).
const ASSUMED_KM_PER_HOUR = 100;

// La tarifa sale del servicio (precio por km automatico de DHL / AB Service); 0,43 EUR/km si no la trae.
const dhlKmCharge = (record, rate) => (record.kilometros ?? 0) * DHL_KM_MULTIPLIER * (record.precioKm ?? rate);
const dhlExtras = (record) => (record.areaC ?? 0) + (record.costoEspera ?? 0);

// Horas manejadas: las reales si el chofer ya las cargo; si no, se estiman a
// partir del KM total del registro (sin duplicar, ver ASSUMED_KM_PER_HOUR).
const recordDriverHours = (record) => {
  const logged = (record.horasDia ?? 0) + (record.horasNoche ?? 0);
  if (logged > 0) return logged;
  return (record.kilometros ?? 0) / ASSUMED_KM_PER_HOUR;
};

const recordDriverPay = (record) => recordDriverHours(record) * DRIVER_HOURLY_RATE;

// "Costos operativos": combustible/peajes/vignetta/hotel/traforo/area C/espera,
// mas el pago al chofer - DHL/AB Service ahora carga estos mismos gastos a mano
// igual que Extras Piazza (antes se le estimaba un monto fijo por KM porque no
// se cargaban).
const recordCost = (record) =>
  recordDriverPay(record) + ECONOMIC_COST_FIELDS.reduce((sum, field) => sum + (record[field] ?? 0), 0);

// DHL/AB Service tampoco carga facturacion manualmente todavia: mientras no se
// cargue un pagoRecibido real, se estima con la tarifa de referencia por KM. El dia
// que se cargue el pago real de un servicio puntual, ese valor pisa la estimacion.
const recordRevenue = (record) => {
  if (record.pagoRecibido != null) return record.pagoRecibido;
  if (isDhlAbRecord(record)) return dhlKmCharge(record, DHL_KM_RATE) + dhlExtras(record);
  return 0;
};

const recordProfit = (record) => recordRevenue(record) - recordCost(record);

// Conteo de servicios del periodo elegido, a nivel compania (sin separar por
// spedizzione) - para las mini-cards KPI de la pestana "General" de Resumen.
export const computeServicePeriodStats = (records, period, now = new Date()) => {
  const scoped = records.filter((r) => isWithinPeriod(r.fechaServicio, period, now));
  return {
    total: scoped.length,
    enCurso: scoped.filter((r) => EN_PROCESO_STATUSES.includes(r.estado)).length,
    completados: scoped.filter((r) => r.estado === "CONSEGNATO").length,
  };
};

// Servicios por dia de los ultimos 7 dias (terminando hoy), para los graficos de
// tendencia semanal de la pestana "General" - isToday marca el ultimo punto (hoy),
// para que el chart lo pueda resaltar.
const WEEKDAY_LABELS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];
export const computeWeeklyServiceTrend = (records, now = new Date()) => {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - i));
    return date;
  });
  return days.map((date, idx) => ({
    label: WEEKDAY_LABELS[date.getDay()],
    count: records.filter((r) => isSameDay(r.fechaServicio, date)).length,
    isToday: idx === days.length - 1,
  }));
};

// selectedMonth ({year, month(1-indexed)}): solo aplica con period "mes", para poder
// mirar un mes puntual en vez de siempre el actual - ver monthRange mas arriba.
export const computeEconomicStats = (records, period, now = new Date(), selectedMonth = null) => {
  const scoped = records.filter((r) => isWithinPeriod(r.fechaServicio, period, now, selectedMonth));
  const previousScoped = records.filter((r) =>
    isWithinPreviousPeriod(r.fechaServicio, period, now, selectedMonth)
  );

  const facturacion = scoped.reduce((sum, r) => sum + recordRevenue(r), 0);
  const costos = scoped.reduce((sum, r) => sum + recordCost(r), 0);
  const ganancia = facturacion - costos;

  const facturacionAnterior = previousScoped.reduce((sum, r) => sum + recordRevenue(r), 0);
  const gananciaAnterior =
    facturacionAnterior - previousScoped.reduce((sum, r) => sum + recordCost(r), 0);

  const withProfit = scoped
    .map((r) => ({ record: r, profit: recordProfit(r) }))
    .sort((a, b) => b.profit - a.profit);

  const masRentables = withProfit.filter((r) => r.profit > 0).slice(0, 5);
  const conPerdidas = withProfit
    .filter((r) => r.profit < 0)
    .sort((a, b) => a.profit - b.profit)
    .slice(0, 5);

  // Desglose por categoria de lo que compone facturacion y costos - para el modal
  // de detalle de los anillos de Control economico (mismos campos que recordRevenue
  // y recordCost, solo que agrupados en vez de sumados directo a un total).
  const conPago = scoped.filter((r) => r.pagoRecibido != null);
  const sinPagoDhlAb = scoped.filter((r) => r.pagoRecibido == null && isDhlAbRecord(r));
  const OTHER_COST_FIELDS = ECONOMIC_COST_FIELDS.filter((f) => f !== "areaC" && f !== "costoEspera");

  const facturacionBreakdown = [
    {
      label: "Pagos reales cargados",
      monto: conPago.reduce((sum, r) => sum + r.pagoRecibido, 0),
      count: conPago.length,
    },
    {
      label: "Estimado por tarifa km (DHL/AB Service)",
      monto: sinPagoDhlAb.reduce((sum, r) => sum + dhlKmCharge(r, DHL_KM_RATE), 0),
      count: sinPagoDhlAb.length,
    },
    {
      label: "Area C + espera (de los estimados)",
      monto: sinPagoDhlAb.reduce((sum, r) => sum + dhlExtras(r), 0),
      count: sinPagoDhlAb.length,
    },
  ];

  const costosBreakdown = [
    {
      label: "Pago a choferes",
      monto: scoped.reduce((sum, r) => sum + recordDriverPay(r), 0),
      count: scoped.length,
    },
    {
      label: "Area C",
      monto: scoped.reduce((sum, r) => sum + (r.areaC ?? 0), 0),
      count: scoped.filter((r) => r.areaC).length,
    },
    {
      label: "Espera",
      monto: scoped.reduce((sum, r) => sum + (r.costoEspera ?? 0), 0),
      count: scoped.filter((r) => r.costoEspera).length,
    },
    ...OTHER_COST_FIELDS.map((field) => ({
      label: ECONOMIC_COST_FIELD_LABELS[field],
      monto: scoped.reduce((sum, r) => sum + (r[field] ?? 0), 0),
      count: scoped.filter((r) => r[field]).length,
    })),
  ];

  return {
    facturacion,
    costos,
    ganancia,
    facturacionBreakdown,
    costosBreakdown,
    masRentables,
    conPerdidas,
    facturacionDeltaPct: percentChange(facturacion, facturacionAnterior),
    gananciaDeltaPct: percentChange(ganancia, gananciaAnterior),
  };
};

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Facturacion y ganancia mes a mes del anio en curso (Ene-Dic), para el grafico de
// tendencia del dashboard OWNER. A diferencia de computeEconomicStats (que solo mira
// el periodo elegido en el selector), esto siempre es el anio calendario completo.
// ANNULLATO se excluye: un servicio anulado no se llego a hacer, no debe sumar
// facturacion/km aunque haya quedado con esos campos cargados de antes de anularlo.
export const computeMonthlyRevenueTrend = (records, now = new Date()) => {
  const year = now.getFullYear();
  const buckets = MONTH_LABELS.map((month) => ({ month, facturacion: 0, ganancia: 0 }));

  records.forEach((r) => {
    if (r.estado === "ANNULLATO") return;
    const date = new Date(r.fechaServicio);
    if (date.getFullYear() !== year) return;
    const bucket = buckets[date.getMonth()];
    bucket.facturacion += recordRevenue(r);
    bucket.ganancia += recordProfit(r);
  });

  return buckets;
};

// Kilometros mes a mes del anio en curso, mismo criterio que computeMonthlyRevenueTrend
// (anio calendario completo, no el periodo del selector Hoy/Semana/Mes) - para el
// grafico de tendencia de km del dashboard OWNER. A diferencia de recordKm (usado en
// los rankings de choferes/vehiculos, donde planificado tiene prioridad a proposito -
// ver comentario ahi), esto busca reflejar el km real recorrido: si el chofer ya cargo
// el km real del viaje, se usa ese en vez del planificado original.
export const computeMonthlyKmTrend = (records, now = new Date()) => {
  const year = now.getFullYear();
  const buckets = MONTH_LABELS.map((month) => ({ month, km: 0 }));

  records.forEach((r) => {
    if (r.estado === "ANNULLATO") return;
    const date = new Date(r.fechaServicio);
    if (date.getFullYear() !== year) return;
    buckets[date.getMonth()].km += kmRecorrido(r);
  });

  return buckets;
};


export const computeCurrentService = (records, now = new Date()) => {
  const enCurso = records.find((r) => r.estado === "IN_CONSEGNA");
  if (enCurso) return enCurso;

  const proximosHoy = records
    .filter((r) => r.estado === "IN_SOSPESO" && isSameDay(r.fechaServicio, now))
    .sort((a, b) => new Date(a.fechaServicio) - new Date(b.fechaServicio));

  return proximosHoy[0] ?? null;
};

// Todos los servicios en curso o pendientes de accion (IN_CONSEGNA, IN_SOSPESO,
// RITIRATO), para el listado completo de "Servicio actual" del chofer.
export const computeCurrentServices = (records) =>
  records
    .filter((r) => EN_PROCESO_STATUSES.includes(r.estado))
    .sort((a, b) => new Date(a.fechaServicio) - new Date(b.fechaServicio));

export const computeMyServiceCounts = (records, now = new Date()) => ({
  hoy: records.filter((r) => isSameDay(r.fechaServicio, now)).length,
  // Solo los servicios desde el corte: los anteriores no cuentan como pendientes.
  pendientes: records.filter((r) => EN_PROCESO_STATUSES.includes(r.estado) && desdeCorte(r.fechaServicio)).length,
  completados: records.filter((r) => r.estado === "CONSEGNATO").length,
  cancelados: records.filter((r) => r.estado === "ANNULLATO").length,
});

export const computeWorkHours = (records, now = new Date()) => {
  const sum = (list, field) => list.reduce((total, r) => total + (r[field] ?? 0), 0);

  const hoy = records.filter((r) => isSameDay(r.fechaServicio, now));
  const semana = records.filter((r) => new Date(r.fechaServicio) >= startOfWeek(now));
  const mes = records.filter((r) => new Date(r.fechaServicio) >= startOfMonth(now));

  return {
    horasHoy: sum(hoy, "horasDia") + sum(hoy, "horasNoche"),
    horasSemana: sum(semana, "horasDia") + sum(semana, "horasNoche"),
    horasMes: sum(mes, "horasDia") + sum(mes, "horasNoche"),
    horasDiaMes: sum(mes, "horasDia"),
    horasNocheMes: sum(mes, "horasNoche"),
    tiempoEsperaMes: sum(mes, "tiempoEspera"),
  };
};

// DHL/AB Service pesan el doble que Extras Piazza en los rankings de KM (mas
// exigentes para el chofer/vehiculo que un trayecto de Extras Piazza equivalente).
// Pedido explicito del negocio, no una medida real de distancia recorrida.
const kmMultiplier = (record) =>
  record.spedizzione === "DHL" || record.spedizzione === "AB_SERVICE" ? 2 : 1;

// Km planificados (los que carga admin/owner al crear el servicio) tienen prioridad
// sobre los reales - reales solo se usa de respaldo para el historico viejo que no
// tiene planificado cargado.
const recordKm = (record) => (record.kilometros ?? record.kilometrosReales ?? 0) * kmMultiplier(record);

// Categoria "cruda" (sin el peso x2) por spedizzione, para poder mostrar el
// desglose en el modal de detalle - un registro sin spedizzione reconocido se
// trata como Extras Piazza (mismo criterio que kmMultiplier).
const kmCategory = (record) =>
  record.spedizzione === "DHL" || record.spedizzione === "AB_SERVICE"
    ? record.spedizzione
    : isExtrasStefaniaRecord(record)
      ? "EXTRAS_STEFANIA"
      : "EXTRA_PIAZZA";

export const computeDriverKmRanking = (records, period, now = new Date()) => {
  const scoped = records.filter((r) => isWithinPeriod(r.fechaServicio, period, now));
  const totals = new Map();

  scoped.forEach((r) => {
    if (!r.driver?.id) return;
    const entry = totals.get(r.driver.id) ?? {
      id: r.driver.id,
      nombre: `${r.driver.nombre} ${r.driver.apellido}`,
      km: 0,
      servicios: 0,
      breakdown: { EXTRA_PIAZZA: 0, DHL: 0, AB_SERVICE: 0, EXTRAS_STEFANIA: 0 },
    };
    entry.km += recordKm(r);
    entry.servicios += 1;
    entry.breakdown[kmCategory(r)] += r.kilometros ?? r.kilometrosReales ?? 0;
    totals.set(r.driver.id, entry);
  });

  return Array.from(totals.values()).sort((a, b) => b.km - a.km);
};

export const computeFleetKmUsage = (records, period, now = new Date()) => {
  const scoped = records.filter((r) => isWithinPeriod(r.fechaServicio, period, now));
  const totals = new Map();

  scoped.forEach((r) => {
    if (!r.vehicle?.id) return;
    const entry = totals.get(r.vehicle.id) ?? {
      id: r.vehicle.id,
      nombre: `${r.vehicle.targa}${r.vehicle.modelo ? ` - ${r.vehicle.modelo}` : ""}`,
      km: 0,
      servicios: 0,
      breakdown: { EXTRA_PIAZZA: 0, DHL: 0, AB_SERVICE: 0, EXTRAS_STEFANIA: 0 },
    };
    entry.km += recordKm(r);
    entry.servicios += 1;
    entry.breakdown[kmCategory(r)] += r.kilometros ?? r.kilometrosReales ?? 0;
    totals.set(r.vehicle.id, entry);
  });

  return Array.from(totals.values()).sort((a, b) => b.km - a.km);
};

const EXTRAS_PIAZZA_ZONA_LABELS = { MILANO: "Milano", ROMA: "Roma" };
const SIN_ZONA_KEY = "SIN_ZONA";

// Extras Piazza por zona (Milano/Roma) - mismo shape que computeDriverKmRanking
// (id/nombre/km/servicios) para reusar RankingCard tal cual. Hoy casi ningun
// registro tiene extrasPiazzaZona cargada (el campo existe en el formulario pero
// no se completa en la practica), asi que "Sin zona" va a dominar hasta que se
// empiece a usar - queda listo para cuando eso pase.
export const computeExtrasPiazzaZonaBreakdown = (records, period, now = new Date()) => {
  const scoped = records.filter(
    (r) => !isDhlAbRecord(r) && !isExtrasStefaniaRecord(r) && isWithinPeriod(r.fechaServicio, period, now)
  );
  const totals = new Map();

  scoped.forEach((r) => {
    const key = r.extrasPiazzaZona ?? SIN_ZONA_KEY;
    const entry = totals.get(key) ?? {
      id: key,
      nombre: EXTRAS_PIAZZA_ZONA_LABELS[key] ?? "Sin zona",
      km: 0,
      servicios: 0,
    };
    entry.km += r.kilometros ?? r.kilometrosReales ?? 0;
    entry.servicios += 1;
    totals.set(key, entry);
  });

  return Array.from(totals.values()).sort((a, b) => b.km - a.km);
};

// reperibilidadNoDisponible solo cuenta si se marco HOY - un chofer que se marco "no
// disponible" ayer y se olvido de sacarlo no debe seguir apareciendo como no
// disponible indefinidamente. Exportada aparte (ademas de usarse dentro de
// computeReperibilidadPiazza) para que la UI pueda mostrar el mismo Si/No que
// terminaria calculando este archivo, sin duplicar el criterio de "hoy".
export const isReperibilidadNoDisponibleHoy = (user, now = new Date()) =>
  Boolean(
    user.reperibilidadNoDisponible && user.reperibilidadActualizada && isSameDay(user.reperibilidadActualizada, now)
  );

// DHL en Roma (a diferencia de Milano) tambien entra en Reperibilita - a proposito
// no se agrega AB Service ni DHL Milano aca (no hay AB Service en Roma, y sumar DHL
// Milano inundaria la lista con el historico que nunca tuvo Zona cargada, cambiando
// el comportamiento de Milano sin que se haya pedido). Exportada: el dashboard OWNER
// ("Piazza + DHL Roma") reusa el mismo criterio en vez de inventar uno propio.
export const isDhlRomaRecord = (r) => r.spedizzione === "DHL" && r.extrasPiazzaZona === "ROMA";

// Un chofer/vehiculo entra en Reperibilita si es de Extras Piazza (cualquier grupo,
// igual que siempre) o si es de DHL Y esta en el grupo Roma - mismo criterio que
// isDhlRomaRecord de arriba, aplicado a User/Vehiculo en vez de a Record.
const isReperibilidadElegible = (entity) =>
  entity.area === "EXTRAS_PIAZZA" || (entity.area === "DHL" && entity.grupo === "ROMA");

// Reperibilita de Extras Piazza + DHL Roma (vista "Resumen > Reperibilita"): servicios
// que todavia hay que completar hoy, mas quien esta disponible esta noche por si sale
// un pedido (choferes) o listo para salir (vehiculos).
export const computeReperibilidadPiazza = (records, users, vehicles, now = new Date()) => {
  // Mismo criterio que servicioActualPorChofer de abajo: un vehiculo con un servicio
  // IN_SOSPESO/RITIRATO ya esta afectado a ese servicio (aparece en "Servicios
  // pendientes"), no solo cuando esta IN_CONSEGNA - antes esto solo miraba IN_CONSEGNA,
  // asi que un vehiculo con un servicio pendiente todavia sin arrancar seguia
  // apareciendo como "disponible" en la lista de abajo.
  const enServicioAhoraVehicleIds = new Set(
    records.filter((r) => EN_PROCESO_STATUSES.includes(r.estado)).map((r) => r.vehicle?.id)
  );

  const serviciosPendientes = records
    .filter(
      (r) =>
        !isExtrasStefaniaRecord(r) &&
        (!isDhlAbRecord(r) || isDhlRomaRecord(r)) &&
        EN_PROCESO_STATUSES.includes(r.estado)
    )
    .sort((a, b) => new Date(a.eta) - new Date(b.eta));

  // Servicio en curso o pendiente de cada chofer (cualquier tipo, no solo Extras
  // Piazza) para mostrarlo inline en la tabla de "Choferes disponibles esta noche" -
  // el de ETA mas proxima si tiene mas de uno. No excluye a nadie de la tabla (ver
  // choferesPiazza abajo): un chofer con una consegna en curso ahora tambien tiene
  // que verse, con el dato de que esta ocupado en vez de directamente desaparecer.
  const servicioActualPorChofer = {};
  [...records]
    .filter((r) => r.driver?.id && EN_PROCESO_STATUSES.includes(r.estado))
    .sort((a, b) => new Date(a.eta) - new Date(b.eta))
    .forEach((r) => {
      if (!servicioActualPorChofer[r.driver.id]) servicioActualPorChofer[r.driver.id] = r;
    });

  const marcadoNoDisponibleHoy = (u) => isReperibilidadNoDisponibleHoy(u, now);

  // choferesPiazza: version "editable" (todos los activos elegibles - Extras Piazza de
  // cualquier grupo, o DHL del grupo Roma - con o sin servicio en curso) para la tabla
  // de Resumen > Reperibilita donde OWNER/ADMIN puede tocar el Si/No y el vehiculo
  // asignado de cada uno. choferesDisponibles/choferesNoDisponibles siguen aparte para
  // el resumen de texto (contadores y el aviso de "se marcaron no disponibles").
  // Sin filtro de cargo: OWNER/ADMIN tambien pueden salir a manejar un servicio, asi
  // que tienen que poder aparecer y asignarse como cualquier otro chofer.
  const choferesPiazza = users.filter((u) => u.estado === "ACTIVO" && isReperibilidadElegible(u));

  const choferesDisponibles = choferesPiazza.filter((u) => !marcadoNoDisponibleHoy(u));
  const choferesNoDisponibles = choferesPiazza.filter((u) => marcadoNoDisponibleHoy(u));

  const vehiculosDisponibles = vehicles.filter(
    (v) => isReperibilidadElegible(v) && v.estado === "DISPONIBLE" && !enServicioAhoraVehicleIds.has(v.id)
  );

  // Choferes de CUALQUIER area con una nota de servicio futuro cargada (ver "Agregar
  // chofer" en DailySummaryPage.jsx) - un aviso manual de que ese chofer va a tener
  // otra consegna, aunque todavia no exista un Registro formal para esa fecha.
  const choferesConServicioFuturo = users
    .filter((u) => u.estado === "ACTIVO" && u.proximoServicioFecha)
    .sort((a, b) => new Date(a.proximoServicioFecha) - new Date(b.proximoServicioFecha));

  return {
    serviciosPendientes,
    servicioActualPorChofer,
    choferesPiazza,
    choferesDisponibles,
    choferesNoDisponibles,
    vehiculosDisponibles,
    choferesConServicioFuturo,
  };
};

// Servicios en curso o pendientes cuya fecha de servicio ya paso sin cerrarse.
export const computeOverdueServices = (records, now = new Date()) =>
  records.filter(
    (r) =>
      (r.estado === "IN_CONSEGNA" || r.estado === "IN_SOSPESO") &&
      desdeCorte(r.fechaServicio) &&
      new Date(r.fechaServicio) < now
  );

// --- Notificaciones OWNER/ADMIN (campanita) ---------------------------------

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const DOCUMENT_WARNING_DAYS = 30;
const BIRTHDAY_WARNING_DAYS = 7;

const daysUntil = (dateValue, now) => (new Date(dateValue).getTime() - now.getTime()) / DAY_MS;

// Documentos de cualquier usuario (sin filtrar por cargo - OWNER/ADMIN tambien pueden
// manejar) que vencen dentro de 30 dias, o ya vencidos.
export const computeDriverDocumentAlerts = (documents, users, now = new Date(), { propio = false } = {}) => {
  const userIds = new Set(users.map((u) => u.id));

  return documents
    .filter((d) => d.fechaScadenza && userIds.has(d.usuarioId))
    .filter((d) => daysUntil(d.fechaScadenza, now) <= DOCUMENT_WARNING_DAYS)
    .sort((a, b) => new Date(a.fechaScadenza) - new Date(b.fechaScadenza))
    .map((d) => {
      const user = users.find((u) => u.id === d.usuarioId);
      const nombre = user ? `${user.nombre} ${user.apellido}` : "un chofer";
      const tipo = TIPO_DOCUMENTO_LABELS[d.tipoDocumento] ?? d.tipoDocumento;
      return {
        id: `driver-doc-${d.id}`,
        severity: "warning",
        // El chofer ve el suyo en primera persona y sin el link a la ficha de gestion (esa pantalla es de la oficina).
        message: propio ? `Tu ${tipo} vence el ${formatDate(d.fechaScadenza)}` : `${tipo} de ${nombre} vence el ${formatDate(d.fechaScadenza)}`,
        ...(propio ? {} : { link: `/choferes/${d.usuarioId}` }),
        date: d.fechaScadenza,
        // Grupo del chofer (Milano Nord/Sud/Roma/etc) - para poder filtrar por zona en
        // Resumen > Diario (ver DIARIO_ZONA_OPTIONS en DailySummaryPage.jsx). null si el
        // chofer no tiene grupo cargado.
        grupo: user?.grupo ?? null,
      };
    });
};

// Poliza de seguro y revision tecnica de cada vehiculo, mismo umbral de 30 dias.
export const computeVehicleDocumentAlerts = (vehicles, now = new Date()) => {
  const alerts = [];

  vehicles.forEach((v) => {
    if (v.poliza && daysUntil(v.poliza, now) <= DOCUMENT_WARNING_DAYS) {
      alerts.push({
        id: `vehicle-poliza-${v.id}`,
        severity: "warning",
        message: `Poliza de seguro de ${v.targa} vence el ${formatDate(v.poliza)}`,
        link: `/vehiculos/${v.id}`,
        date: v.poliza,
        grupo: v.grupo ?? null,
      });
    }
    if (v.rTecnica && daysUntil(v.rTecnica, now) <= DOCUMENT_WARNING_DAYS) {
      alerts.push({
        id: `vehicle-rtecnica-${v.id}`,
        severity: "warning",
        message: `Revision tecnica de ${v.targa} vence el ${formatDate(v.rTecnica)}`,
        link: `/vehiculos/${v.id}`,
        date: v.rTecnica,
        grupo: v.grupo ?? null,
      });
    }
  });

  return alerts.sort((a, b) => new Date(a.date) - new Date(b.date));
};

// Estado de Tagliando de un vehiculo puntual (mismos umbrales que la seccion Mecanica).
// Se expone aparte del listado para el aviso individual del chofer sobre "su" vehiculo.
// withLink=false para el chofer: la seccion Mecanica es solo OWNER/ADMIN, asi que no
// tiene sentido darle un link que lo termine mandando de vuelta al inicio.
export const getVehicleMaintenanceAlert = (vehicle, { withLink = true } = {}) => {
  const status = getTagliandoStatus(vehicle.kmUltimoMantenimiento, vehicle.kmActual);
  if (!status || status.level === "ok") return null;

  return {
    id: `vehicle-tagliando-${vehicle.id}`,
    severity: status.level === "urgente" ? "urgent" : "warning",
    message:
      status.level === "urgente"
        ? `${vehicle.targa} ya paso el km de Tagliando (${Math.round(status.usado).toLocaleString("es-AR")} km desde el ultimo mantenimiento).`
        : `${vehicle.targa} esta cerca del Tagliando: quedan ${Math.round(status.restante).toLocaleString("es-AR")} km.`,
    ...(withLink ? { link: "/mecanica" } : {}),
    grupo: vehicle.grupo ?? null,
  };
};

// Aviso de Tagliando de toda la flota, para la campanita OWNER/ADMIN (urgentes primero).
export const computeVehicleMaintenanceAlerts = (vehicles) =>
  vehicles
    .map(getVehicleMaintenanceAlert)
    .filter(Boolean)
    .sort((a, b) => (a.severity === "urgent" ? -1 : b.severity === "urgent" ? 1 : 0));

// Vehiculo sin autorizadoAreaC detectado adentro del Area C (ver AreaCEntry en el
// backend - se registra solo al consultar la posicion en vivo, ver
// checkAreaCEntries en vehicle.service.js). Urgente: en Milano hay que pagar el Area C
// el mismo dia o el siguiente, no despues.
// entries: ya vienen sin pagar (ver listUnpaidAreaCEntriesRequest) - dismissible:
// false a proposito, esta alerta no se "oculta" a mano, se resuelve marcando pagado en
// la seccion Area C de Finanzas (ahi desaparece sola, ver NotificationsBell.jsx).
export const computeAreaCAlerts = (entries) =>
  entries.map((entry) => ({
    id: `area-c-${entry.id}`,
    severity: "urgent",
    message: `${entry.targa} entro al Area C el ${formatDateTime(entry.enteredAt)} sin autorizacion - pagalo antes de que venza el plazo.`,
    link: "/finanzas/area-c",
    dismissible: false,
  }));

// Excesos de velocidad del propio chofer (los ultimos 7 dias): el aviso le llega solo al que iba al volante. La oficina no los recibe como
// notificacion: los consulta en Vehiculos > Avisos de velocidad.
export const computeMySpeedingAlerts = (events) =>
  events.map((event) => ({
    id: `speeding-${event.id}`,
    severity: "warning",
    message: `Superaste el limite de velocidad con ${event.targa}: ibas a ${Math.round(event.speedKmh)} km/h el ${formatDateTime(event.occurredAt)} (limite ${event.thresholdKmh} km/h).`,
  }));

// Choferes activos cuyo celular reporto que el permiso de ubicacion en segundo plano
// no esta en "Permitir todo el tiempo" (ver useLocationSharing). Urgente si en este
// momento tienen un servicio "en camino" (no se los puede rastrear ahora mismo),
// si no, queda como aviso para resolverlo antes del proximo servicio.
export const computeLocationPermissionAlerts = (users, records) => {
  const activeDriverIds = new Set(
    records.filter((r) => r.estado === "IN_CONSEGNA").map((r) => r.driver?.id)
  );

  return users
    .filter((u) => u.cargo === "CHOFER" && u.estado === "ACTIVO" && u.ubicacionPermisoDenegado)
    .map((u) => {
      const nombre = `${u.nombre} ${u.apellido}`;
      const isActiveNow = activeDriverIds.has(u.id);
      return {
        id: `location-permission-${u.id}`,
        severity: isActiveNow ? "urgent" : "warning",
        message: isActiveNow
          ? `${nombre} tiene un servicio en camino pero su GPS no comparte en segundo plano.`
          : `${nombre} no tiene el permiso de ubicacion en "Permitir todo el tiempo".`,
        link: `/choferes/${u.id}`,
        grupo: u.grupo ?? null,
      };
    });
};

// Proxima fecha en la que cumple anios (este anio si todavia no paso, si no el que viene).
const nextBirthday = (fechaNacimiento, now) => {
  const birth = new Date(fechaNacimiento);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next = new Date(now.getFullYear(), birth.getUTCMonth(), birth.getUTCDate());
  if (next < today) next.setFullYear(next.getFullYear() + 1);
  return next;
};

// Cumpleanios de cualquier usuario (chofer, admin u owner) dentro de los proximos 7 dias.
export const computeBirthdayAlerts = (users, now = new Date()) =>
  users
    .filter((u) => u.fechaNacimiento)
    .map((u) => ({ user: u, next: nextBirthday(u.fechaNacimiento, now) }))
    .filter(({ next }) => (next.getTime() - now.getTime()) / DAY_MS <= BIRTHDAY_WARNING_DAYS)
    .sort((a, b) => a.next - b.next)
    .map(({ user, next }) => ({
      id: `birthday-${user.id}`,
      severity: "reminder",
      message: isSameDay(next, now)
        ? `Hoy es el cumpleanios de ${user.nombre} ${user.apellido}`
        : `${user.nombre} ${user.apellido} cumple anios el ${formatDate(next)}`,
      link: user.cargo === "CHOFER" ? `/choferes/${user.id}` : undefined,
      date: next,
    }));


// ---------------------------------------------------------------------------
// Indicadores del dashboard OWNER (tarjetas, tabla por vehiculo, barras mensuales)
// ---------------------------------------------------------------------------

const isActiveRecord = (r) => r.estado !== "ANNULLATO";
// UN solo criterio de km para todo el dashboard (tarjeta, tarjetas por area, tabla por vehiculo y grafico de tendencia): los km reales
// si el chofer los cargo y, si no, los planificados contados como se facturan - DHL (Milano y Roma) y AB Service x2 (el cliente manda solo
// la ida), Extras Piazza x1. Ver kmRecorrido en lib/km.js. Antes estas partes usaban dos criterios distintos y no coincidian.
const realKm = (r) => kmRecorrido(r);
const uniqueCount = (list, pick) => new Set(list.map(pick).filter(Boolean)).size;

const KPI_METRICS = {
  servicios: (list) => list.length,
  km: (list) => list.reduce((sum, r) => sum + realKm(r), 0),
  clientes: (list) => uniqueCount(list, (r) => r.client?.id ?? r.clientId ?? r.client?.nombre),
  vehiculos: (list) => uniqueCount(list, (r) => r.vehicle?.id ?? r.vehicleId),
};

// Serie mensual (ene..mes en curso del anio calendario) de una metrica, para la
// mini-linea de cada tarjeta. Se queda con los ultimos `points` meses.
const monthlyMetricSeries = (records, metric, now, points = 7) => {
  const year = now.getFullYear();
  const buckets = Array.from({ length: 12 }, () => []);
  records.forEach((r) => {
    if (!isActiveRecord(r)) return;
    const date = new Date(r.fechaServicio);
    if (date.getFullYear() === year) buckets[date.getMonth()].push(r);
  });
  const upToNow = buckets.slice(0, now.getMonth() + 1).map(metric);
  return upToNow.slice(-points);
};

// Servicios / km / clientes / vehiculos del periodo elegido, con variacion contra el
// periodo anterior y una mini-serie mensual para la linea de fondo de cada tarjeta.
export const computePeriodKpis = (records, period, now = new Date(), selectedMonth = null) => {
  const current = records.filter(
    (r) => isActiveRecord(r) && isWithinPeriod(r.fechaServicio, period, now, selectedMonth)
  );
  const previous = records.filter(
    (r) => isActiveRecord(r) && isWithinPreviousPeriod(r.fechaServicio, period, now, selectedMonth)
  );

  return Object.fromEntries(
    Object.entries(KPI_METRICS).map(([key, metric]) => {
      const value = metric(current);
      return [
        key,
        {
          value,
          deltaPct: percentChange(value, metric(previous)),
          series: monthlyMetricSeries(records, metric, now),
        },
      ];
    })
  );
};

// Km por vehiculo en el periodo, con variacion contra el periodo anterior (tabla
// "Kilometros por vehiculo"). Mismo criterio de km que el resto del dashboard (ver realKm).
export const computeFleetKmTable = (records, period, now = new Date(), selectedMonth = null, limit = 5) => {
  const group = (list) => {
    const totals = new Map();
    list.forEach((r) => {
      if (!r.vehicle?.id) return;
      const entry = totals.get(r.vehicle.id) ?? {
        id: r.vehicle.id,
        targa: r.vehicle.targa,
        modelo: r.vehicle.modelo,
        km: 0,
      };
      entry.km += realKm(r);
      totals.set(r.vehicle.id, entry);
    });
    return totals;
  };

  const current = group(
    records.filter((r) => isActiveRecord(r) && isWithinPeriod(r.fechaServicio, period, now, selectedMonth))
  );
  const previous = group(
    records.filter(
      (r) => isActiveRecord(r) && isWithinPreviousPeriod(r.fechaServicio, period, now, selectedMonth)
    )
  );

  return Array.from(current.values())
    .sort((a, b) => b.km - a.km)
    .slice(0, limit)
    .map((row) => ({ ...row, deltaPct: percentChange(row.km, previous.get(row.id)?.km ?? 0) }));
};

// Las 5 areas que se muestran juntas en el dashboard y los rankings: DHL Milano, DHL Roma,
// Extras Piazza Milano, Extras Piazza Roma y AB Service. Deja afuera solo "Otros" (Extras
// Stefania). Reemplaza al criterio anterior (solo Piazza + DHL Roma): ahora DHL Milano y AB
// Service tambien cuentan.
export const filterToMainAreas = (records, areaKeys = null) =>
  areaKeys
    ? records.filter((r) => areaKeys.includes(classifyRecord(r)))
    : records.filter((r) => classifyRecord(r) !== "otros");

// Servicios, km y facturacion del periodo por area (bloque "Servicios por area").
export const computeAreaBreakdown = (records, period, now = new Date(), selectedMonth = null) => {
  const stats = Object.fromEntries(RECORD_AREAS.map((a) => [a.key, { count: 0, km: 0, facturacion: 0 }]));
  records
    .filter((r) => isActiveRecord(r) && isWithinPeriod(r.fechaServicio, period, now, selectedMonth))
    .forEach((r) => {
      const entry = stats[classifyRecord(r)];
      entry.count += 1;
      entry.km += realKm(r);
      entry.facturacion += recordRevenue(r);
    });
  return stats;
};

// Servicios por mes del anio en curso (Ene-Dic), para el grafico de barras apiladas: cada
// mes lleva el total (servicios) y el desglose por area (byArea).
export const computeMonthlyServicesTrend = (records, now = new Date()) => {
  const year = now.getFullYear();
  const buckets = MONTH_LABELS.map((month, index) => ({
    month,
    servicios: 0,
    byArea: Object.fromEntries(RECORD_AREAS.map((a) => [a.key, 0])),
    isCurrent: index === now.getMonth(),
  }));
  records.forEach((r) => {
    if (!isActiveRecord(r)) return;
    const date = new Date(r.fechaServicio);
    if (date.getFullYear() !== year) return;
    const bucket = buckets[date.getMonth()];
    bucket.servicios += 1;
    bucket.byArea[classifyRecord(r)] += 1;
  });
  return buckets;
};

// Multas para la campanita (ver getMultaAlertsForActor en el backend): vencidas, por vencer en
// 7 dias y, para la oficina, lo que falta descontar a los choferes. El chofer solo recibe las
// que tiene que pagar el mismo. Se muestran las primeras de cada grupo y un aviso con el resto.
export const computeMultaAlerts = (data, isPrivileged) => {
  if (!data) return [];
  const list = [];
  const who = (item) => (isPrivileged && item.chofer ? ` - ${item.chofer}` : "");
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  data.vencidas.items.forEach((item) => {
    const dias = -item.diasRestantes;
    list.push({
      id: `multa-vencida-${item.id}`,
      severity: "urgent",
      message: `La multa ${item.numeroVerbale} (${item.targa}${who(item)}) vencio hace ${plural(dias, "dia", "dias")} - ${formatCurrency(item.costo)}.`,
      link: `/finanzas/multas/${item.id}`,
    });
  });
  const vencidasRestantes = data.vencidas.count - data.vencidas.items.length;
  if (vencidasRestantes > 0) {
    list.push({
      id: "multas-vencidas-mas",
      severity: "urgent",
      message: `Hay ${plural(vencidasRestantes, "multa vencida mas", "multas vencidas mas")}.`,
      link: "/finanzas/multas",
    });
  }

  data.porVencer.items.forEach((item) => {
    const cuando = item.diasRestantes === 0 ? "vence hoy" : `vence en ${plural(item.diasRestantes, "dia", "dias")}`;
    list.push({
      id: `multa-por-vencer-${item.id}`,
      severity: item.diasRestantes <= 2 ? "urgent" : "warning",
      message: `La multa ${item.numeroVerbale} (${item.targa}${who(item)}) ${cuando} - ${formatCurrency(item.costo)}.`,
      link: `/finanzas/multas/${item.id}`,
    });
  });
  const porVencerRestantes = data.porVencer.count - data.porVencer.items.length;
  if (porVencerRestantes > 0) {
    list.push({
      id: "multas-por-vencer-mas",
      severity: "warning",
      message: `Hay ${plural(porVencerRestantes, "multa mas que vence", "multas mas que vencen")} en los proximos 7 dias.`,
      link: "/finanzas/multas",
    });
  }

  if (isPrivileged && data.aDescontar.count > 0) {
    list.push({
      // El id cambia con la cantidad: si aparecen mas descuentos, vuelve a mostrarse aunque se haya descartado.
      id: `multas-descuento-${data.aDescontar.count}`,
      severity: "reminder",
      message: `Faltan descontar ${formatCurrency(data.aDescontar.total)} a los choferes (${plural(data.aDescontar.count, "multa", "multas")}).`,
      link: "/finanzas/multas",
    });
  }

  return list;
};
