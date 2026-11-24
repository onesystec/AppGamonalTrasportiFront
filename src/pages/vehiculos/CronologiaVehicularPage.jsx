import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { formatCronologiaDate, listCronologiaVehicularRequest } from "../../lib/cronologiaVehicular.api";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";

const PAGE_SIZE = 30;

export const CronologiaVehicularPage = () => {
  const { user } = useAuth();
  const [periods, setPeriods] = useState(null);
  const [driverId, setDriverId] = useState("");
  const [plate, setPlate] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listCronologiaVehicularRequest()
      .then((items) => { if (active) setPeriods(items); })
      .catch((err) => { if (active) setError(parseApiError(err).message); });
    return () => { active = false; };
  }, []);

  const drivers = [...new Map((periods ?? []).map(({ driver }) => [driver.id, driver])).values()]
    .sort((a, b) => a.apellido.localeCompare(b.apellido));
  const query = plate.replace(/\s/g, "").toUpperCase();
  const visible = (periods ?? []).filter((item) =>
    (!driverId || item.driver.id === driverId) && item.targa.replace(/\s/g, "").toUpperCase().includes(query),
  );
  const office = user?.cargo !== "CHOFER";
  const fieldClass = "w-full rounded-xl border border-line/20 bg-background px-3 py-2 text-ink-50";

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-2xl font-semibold text-ink-50">Cronología vehicular</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {office && (
          <label className="space-y-1 text-sm text-ink-300">
            <span>Chofer</span>
            <select className={fieldClass} value={driverId} onChange={(event) => { setDriverId(event.target.value); setLimit(PAGE_SIZE); }}>
              <option value="">Todos</option>
              {drivers.map((driver) => <option value={driver.id} key={driver.id}>{driver.nombre} {driver.apellido}</option>)}
            </select>
          </label>
        )}
        <label className="space-y-1 text-sm text-ink-300">
          <span>Matrícula</span>
          <input className={fieldClass} value={plate} onChange={(event) => { setPlate(event.target.value); setLimit(PAGE_SIZE); }} />
        </label>
      </div>
      <Alert>{error}</Alert>
      {periods === null && !error && <p role="status">Cargando cronología…</p>}
      {periods && !visible.length && <p className="text-sm text-ink-300">No hay tramos para mostrar.</p>}
      <ol className="ml-2 space-y-3 border-l border-line/25 pl-5">
        {visible.slice(0, limit).map((item, index) => (
          <li key={`${item.driver.id}-${item.desde}-${index}`} className="glass-surface relative rounded-2xl p-4">
            <span aria-hidden="true" className="absolute -left-[26px] top-6 h-2.5 w-2.5 rounded-full bg-brand" />
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="font-semibold text-ink-50">{item.targa}</h2>
              <p className="text-sm text-ink-300">{item.modelo} · {item.driver.nombre} {item.driver.apellido}</p>
            </div>
            <p className="mt-1 text-sm text-ink-200">
              {formatCronologiaDate(item.desde)} → {item.hasta ? formatCronologiaDate(item.hasta) : "Sin cierre registrado"}
            </p>
            <p className="mt-1 text-xs text-ink-400">
              {item.confirmadoEn ? `Declarado por el chofer · ${formatCronologiaDate(item.confirmadoEn)}` : "Estimado a partir del servicio"}
            </p>
          </li>
        ))}
      </ol>
      {visible.length > limit && <Button variant="ghost" onClick={() => setLimit(limit + PAGE_SIZE)}>Ver más</Button>}
    </section>
  );
};
