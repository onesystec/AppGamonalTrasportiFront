import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { KpiTarjeta, PendientesHoy, ResumenMes } from "../../components/cliente/DashboardCliente";
import { AREAS, diaRoma, filasRegistro, FILTROS } from "../../components/cliente/RegistroLista";
import { MonthSelector } from "../../components/finanzas/MonthSelector";
import { Alert } from "../../components/ui/Alert";
import { PageLoader } from "../../components/ui/PageLoader";
import { AlertTriangleIcon, CheckCircleIcon, ClipboardListIcon, ExternalLinkIcon, FileTextIcon, RouteIcon, TruckIcon } from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { useLanguage, useT } from "../../i18n/index.jsx";
import { parseApiError } from "../../lib/api";
import { getClienteSeguimientoRequest, getClienteServiciosRequest } from "../../lib/cliente.api";
import { currentMonth } from "../../lib/finanzas";
import { startVisibleInterval } from "../../lib/polling";
import { listSolicitudesClienteRequest } from "../../lib/solicitudes.api";

const REFRESH_MS = 60 * 1000;

const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

// Dashboard del cliente (Piazza): indicadores del mes, resumen por area y pendientes de hoy. Usa los mismos datos que el Registro (solicitudes, servicios hechos y
// seguimiento), asi que necesita el modulo REGISTRO ademas de DASHBOARD.
export const ClienteDashboardPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const verHistorial = Boolean(user?.clienteModulos?.includes("HISTORIAL"));
  const verSeguimiento = Boolean(user?.clienteModulos?.some((m) => m === "MAPA" || m === "LISTA"));
  const [month, setMonth] = useState(currentMonth);
  const [filas, setFilas] = useState(null); // filas del mes elegido
  const [filasHoy, setFilasHoy] = useState(null); // filas del mes en curso (los pendientes de hoy salen de ahi)
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
    return Promise.all([cargarMes(month), month === actual ? null : cargarMes(actual)])
      .then(([delMes, delActual]) => {
        setFilas(delMes);
        setFilasHoy(delActual ?? delMes);
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
  const total = filas?.length ?? 0;
  const totalKm = Object.values(stats).reduce((sum, s) => sum + s.km, 0);

  const kpi = useMemo(() => {
    const lista = filas ?? [];
    const llegadas = lista.filter((f) => f.llegoAt);
    const puntuales = llegadas.filter((f) => f.retraso == null).length;
    return {
      entregados: lista.filter(FILTROS.done.coincide).length,
      enViaje: lista.filter((f) => f.fase === "IN_VIAGGIO").length,
      retraso: lista.filter(FILTROS.late.coincide).length,
      porCompletar: lista.filter(FILTROS.incomplete.coincide).length,
      puntualidad: llegadas.length > 0 ? Math.round((puntuales / llegadas.length) * 100) : null,
      llegadas: llegadas.length,
    };
  }, [filas]);

  const hoy = diaRoma(new Date().toISOString());
  const pendientesHoy = useMemo(
    () =>
      (filasHoy ?? [])
        .filter((f) => f.dia === hoy && f.pendiente && (!areaKey || f.area === areaKey))
        .sort((a, b) => new Date(a.eta ?? 0) - new Date(b.eta ?? 0)),
    [filasHoy, hoy, areaKey]
  );

  if (!user?.clienteModulos?.includes("DASHBOARD") || !user?.clienteModulos?.includes("REGISTRO")) return <Navigate to="/cliente" replace />;

  const nombreMes = mayuscula(new Date(`${month}-15T12:00:00Z`).toLocaleDateString(language === "it" ? "it-IT" : "es-AR", { month: "long", year: "numeric", timeZone: "UTC" }));
  const irAlRegistro = (state) => navigate("/cliente/registro", { state });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-50">{t("dash.title")}</h1>
          <p className="text-[13px] text-ink-300">{t("dash.subtitle")}</p>
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
          <p className="-mb-1 text-[12px] font-medium uppercase tracking-wide text-ink-400">{nombreMes}</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiTarjeta icon={ClipboardListIcon} label={t("dash.kpi.total")} value={total} onClick={() => irAlRegistro()} />
            <KpiTarjeta icon={CheckCircleIcon} label={t("dash.kpi.done")} value={kpi.entregados} tono="bien" />
            <KpiTarjeta icon={TruckIcon} label={t("dash.kpi.transit")} value={kpi.enViaje} tono={kpi.enViaje > 0 ? "info" : "neutro"} />
            <KpiTarjeta icon={AlertTriangleIcon} label={t("dash.kpi.late")} value={kpi.retraso} tono={kpi.retraso > 0 ? "malo" : "neutro"} />
            <KpiTarjeta icon={FileTextIcon} label={t("dash.kpi.incomplete")} value={kpi.porCompletar} tono={kpi.porCompletar > 0 ? "aviso" : "neutro"} />
            <KpiTarjeta
              icon={RouteIcon}
              label={t("dash.kpi.punctual")}
              value={kpi.puntualidad == null ? "—" : `${kpi.puntualidad}%`}
              tono={kpi.puntualidad == null ? "neutro" : kpi.puntualidad >= 90 ? "bien" : kpi.puntualidad >= 75 ? "aviso" : "malo"}
              nota={kpi.llegadas > 0 ? t("dash.kpi.punctualNote", { count: kpi.llegadas }) : undefined}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
            <ResumenMes stats={stats} total={total} totalKm={totalKm} areaKey={areaKey} onArea={setAreaKey} />
            <PendientesHoy filas={pendientesHoy} />
          </div>
        </>
      )}
    </div>
  );
};
