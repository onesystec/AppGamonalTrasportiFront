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

// Etiqueta corta para la fila de un acordeon: "Sugerido: Nombre Apellido (Alta)". `wide` (escritorio): una linea propia debajo
// de la fila, con el motivo; si no, cabe en la celda del chofer.
export const SugerenciaChip = ({ sugerencia, wide = false, className }) => {
  const top = sugerencia?.candidatos?.[0];
  if (!top) return null;
  const confianza = CONFIANZA[top.confianza] ?? CONFIANZA.BAJA;
  return (
    <span
      className={clsx("mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-ink-400", wide && "pl-[116px] pt-0.5", className)}
      title={`Confianza ${confianza.label.toLowerCase()}. ${top.motivos.join(". ")}`}
    >
      <span className="min-w-0 truncate">
        Sugerido: <span className="font-medium text-ink-300">{fullName(top)}</span>
        {wide && top.motivos[0] && <span> - {top.motivos[0]}</span>}
      </span>
      <span className={clsx("shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold", confianza.tone)}>{confianza.label}</span>
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
