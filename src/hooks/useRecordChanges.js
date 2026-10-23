import { useEffect, useRef } from "react";
import { startVisibleInterval } from "../lib/polling";
import { getRecordChangesRequest } from "../lib/records.api";

const CHECK_EVERY_MS = 20 * 1000;
const IDLE_MS = 15 * 60 * 1000;

// Avisa cuando se crea, edita o borra un servicio desde cualquier lado (otra persona, el bot de Telegram, un proceso automatico), sin recargar la
// app. Cada 20 s (solo con la pestaña a la vista y la persona activa) le pregunta al servidor que dias cambiaron: es una consulta barata, sin base de
// datos. Llama a onChange(dias): dias = lista de dias ("AAAA-MM-DD") que cambiaron, o null si no se sabe cuales (hay que refrescar todo lo visible).
export const useRecordChanges = (onChange, enabled = true) => {
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let last = { version: null, instancia: null };
    const check = async () => {
      try {
        const res = await getRecordChangesRequest(last);
        if (cancelled) return;
        const first = last.version == null;
        last = { version: res.version, instancia: res.instancia };
        // La primera respuesta solo anota la version de partida.
        if (!first && (res.dias === null || res.dias.length > 0)) callbackRef.current(res.dias);
      } catch {
        // sin red o servidor dormido: se vuelve a intentar en la siguiente vuelta
      }
    };
    check();
    const stop = startVisibleInterval(check, CHECK_EVERY_MS, { idleMs: IDLE_MS });
    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled]);
};
