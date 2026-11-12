import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ActividadReciente, EvolucionMensual, KpiTarjeta, PendientesHoy, ResumenMes, Variacion } from "../../components/cliente/DashboardCliente";
import { AREAS, diaRoma, filasRegistro, FILTROS } from "../../components/cliente/RegistroLista";
import { MonthSelector } from "../../components/finanzas/MonthSelector";
import { Alert } from "../../components/ui/Alert";
import { PageLoader } from "../../components/ui/PageLoader";
import { CheckCircleIcon, ClipboardListIcon, ExternalLinkIcon, TargetIcon } from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { useT } from "../../i18n/index.jsx";
import { parseApiError } from "../../lib/api";
import { getClienteActividadRequest, getClienteSeguimientoRequest, getClienteServiciosRequest } from "../../lib/cliente.api";
import { currentMonth } from "../../lib/finanzas";
import { startVisibleInterval } from "../../lib/polling";
import { listSolicitudesClienteRequest } from "../../lib/solicitudes.api";

const REFRESH_MS = 60 * 1000;

const mesAnterior = (month) => {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

// Numeros del mes: servicios, entregados y puntualidad (% de llegadas a tiempo; null si todavia no hay llegadas).
const resumenDe = (filas) => {
  const llegadas = filas.filter((f) => f.llegoAt);
  const puntuales = llegadas.filter((f) => f.retraso == null).length;
  return {
    total: filas.length,
    entregados: filas.filter(FILTROS.done.coincide).length,
    puntualidad: llegadas.length > 0 ? Math.round((puntuales / llegadas.length) * 100) : null,
    llegadas: llegadas.length,
  };
};

// Dashboard del cliente (Piazza), centrado en sus servicios: indicadores del mes contra el anterior, evolucion diaria, actividad reciente, resumen por area y
// pendientes de hoy. Usa los mismos datos que el Registro (solicitudes, servicios hechos y seguimiento), asi que necesita el modulo REGISTRO ademas de DASHBOARD.
export const ClienteDashboardPage = () => {
  const t = useT();
  const navigate = useNavigate();
  const { user } = useAuth();
  const verHistorial = Boolean(user?.clienteModulos?.includes("HISTORIAL"));
  const verSeguimiento = Boolean(user?.clienteModulos?.some((m) => m === "MAPA" || m === "LISTA"));
  const [month, setMonth] = useState(currentMonth);
  const [filas, setFilas] = useState(null); // filas del mes elegido
  const [filasPrevias, setFilasPrevias] = useState(null); // filas del mes anterior (para las variaciones)
  const [filasHoy, setFilasHoy] = useState(null); // filas del mes en curso (los pendientes de hoy salen de ahi)
  const [eventos, setEventos] = useState(null);
  const [areaKey, setAreaKey] = useState(null);
  const [error, setError] = useState("");

  const cargarMes = useCallback(
    (mes) =>
      Promise.all([
        listSolicitudesClienteRequest(mes),
        verHistorial ? getClienteServiciosRequest(mes).then((r) => r.servicios).catch(() => []) : Promise.resolve([]),
        verSeguimiento ? getClienteSeguimientoRequest().catch(() => null) : Promise.resolve(null),
      ]).then(([solicitudes, servicios, seguimiento]) => filasRegistro({ solicitudes, servicios, seguimiento, ahora: Date.now() })),
    [verHistorial, verSeguimiento]
  );

  const load = useCallback(() => {
    const actual = currentMonth();
    return Promise.all([
      cargarMes(month),
      cargarMes(mesAnterior(month)).catch(() => null),
      month === actual ? null : cargarMes(actual),
      // Si la actividad falla, el resto del dashboard se sigue viendo.
      getClienteActividadRequest().catch(() => []),
    ])
      .then(([delMes, previas, delActual, actividad]) => {
        setFilas(delMes);
        setFilasPrevias(previas);
        setFilasHoy(delActual ?? delMes);
        setEventos(actividad);
        setError("");
      })
      .catch((err) => setError(parseApiError(err).message));
  }, [month, cargarMes]);

  useEffect(() => {
    setFilas(null);
    load();
    return startVisibleInterval(load, REFRESH_MS);
  }, [load]);

  const stats = useMemo(() => {
    const out = Object.fromEntries(AREAS.map((a) => [a.key, { count: 0, km: 0 }]));
    for (const f of filas ?? []) {
      out[f.area].count += 1;
      out[f.area].km += parseFloat(String(f.km ?? "").replace(",", ".")) || 0;
    }
    return out;
  }, [filas]);
  const totalKm = Object.values(stats).reduce((sum, s) => sum + s.km, 0);

  const actual = useMemo(() => resumenDe(filas ?? []), [filas]);
  const previo = useMemo(() => (filasPrevias ? resumenDe(filasPrevias) : null), [filasPrevias]);

  // Un punto por semana del mes (de lunes a domingo; los dias anteriores al primer lunes forman la primera): servicios de la semana y los ya entregados. "dia" es
  // el dia del mes en que empieza la semana.
  const evolucion = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const dias = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const semanas = [];
    for (let dia = 1; dia <= dias; dia++) {
      const iso = `${month}-${String(dia).padStart(2, "0")}`;
      if (dia === 1 || new Date(`${iso}T12:00:00Z`).getUTCDay() === 1) semanas.push({ dia, servicios: 0, entregados: 0 });
      const actual = semanas[semanas.length - 1];
      for (const f of filas ?? []) {
        if (f.dia !== iso) continue;
        actual.servicios += 1;
        if (FILTROS.done.coincide(f)) actual.entregados += 1;
      }
    }
    return semanas;
  }, [filas, month]);

  const hoy = diaRoma(new Date().toISOString());
  const pendientesHoy = useMemo(
    () =>
      (filasHoy ?? [])
        .filter((f) => f.dia === hoy && f.pendiente && (!areaKey || f.area === areaKey))
        .sort((a, b) => new Date(a.eta ?? 0) - new Date(b.eta ?? 0)),
    [filasHoy, hoy, areaKey]
  );

  if (!user?.clienteModulos?.includes("DASHBOARD") || !user?.clienteModulos?.includes("REGISTRO")) return <Navigate to="/cliente" replace />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold text-ink-50">{t("dash.title")}</h1>
          <p className="text-[14px] text-ink-300">{t("dash.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthSelector month={month} onChange={setMonth} allowFuture />
          <Link
            to="/cliente/registro"
            className="inline-flex items-center gap-2 rounded-xl border border-line/25 px-4 py-2.5 text-[13px] font-semibold text-ink-100 transition hover:bg-line/10"
          >
            <ExternalLinkIcon className="h-4 w-4" />
            {t("dash.openRegister")}
          </Link>
        </div>
      </div>

      <Alert>{error}</Alert>
      {!filas && !error && <PageLoader />}
      {filas && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiTarjeta icon={ClipboardListIcon} label={t("dash.kpi.total")} value={actual.total} onClick={() => navigate("/cliente/registro")}>
              <Variacion actual={actual.total} previo={previo?.total} />
            </KpiTarjeta>
            <KpiTarjeta icon={CheckCircleIcon} label={t("dash.kpi.done")} value={actual.entregados} tono="bien">
              <Variacion actual={actual.entregados} previo={previo?.entregados} />
            </KpiTarjeta>
            <KpiTarjeta icon={TargetIcon} label={t("dash.kpi.punctual")} value={actual.puntualidad == null ? "—" : `${actual.puntualidad}%`}>
              <Variacion actual={actual.puntualidad} previo={previo?.puntualidad} puntos />
            </KpiTarjeta>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] xl:items-start">
            <EvolucionMensual datos={evolucion} mes={month} />
            <ActividadReciente eventos={eventos} />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
            <ResumenMes stats={stats} total={actual.total} totalKm={totalKm} areaKey={areaKey} onArea={setAreaKey} />
            <PendientesHoy filas={pendientesHoy} />
          </div>
        </>
      )}
    </div>
  );
};
