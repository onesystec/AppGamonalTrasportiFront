import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useOutletContext } from "react-router-dom";
import { HorasEstadoChip } from "../../components/horas/HorasEstadoChip";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { PageLoader } from "../../components/ui/PageLoader";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { AlertTriangleIcon, CheckCircleIcon } from "../../components/ui/icons";
import { TextField } from "../../components/ui/TextField";
import { Textarea } from "../../components/ui/Textarea";
import { parseApiError } from "../../lib/api";
import { CircuitoDetalle } from "../../components/records/CircuitoDetalle";
import { KmViajeResumen } from "../../components/records/KmViajeResumen";
import { formatCurrency, formatDate, formatRomeDateTime, toRomeDateTimeInputValue } from "../../lib/format";
import { formatHours } from "../../lib/horas";
import { listHorasPendientesRequest, recalcParadasRequest, recalcEstimacionRequest, reviewHorasRequest } from "../../lib/horas.api";
import { GpsEstadoBanner } from "../../components/gps/GpsEstadoBanner";
import { fuenteLabel } from "../../lib/gps";
import { PARADA_CLASES, formatDuration, mapsLink, romeHHMM } from "../../lib/paradas";

const Fact = ({ label, children }) => (
  <div className="min-w-0">
    <span className="block text-[11px] uppercase tracking-wide text-ink-400">{label}</span>
    <span className="block text-[14px] font-medium text-ink-50">{children}</span>
  </div>
);

// Paradas del vehiculo durante la jornada declarada (GPS). Informativas: la oficina decide si
// descuenta algo. "A revisar" = parada larga lejos de las paradas del servicio.
const ParadasBlock = ({ recordId, paradas, calculadasAt, hasJornada, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const recalc = async () => {
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const result = await recalcParadasRequest(recordId);
      if (result.gpsError) setInfo(`No hay datos de GPS (${result.gpsError}). Abajo se muestra la estimacion por ruta.`);
      onUpdate(result);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  if (!hasJornada) return null;
  const revisar = paradas.filter((p) => p.clase === "A_REVISAR");
  const revisarMin = revisar.reduce((sum, p) => sum + p.duracionMin, 0);

  return (
    <div className="mt-4 rounded-xl glass-surface-sm p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-ink-50">
          Paradas del vehiculo en la jornada
          {calculadasAt && revisar.length > 0 && (
            <span className="ml-2 font-normal text-warning-500">
              {revisar.length} a revisar &middot; {formatDuration(revisarMin)}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={recalc}
          disabled={loading}
          className="text-[12px] font-medium text-accent-400 hover:text-accent-300 disabled:opacity-50"
        >
          {loading ? "Calculando..." : calculadasAt ? "Actualizar" : "Calcular ahora"}
        </button>
      </div>
      <Alert>{error}</Alert>
      {info && <p className="mt-1.5 text-[12px] text-warning-500">{info}</p>}
      {!calculadasAt && !error && !info && (
        <p className="mt-1.5 text-[12px] text-ink-400">
          Todavia no se calcularon. Se calculan solas al enviar el chofer sus horas; si no aparecen en unos
          segundos, usa &quot;Calcular ahora&quot;.
        </p>
      )}
      {calculadasAt && paradas.length === 0 && (
        <p className="mt-1.5 text-[12px] text-ink-400">No hubo paradas de mas de 5 minutos.</p>
      )}
      {paradas.length > 0 && (
        <ul className="mt-2 flex flex-col divide-y divide-line/10">
          {paradas.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-[12px]">
              <span className="w-[104px] shrink-0 text-ink-200">
                {romeHHMM(p.inicio)} &rarr; {p.fin ? romeHHMM(p.fin) : "?"}
              </span>
              <span className="w-[78px] shrink-0 font-medium text-ink-50">{formatDuration(p.duracionMin)}</span>
              <span
                title={PARADA_CLASES[p.clase]?.hint}
                className={clsx(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  PARADA_CLASES[p.clase]?.pill
                )}
              >
                {PARADA_CLASES[p.clase]?.label ?? p.clase}
              </span>
              {fuenteLabel(p.fuente) && (
                <span className="shrink-0 rounded-full bg-warning-500/15 px-2 py-0.5 text-[10px] font-semibold text-warning-500" title="Calculada con el GPS del celular del chofer: menos precisa que la del vehiculo">
                  {fuenteLabel(p.fuente)}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-ink-400">{p.motivo}</span>
              <a
                href={mapsLink(p.lat, p.lng)}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 font-medium text-accent-400 hover:text-accent-300"
              >
                Mapa
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Fin de la jornada segun el GPS: cuando el vehiculo dejo de moverse (y cuando salio, si empezo parado
// fuera de un lugar de trabajo) contra lo que declaro el chofer, y la regla del tope si termino sin pasar
// por el lugar de espera.
const FinGpsBlock = ({ gps, declaredFin, declaredStart, finFueraDeBase, onApplyCap }) => {
  if (!gps) return null;
  const diffMin = gps.ultimoMovimientoAt
    ? Math.round((new Date(gps.ultimoMovimientoAt) - new Date(declaredFin)) / 60000)
    : null;
  const overCap =
    finFueraDeBase && gps.topeFinAt && new Date(declaredFin).getTime() > new Date(gps.topeFinAt).getTime() + 15 * 60000;
  const startDiff = gps.salidaAt ? Math.round((new Date(gps.salidaAt) - new Date(declaredStart)) / 60000) : null;

  const Row = ({ label, children }) => (
    <div className="flex flex-wrap gap-x-2 text-[12px]">
      <span className="w-[150px] shrink-0 text-ink-400">{label}</span>
      <span className="min-w-0 flex-1 text-ink-100">{children}</span>
    </div>
  );

  return (
    <div className="mt-4 rounded-xl glass-surface-sm p-3.5">
      <span className="text-[13px] font-semibold text-ink-50">Inicio y fin segun el GPS</span>
      <div className="mt-2 flex flex-col gap-1.5">
        {gps.salidaAt && (
          <Row label="Salida del vehiculo">
            {romeHHMM(gps.salidaAt)}{" "}
            <span className={startDiff > 20 ? "text-warning-500" : "text-ink-400"}>
              (inicio declarado {romeHHMM(declaredStart)}
              {startDiff > 20 ? `, ${formatDuration(startDiff)} despues` : ""})
            </span>
          </Row>
        )}
        <Row label="Dejo de moverse">
          {gps.ultimoMovimientoAt ? (
            <>
              {gps.continuaMoviendo ? "seguia circulando al terminar de mirar" : romeHHMM(gps.ultimoMovimientoAt)}{" "}
              <span
                className={
                  gps.continuaMoviendo || diffMin > 15 || diffMin < -30 ? "text-warning-500" : "text-success-500"
                }
              >
                (fin declarado {romeHHMM(declaredFin)}
                {gps.continuaMoviendo
                  ? ""
                  : diffMin > 15
                    ? `, circulo ${formatDuration(diffMin)} mas`
                    : diffMin < -30
                      ? `, paro ${formatDuration(-diffMin)} antes`
                      : ", coincide"}
                )
              </span>
            </>
          ) : (
            "sin movimiento registrado"
          )}
        </Row>
        {finFueraDeBase && (
          <Row label="Termino fuera de la base">
            {gps.topeFinAt ? (
              <>
                ultima entrega {romeHHMM(gps.ultimaEntregaAt)}; volver a {gps.base} habria tardado{" "}
                {formatDuration(gps.vueltaMin)}
                {gps.vueltaFuente === "estimada" ? " (estimado)" : ""} &rarr; tope{" "}
                <b className={overCap ? "text-warning-500" : "text-success-500"}>{romeHHMM(gps.topeFinAt)}</b>
                {overCap ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={onApplyCap}
                      className="font-medium text-accent-400 hover:text-accent-300"
                    >
                      Aplicar tope
                    </button>
                  </>
                ) : (
                  " (dentro del tope)"
                )}
              </>
            ) : (
              "no se pudo calcular el tope (no se detecto la ultima entrega en el GPS)"
            )}
          </Row>
        )}
      </div>
    </div>
  );
};

// Estimacion por ruta (sin GPS del vehiculo ni del celular): hora de retiro + paradas + retorno. Es una
// referencia razonable para contrastar lo declarado, no un dato medido.
const EstimacionBlock = ({ recordId, estimacion, declaredMin, onUpdate, onApplyEnd }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const recalc = async () => {
    setLoading(true);
    setError("");
    try {
      onUpdate(await recalcEstimacionRequest(recordId));
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const Row = ({ label, children }) => (
    <div className="flex flex-wrap gap-x-2 text-[12px]">
      <span className="w-[150px] shrink-0 text-ink-400">{label}</span>
      <span className="min-w-0 flex-1 text-ink-100">{children}</span>
    </div>
  );

  const e = estimacion;
  const diff = e && declaredMin != null ? Math.round(declaredMin - e.totalMin) : null;
  const off = diff != null && (diff > e.totalMin * 0.25 + 45 || (diff < -e.totalMin * 0.25 && diff < -45));

  return (
    <div className="mt-4 rounded-xl glass-surface-sm p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-ink-50">
          Estimacion por ruta <span className="font-normal text-ink-400">(sin GPS)</span>
        </span>
        <button type="button" onClick={recalc} disabled={loading} className="text-[12px] font-medium text-accent-400 hover:text-accent-300 disabled:opacity-50">
          {loading ? "Calculando..." : e ? "Recalcular" : "Calcular estimacion"}
        </button>
      </div>
      <Alert>{error}</Alert>
      {!e && !error && (
        <p className="mt-1.5 text-[12px] text-ink-400">
          Sin datos de GPS. Se puede estimar el tiempo con la hora de retiro, las paradas del servicio y el retorno.
        </p>
      )}
      {e && (
        <div className="mt-2 flex flex-col gap-1.5">
          <Row label="Salida">
            {romeHHMM(e.inicioAt)} desde {e.salida}
            {e.retiros?.length > 0 && <> &rarr; retiro en {e.retiros.join(" y ")}</>}
            {e.inicioInferido && <span className="text-warning-500"> (deducido de la ETA: falta la hora de retiro)</span>}
          </Row>
          {e.viaje && (
            <Row label="Viaje compacto">
              {e.viaje.length} servicios en un solo circuito, sin volver entre una entrega y la siguiente
            </Row>
          )}
          <Row label="Hasta la entrega final">
            conduccion {formatDuration(e.conduccionIdaMin)}
            {e.distanciaIdaKm != null && ` (${e.distanciaIdaKm} km)`} + {e.paradas} {e.paradas === 1 ? "parada" : "paradas"} (
            {formatDuration(e.paradasMin)}) &rarr; ultima entrega ~<b>{romeHHMM(e.ultimaEntregaAt)}</b>
          </Row>
          <Row label="Retorno">
            a {e.retorno.nombre}: {formatDuration(e.conduccionVueltaMin)}
            {e.rutaFuente === "estimada" ? " (estimado en linea recta)" : ""}
          </Row>
          {e.circuitoKm != null && (
            <Row label="Circuito planificado">
              <b>{e.circuitoKm} km</b> en total (ida y vuelta al lugar de espera): lo que se compara con los km declarados
            </Row>
          )}
          <Row label="Descansos supuestos">{e.descansosMin > 0 ? formatDuration(e.descansosMin) : "ninguno (trayecto corto)"}</Row>
          <Row label="Total estimado">
            <b>{formatDuration(e.totalMin)}</b> &rarr; fin ~<b>{romeHHMM(e.finEstimadoAt)}</b>
            {declaredMin != null && (
              <span className={off ? "text-warning-500" : "text-success-500"}>
                {" "}
                (declarado {formatDuration(Math.round(declaredMin))} sin la espera
                {off ? `, ${diff > 0 ? `${formatDuration(diff)} de mas` : `${formatDuration(-diff)} de menos`}` : ", dentro de lo razonable"})
              </span>
            )}
          </Row>
          <p className="mt-1 text-[11px] text-ink-400">
            Tiempo de ruta con un {Math.round((e.factorTrafico - 1) * 100)}% de recargo por trafico, {e.minPorParada ?? 10}{" "}
            min por parada y un descanso de {e.descansoMin ?? 30} min cada {formatDuration(e.descansoCadaMin ?? 270)} de
            conduccion. No cambia el pago: es una referencia para revisar.
          </p>
          {off && (
            <button type="button" onClick={onApplyEnd} className="self-start text-[12px] font-medium text-accent-400 hover:text-accent-300">
              Aplicar el fin estimado
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Una jornada enviada por un chofer: lo declarado, avisos para mirar dos veces y las tres salidas
// (aprobar tal cual, ajustar y aprobar, o devolver con un motivo).
const ReviewCard = ({ item, onReviewed }) => {
  const location = useLocation();
  const j = item.jornada;
  const [mode, setMode] = useState(null); // null | "ajustar" | "devolver"
  const [inicio, setInicio] = useState(toRomeDateTimeInputValue(j.inicio));
  const [fin, setFin] = useState(toRomeDateTimeInputValue(j.fin));
  const [esperaMin, setEsperaMin] = useState(String(j.esperaMin));
  const [pausaMin, setPausaMin] = useState(String(j.pausaMin));
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [paradas, setParadas] = useState(item.paradas ?? []);
  const [calculadasAt, setCalculadasAt] = useState(item.paradasCalculadasAt);
  const [gps, setGps] = useState(item.gpsFin);
  const [estimacion, setEstimacion] = useState(item.estimacionRuta);
  const [avisos, setAvisos] = useState(item.avisos);
  const declaredFin = j.declaradas?.fin ?? j.fin;
  const declaredStart = j.declaradas?.inicio ?? j.inicio;

  const hasJornada = Boolean(j.inicio && j.fin);
  const revisarMin = paradas.filter((p) => p.clase === "A_REVISAR").reduce((sum, p) => sum + p.duracionMin, 0);
  const declaredPausa = j.declaradas?.pausaMin ?? j.pausaMin;

  const send = async (body) => {
    setSaving(true);
    setError("");
    try {
      await reviewHorasRequest(item.id, body);
      onReviewed(item.id);
    } catch (err) {
      setError(parseApiError(err).message);
      setSaving(false);
    }
  };

  return (
    <section className="glass-surface rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="block text-[15px] font-semibold text-ink-50">{item.chofer ?? "Sin chofer"}</span>
          <Link
            to={`/records/${item.id}`}
            state={{ backgroundLocation: location }}
            className="block truncate text-[13px] text-accent-400 hover:text-accent-300"
          >
            {item.codigo} &middot; {[item.cliente, item.destinazione].filter(Boolean).join(" - ")}
          </Link>
          <span className="block text-[12px] text-ink-400">
            {formatDate(item.fechaServicio)} {item.targa ? `- ${item.targa}` : ""}
          </span>
        </div>
        <HorasEstadoChip estado={j.estado} />
      </div>

      {item.traspaso && (
        <p className="mt-3 rounded-lg bg-accent-500/10 px-3 py-2 text-[12px] text-ink-100">
          <b>Traspaso:</b>{" "}
          {item.traspaso.tipo === "ORIGEN"
            ? `lo termino ${item.traspaso.otroChofer}`
            : `recibido de ${item.traspaso.otroChofer ?? "otro chofer"}`}
          {item.traspaso.hora
            ? ` - paquete entregado a las ${formatRomeDateTime(item.traspaso.hora)}`
            : " - sin hora de recepcion confirmada todavia"}
          . La jornada de cada chofer sigue hasta que vuelve al lugar de espera.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {hasJornada ? (
          <>
            <Fact label="Inicio">{formatRomeDateTime(j.inicio)}</Fact>
            <Fact label="Fin">{formatRomeDateTime(j.fin)}</Fact>
            <Fact label="Jornada">{formatHours((item.totalMin ?? 0) / 60)}</Fact>
            <Fact label="Dia / noche">
              {formatHours(j.horasDia)} / {formatHours(j.horasNoche)}
            </Fact>
          </>
        ) : (
          <>
            <Fact label="Dia / noche">
              {formatHours(j.horasDia)} / {formatHours(j.horasNoche)}
            </Fact>
            <Fact label="Carga">Solo totales (sin inicio ni fin)</Fact>
          </>
        )}
        <Fact label="Espera">{j.esperaMin} min</Fact>
        <Fact label="Pausa no trabajada">{j.pausaMin} min</Fact>
        <Fact
          label={
            item.viaje?.km
              ? `Km del viaje real / ${item.viaje.km.circuito ? "circuito" : "plan"}`
              : item.circuito
                ? "Km reales / circuito"
                : "Km reales / plan"
          }
        >
          {item.viaje?.km
            ? `${item.viaje.km.real ?? "-"} / ${item.viaje.km.planificado}`
            : `${item.kilometrosReales ?? "-"} / ${item.circuito?.km ?? item.kilometros ?? item.rutaDistanciaKm ?? "-"}`}
        </Fact>
        <Fact label="Pago">
          <span className="text-ink-300 line-through decoration-ink-500">{formatCurrency(item.pago.actual)}</span>{" "}
          {formatCurrency(item.pago.siAprobada)}
        </Fact>
      </div>

      {item.viaje?.km && item.viaje.km.real != null && (
        <div className="mt-3 rounded-lg bg-accent-500/10 px-3 py-2">
          <KmViajeResumen km={item.viaje.km} servicios={item.viaje.servicios} />
          <Link
            to={`/records/${item.id}`}
            state={{ backgroundLocation: location }}
            className="mt-1 inline-block text-[12px] font-medium text-accent-400 hover:text-accent-300"
          >
            Ver o ajustar el reparto de km &rarr;
          </Link>
        </div>
      )}

      <CircuitoDetalle circuito={item.circuito} recordId={item.id} className="mt-3 rounded-lg bg-line/[0.05] px-3 py-2.5" />

      {item.comentarios && (
        <p className="mt-3 rounded-lg bg-line/5 px-3 py-2 text-[12px] text-ink-200">
          <b className="text-ink-50">Comentario del chofer:</b> {item.comentarios}
        </p>
      )}

      {avisos.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {avisos.map((aviso) => (
            <li key={aviso} className="flex items-start gap-2 text-[12px] text-warning-500">
              <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {aviso}
            </li>
          ))}
        </ul>
      )}

      <ParadasBlock
        recordId={item.id}
        paradas={paradas}
        calculadasAt={calculadasAt}
        hasJornada={hasJornada}
        onUpdate={(result) => {
          setParadas(result.paradas);
          setCalculadasAt(result.paradasCalculadasAt);
          setGps(result.gpsFin);
          setAvisos(result.avisos);
          if (result.estimacionRuta) setEstimacion(result.estimacionRuta);
        }}
      />

      {hasJornada && !calculadasAt && (
        <EstimacionBlock
          recordId={item.id}
          estimacion={estimacion}
          declaredMin={
            (new Date(declaredFin) - new Date(declaredStart)) / 60000 - (j.declaradas?.esperaMin ?? j.esperaMin ?? 0)
          }
          onUpdate={(result) => {
            setEstimacion(result.estimacionRuta);
            setAvisos(result.avisos);
          }}
          onApplyEnd={() => {
            setFin(toRomeDateTimeInputValue(estimacion.finEstimadoAt));
            setNota(
              `Fin ajustado a la estimacion por ruta (sin GPS): ${formatDuration(estimacion.totalMin)} entre retiro, paradas y retorno a ${estimacion.retorno.nombre}.`
            );
            setMode("ajustar");
          }}
        />
      )}

      {hasJornada && calculadasAt && (
        <FinGpsBlock
          gps={gps}
          declaredFin={declaredFin}
          declaredStart={declaredStart}
          finFueraDeBase={item.finFueraDeBase}
          onApplyCap={() => {
            setFin(toRomeDateTimeInputValue(gps.topeFinAt));
            setNota(
              `Fin ajustado al tope de la regla: volver a ${gps.base} desde la ultima entrega habria tardado ${formatDuration(gps.vueltaMin)}.`
            );
            setMode("ajustar");
          }}
        />
      )}

      {j.estado === "DEVUELTAS" && j.nota && (
        <p className="mt-3 text-[12px] text-ink-400">Devuelto con la nota: {j.nota}</p>
      )}

      <Alert>{error}</Alert>

      {mode === "ajustar" && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl glass-surface-sm p-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField id={`ini-${item.id}`} label="Inicio" type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            <TextField id={`fin-${item.id}`} label="Fin" type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} />
            <TextField id={`esp-${item.id}`} label="Espera (min)" type="number" min="0" step="5" value={esperaMin} onChange={(e) => setEsperaMin(e.target.value)} />
            <TextField id={`pau-${item.id}`} label={`Pausa no trabajada (min) - el chofer declaro ${declaredPausa}`} type="number" min="0" step="5" value={pausaMin} onChange={(e) => setPausaMin(e.target.value)} />
          </div>
          {revisarMin > 0 && (
            <p className="text-[12px] text-ink-300">
              Paradas a revisar: <b className="text-ink-50">{formatDuration(revisarMin)}</b>.{" "}
              <button
                type="button"
                className="font-medium text-accent-400 hover:text-accent-300"
                onClick={() => setPausaMin(String((Number(pausaMin) || 0) + revisarMin))}
              >
                Sumarlas a la pausa
              </button>{" "}
              (decides tu si descuentas algo).
            </p>
          )}
          <Textarea
            id={`nota-${item.id}`}
            label="Motivo del ajuste (lo ve el chofer)"
            rows={2}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" className="sm:w-auto sm:px-5" disabled={saving} onClick={() => setMode(null)}>
              Cancelar
            </Button>
            <Button
              className="sm:w-auto sm:px-5"
              loading={saving}
              disabled={!nota.trim()}
              onClick={() =>
                send({
                  accion: "APROBAR",
                  inicio,
                  fin,
                  esperaMin: Number(esperaMin) || 0,
                  pausaMin: Number(pausaMin) || 0,
                  nota: nota.trim(),
                })
              }
            >
              Aprobar con ajuste
            </Button>
          </div>
        </div>
      )}

      {mode === "devolver" && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl glass-surface-sm p-3.5">
          <Textarea
            id={`dev-${item.id}`}
            label="Que tiene que corregir el chofer"
            rows={2}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" className="sm:w-auto sm:px-5" disabled={saving} onClick={() => setMode(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              className="sm:w-auto sm:px-5"
              loading={saving}
              disabled={!nota.trim()}
              onClick={() => send({ accion: "DEVOLVER", nota: nota.trim() })}
            >
              Devolver al chofer
            </Button>
          </div>
        </div>
      )}

      {!mode && (
        <div className="mt-4 flex flex-wrap gap-2">
          {j.estado === "PENDIENTE" && (
            <Button className="sm:w-auto sm:px-5 sm:py-2 sm:text-[13px]" loading={saving} onClick={() => send({ accion: "APROBAR" })}>
              <CheckCircleIcon className="h-4 w-4" />
              Aprobar
            </Button>
          )}
          {hasJornada && (
            <Button variant="ghost" className="sm:w-auto sm:px-5 sm:py-2 sm:text-[13px]" onClick={() => { setNota(""); setMode("ajustar"); }}>
              Ajustar y aprobar
            </Button>
          )}
          {j.estado === "PENDIENTE" && (
            <Button variant="ghost" className="sm:w-auto sm:px-5 sm:py-2 sm:text-[13px]" onClick={() => { setNota(""); setMode("devolver"); }}>
              Devolver
            </Button>
          )}
        </div>
      )}
    </section>
  );
};

const FILTERS = [
  { value: "PENDIENTE", label: "En revision" },
  { value: "DEVUELTAS", label: "Devueltas" },
];

// Cola de aprobacion de horas: lo que cobra cada chofer depende de lo que se apruebe aca.
export const HorasAprobacionPage = () => {
  const { refreshPendingCount } = useOutletContext() ?? {};
  const [estado, setEstado] = useState("PENDIENTE");
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    listHorasPendientesRequest(estado)
      .then((data) => {
        if (!cancelled) {
          setItems(data);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [estado]);

  const handleReviewed = useCallback(
    (id) => {
      setItems((prev) => prev?.filter((item) => item.id !== id) ?? prev);
      refreshPendingCount?.();
    },
    [refreshPendingCount]
  );

  return (
    <div className="flex flex-col gap-5">
      <GpsEstadoBanner />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[14px] text-ink-300">
          Horas que enviaron los choferes. Hasta que las apruebes se les paga por kilometros; al aprobarlas
          cuentan por hora, de dia o de noche (la reperibilidad de fin de semana, festivos y servicios de noche se suma en ambos casos).
        </p>
        <SegmentedControl options={FILTERS} value={estado} onChange={setEstado} />
      </div>

      <Alert>{error}</Alert>
      {!items && !error && <PageLoader />}
      {items && items.length === 0 && (
        <p className="px-1 py-6 text-[14px] text-ink-400">
          {estado === "PENDIENTE" ? "No hay horas esperando aprobacion." : "No hay horas devueltas."}
        </p>
      )}
      {items && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <ReviewCard key={`${item.id}-${item.jornada.estado}`} item={item} onReviewed={handleReviewed} />
          ))}
        </div>
      )}
    </div>
  );
};
