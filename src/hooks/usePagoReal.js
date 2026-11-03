import { useEffect, useState } from "react";
import { getPagoServiciosRequest } from "../lib/finanzas.api";

// Pago real a choferes por servicio de un rango de meses (AAAA-MM), para que los numeros economicos usen lo que de verdad se paga y no una estimacion.
// Devuelve null mientras carga (o si falla: ahi se sigue con la estimacion de siempre) o { meses, servicios: Map(id -> EUR), adicionales: { mes: EUR } }.
export const usePagoReal = (desde, hasta, enabled = true) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!enabled || !desde || !hasta) return undefined;
    let cancelled = false;
    getPagoServiciosRequest({ desde, hasta })
      .then((d) => {
        if (!cancelled) setData({ meses: new Set(d.meses), servicios: new Map(d.items.map((i) => [i.id, i.total])), adicionales: d.adicionales ?? {} });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [desde, hasta, enabled]);

  return data;
};
