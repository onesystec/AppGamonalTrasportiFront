import { FinanceRecordLink } from "../../components/finanzas/FinanceRecordLink";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { MancatoKpi } from "../../components/mancato/MancatoKpi";
import { Alert } from "../../components/ui/Alert";
import { PageLoader } from "../../components/ui/PageLoader";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { TextField } from "../../components/ui/TextField";
import { AlertTriangleIcon, CheckCircleIcon, ClockIcon, RouteIcon } from "../../components/ui/icons";
import { parseApiError } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { GpsEstadoBanner } from "../../components/gps/GpsEstadoBanner";
import { RetornoCard } from "../../components/gps/RetornoCard";
import { fuenteLabel } from "../../lib/gps";
import { PARADA_CLASES, formatDuration, mapsLink, romeDay, romeHHMM } from "../../lib/paradas";
import { getParadasEstadoRequest, listParadasRequest } from "../../lib/paradas.api";

const FILTERS = [
  { value: "TODAS", label: "Todas" },
  { value: "A_REVISAR", label: "A revisar" },
  { value: "SERVICIO", label: "Servicio" },
  { value: "COMBUSTIBLE", label: "Combustible" },
  { value: "TOLERADA", label: "Toleradas" },
];

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
const daysAgo = (n) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });

const ClaseChip = ({ clase }) => {
  const c = PARADA_CLASES[clase] ?? PARADA_CLASES.TOLERADA;
  return (
    <span title={c.hint} className={clsx("inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", c.pill)}>
      {c.label}
    </span>
  );
};

// Paradas del vehiculo registradas con el GPS mientras tenia un servicio activo. Por ahora son
// solo informativas: sirven para ver si la tolerancia y las reglas de clasificacion son justas
// antes de usarlas en la aprobacion de horas.
export const ParadasPage = () => {
  const [from, setFrom] = useState(() => daysAgo(6));
  const [to, setTo] = useState(today);
  const [clase, setClase] = useState("TODAS");
  const [data, setData] = useState(null);
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setData(null);
    listParadasRequest({ from, to })
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  useEffect(() => {
    getParadasEstadoRequest()
      .then(setEstado)
      .catch(() => {});
  }, []);

  // El servidor trae un dia de margen a cada lado; el filtro fino es por dia de Roma.
  const inRange = useMemo(
    () => (data?.items ?? []).filter((i) => romeDay(i.inicio) >= from && romeDay(i.inicio) <= to),
    [data, from, to]
  );
  const stats = useMemo(() => {
    const by = (key) => inRange.filter((i) => i.clase === key);
    const minutes = (list) => list.reduce((sum, i) => sum + (i.duracionMin ?? 0), 0);
    return {
      revisar: by("A_REVISAR"),
      servicio: by("SERVICIO"),
      combustible: by("COMBUSTIBLE"),
      tolerada: by("TOLERADA"),
      minutes,
    };
  }, [inRange]);
  const visible = clase === "TODAS" ? inRange : inRange.filter((i) => i.clase === clase);

  return (
    <div className="flex flex-col gap-5">
      <GpsEstadoBanner showOk />
      <RetornoCard />
      <div className="flex items-start gap-2.5 rounded-xl bg-accent-500/10 px-4 py-3 text-[13px] text-ink-200">
        <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" />
        <span>
          <b className="text-ink-50">En pruebas:</b> estas paradas todavia no afectan el pago de nadie. Se
          calculan con el GPS solo entre el inicio y el fin de la jornada que declara el chofer (paradas de mas
          de {estado?.minimoMin ?? 5} min; hasta {estado?.toleranciaMin ?? 15} min se aceptan sin revision).
          {estado && !estado.configurado && (
            <span className="mt-1 block font-medium text-warning-500">
              Falta conectar el GPS: el backend necesita ONESYSTEC_BASE_URL y ONESYSTEC_API_KEY.
            </span>
          )}
          {estado?.configurado && estado.lugaresDeTrabajo === 0 && (
            <span className="mt-1 block text-ink-400">
              Todavia no hay lugares de trabajo configurados (aparte del deposito): una parada en el
              aparcamiento de la empresa se marcaria &quot;a revisar&quot;.
            </span>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <TextField id="paradas-desde" label="Desde" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          <TextField id="paradas-hasta" label="Hasta" type="date" value={to} min={from} max={today()} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </div>
        <SegmentedControl options={FILTERS} value={clase} onChange={setClase} className="max-w-full overflow-x-auto" />
      </div>

      <Alert>{error}</Alert>
      {!data && !error && <PageLoader />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <MancatoKpi
              icon={AlertTriangleIcon}
              label="A revisar"
              value={stats.revisar.length}
              detail={formatDuration(stats.minutes(stats.revisar))}
              color="#ff8a1a"
            />
            <MancatoKpi
              icon={RouteIcon}
              label="En el servicio"
              value={stats.servicio.length}
              detail={formatDuration(stats.minutes(stats.servicio))}
              color="#22e093"
            />
            <MancatoKpi
              icon={ClockIcon}
              label="Combustible"
              value={stats.combustible.length}
              detail={formatDuration(stats.minutes(stats.combustible))}
              color="#2f8dff"
            />
            <MancatoKpi
              icon={CheckCircleIcon}
              label="Toleradas"
              value={stats.tolerada.length}
              detail={formatDuration(stats.minutes(stats.tolerada))}
              color="#8ea3c9"
            />
          </div>

          {visible.length === 0 ? (
            <p className="px-1 py-6 text-[14px] text-ink-400">No hay paradas registradas en este periodo.</p>
          ) : (
            <div className="glass-surface rounded-2xl p-2 sm:p-3">
              <div className="hidden gap-3 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-400 lg:grid lg:grid-cols-[90px_90px_minmax(0,1fr)_130px_90px_110px_80px]">
                <span>Dia</span>
                <span>Vehiculo</span>
                <span>Chofer / servicio</span>
                <span>Horario</span>
                <span>Duracion</span>
                <span>Clase</span>
                <span className="text-right">Lugar</span>
              </div>
              {visible.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg px-4 py-2.5 lg:grid-cols-[90px_90px_minmax(0,1fr)_130px_90px_110px_80px] lg:items-center lg:border-b lg:border-b-line/10"
                >
                  <span className="text-[13px] text-ink-50">{formatDate(p.inicio)}</span>
                  <span className="text-[13px] font-medium text-ink-50">{p.targa}</span>
                  <div className="col-span-2 min-w-0 lg:col-span-1">
                    <span className="block truncate text-[13px] text-ink-50">{p.chofer ?? "Sin chofer"}</span>
                    {p.codigo && (
                      <FinanceRecordLink to={`/records/${p.recordId}`} className="block truncate text-[12px] text-accent-400 hover:text-accent-300">
                        {p.codigo}
                      </FinanceRecordLink>
                    )}
                  </div>
                  <span className="text-[13px] text-ink-200">
                    {romeHHMM(p.inicio)} &rarr; {p.fin ? romeHHMM(p.fin) : "en curso"}
                  </span>
                  <span className="text-[13px] font-medium text-ink-50">{formatDuration(p.duracionMin)}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ClaseChip clase={p.clase} />
                    {p.motorApagado && <span className="text-[11px] text-ink-400" title="Motor apagado">motor off</span>}
                    {fuenteLabel(p.fuente) && (
                      <span className="rounded-full bg-warning-500/15 px-2 py-0.5 text-[10px] font-semibold text-warning-500" title="Calculada con el GPS del celular del chofer: menos precisa que la del vehiculo">
                        {fuenteLabel(p.fuente)}
                      </span>
                    )}
                  </div>
                  <a
                    href={mapsLink(p.lat, p.lng)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] font-medium text-accent-400 hover:text-accent-300 lg:text-right"
                  >
                    Ver mapa
                  </a>
                </div>
              ))}
            </div>
          )}
          <p className="px-1 text-[12px] text-ink-400">
            Se muestran hasta 500 paradas por consulta. Las paradas se borran solas a los 90 dias.
          </p>
        </>
      )}
    </div>
  );
};
