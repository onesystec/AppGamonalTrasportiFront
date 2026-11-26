import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { getMultaSuggestionRequest, getMultasSuggestionsRequest } from "../../lib/multas.api";
import { Spinner } from "../ui/Spinner";

// Sugerencias de chofer para las multas que no lo tienen. Solo SUGIEREN: asignar siempre es un toque de la oficina.
export const CONFIANZA = {
  ALTA: { label: "Alta", tone: "bg-success-500/15 text-success-500", dot: "bg-success-500" },
  MEDIA: { label: "Media", tone: "bg-warning-500/20 text-warning-500", dot: "bg-warning-500" },
  BAJA: { label: "Baja", tone: "bg-ink-500/15 text-ink-300", dot: "bg-ink-400" },
};

const fullName = (c) => `${c.nombre} ${c.apellido}`;

// Pildora de coincidencia (Alta / Media / Baja) con un punto de color.
export const ConfianzaPill = ({ confianza, className }) => {
  const info = CONFIANZA[confianza] ?? CONFIANZA.BAJA;
  return (
    <span
      className={clsx("inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold", info.tone, className)}
      title={`Coincidencia ${info.label.toLowerCase()}`}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", info.dot)} />
      {info.label}
    </span>
  );
};

// Posible infractor debajo de "Sin chofer" en la fila: nombre + coincidencia y, abajo, el motivo principal.
export const SugerenciaChip = ({ sugerencia, className }) => {
  if (!sugerencia) return null;
  const top = sugerencia.candidatos?.[0];
  if (!top) {
    const farmacia = /farmacia/i.test(sugerencia.resumen ?? "");
    return (
      <span
        className={clsx("mt-0.5 block truncate text-[11px]", farmacia ? "text-warning-500" : "text-ink-500", className)}
        title={sugerencia.resumen ?? undefined}
      >
        {farmacia ? "Sin servicios: revisar en Farmacia" : "Sin datos para sugerir"}
      </span>
    );
  }
  return (
    <span
      className={clsx("mt-0.5 block min-w-0 text-[11px] text-ink-400", className)}
      title={`Posible infractor: ${fullName(top)} (coincidencia ${(CONFIANZA[top.confianza] ?? CONFIANZA.BAJA).label.toLowerCase()}). ${top.motivos.join(". ")}`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 truncate">
          Posible: <span className="font-medium text-ink-200">{fullName(top)}</span>
        </span>
        <ConfianzaPill confianza={top.confianza} />
      </span>
      {top.motivos[0] && <span className="block truncate text-[10.5px] text-ink-500">{top.motivos[0]}</span>}
    </span>
  );
};

const CHUNK = 20;

// Pide las sugerencias de las multas visibles que no tienen chofer (de a 20, una sola vez por multa) y las guarda por id.
export const useRowSuggestions = (items, enabled) => {
  const [byId, setById] = useState({});
  const asked = useRef(new Set());
  const ids = useMemo(() => (enabled && items ? items.filter((m) => !m.driver).map((m) => m.id) : []), [items, enabled]);

  useEffect(() => {
    const missing = ids.filter((id) => !asked.current.has(id));
    if (missing.length === 0) return undefined;
    missing.forEach((id) => asked.current.add(id));
    let cancelled = false;
    (async () => {
      for (let i = 0; i < missing.length; i += CHUNK) {
        try {
          const data = await getMultasSuggestionsRequest(missing.slice(i, i + CHUNK));
          if (!cancelled) setById((prev) => ({ ...prev, ...data }));
        } catch {
          // Es una ayuda: si falla, la fila queda sin etiqueta.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  return byId;
};

const formatBase = (fechaBase, hora) => {
  if (!fechaBase) return null;
  const [y, m, d] = fechaBase.split("-");
  return `${d}/${m}/${y}${hora ? ` ${hora}` : ""}`;
};

// Panel del detalle de una multa sin chofer: los posibles responsables, por que, y un boton para asignar.
export const SugerenciaPanel = ({ multaId, disabled, onAssign }) => {
  const [state, setState] = useState({ loading: true, data: null, error: false });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, data: null, error: false });
    getMultaSuggestionRequest(multaId)
      .then((data) => !cancelled && setState({ loading: false, data, error: false }))
      .catch(() => !cancelled && setState({ loading: false, data: null, error: true }));
    return () => {
      cancelled = true;
    };
  }, [multaId]);

  if (state.error) return null;

  return (
    <div className="rounded-xl bg-accent-500/10 px-4 py-3">
      <p className="text-[13px] font-semibold text-ink-50">Quien pudo ser el responsable</p>
      <p className="mt-0.5 text-[12px] text-ink-400">
        Es solo una sugerencia, segun los servicios cargados
        {state.data?.fechaBase ? ` cerca del ${formatBase(state.data.fechaBase, state.data.hora)}` : ""}. Confirmalo con el verbale.
      </p>

      {state.loading && (
        <div className="flex items-center gap-2 py-3 text-[13px] text-ink-400">
          <Spinner /> Buscando...
        </div>
      )}

      {!state.loading && state.data?.candidatos?.length === 0 && (
        <p className="mt-2 text-[13px] text-ink-300">{state.data.resumen ?? "No hay datos para sugerir a alguien."}</p>
      )}

      {!state.loading && state.data?.candidatos?.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2">
          {state.data.candidatos.map((c) => {
            const confianza = CONFIANZA[c.confianza] ?? CONFIANZA.BAJA;
            return (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg glass-input px-3 py-2.5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-ink-50">
                    {fullName(c)}
                    <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-semibold", confianza.tone)}>
                      Confianza {confianza.label.toLowerCase()}
                    </span>
                  </p>
                  <ul className="mt-1 list-disc pl-4 text-[12px] text-ink-300">
                    {c.motivos.map((motivo) => (
                      <li key={motivo}>{motivo}</li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onAssign(c.id)}
                  className="rounded-full bg-accent-500/20 px-3 py-1 text-[12px] font-semibold text-accent-300 transition-colors hover:bg-accent-500/30 disabled:opacity-50"
                >
                  Asignar
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!state.loading && state.data?.candidatos?.length > 0 && state.data.resumen && (
        <p className="mt-2 text-[12px] text-ink-400">{state.data.resumen}</p>
      )}
    </div>
  );
};
