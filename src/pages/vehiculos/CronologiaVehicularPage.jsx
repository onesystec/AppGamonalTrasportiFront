import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import {
  formatCronologiaDay,
  formatCronologiaTime,
  listCronologiaVehicularRequest,
} from "../../lib/cronologiaVehicular.api";
import { Alert } from "../../components/ui/Alert";
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  ClockIcon,
  TruckIcon,
  UserIcon,
} from "../../components/ui/icons";

const PAGE_SIZE = 8;
// Fecha | vehiculo | periodo | estado. En pantallas estrechas cada tramo pasa a ser una tarjeta apilada.
const ROW_GRID = "lg:grid lg:grid-cols-[minmax(8rem,10rem)_minmax(0,1.5fr)_minmax(0,1.3fr)_10rem] lg:items-center lg:gap-6";

const ESTADOS = {
  servicio: { label: "En servicio", className: "bg-success-500/15 text-success-500" },
  declarado: { label: "Declarado", hint: "Declarado por el chofer", className: "bg-brand/15 text-brand-bright" },
  estimado: { label: "Estimado", hint: "Estimado a partir del servicio", className: "bg-line/15 text-ink-300" },
};

const estadoDe = (item) => (!item.hasta ? ESTADOS.servicio : item.confirmadoEn ? ESTADOS.declarado : ESTADOS.estimado);

const SelectField = ({ id, icon: Icon, label, value, onChange, children }) => (
  <label htmlFor={id} className="glass-surface-sm relative flex min-w-0 items-center gap-3 rounded-2xl px-4 py-2.5 sm:min-w-[13rem]">
    <Icon className="h-5 w-5 shrink-0 text-ink-300" />
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="text-xs text-ink-300">{label}</span>
      <select
        id={id}
        value={value}
        onChange={onChange}
        className="w-full cursor-pointer appearance-none truncate bg-transparent pr-6 text-[15px] font-semibold text-ink-50 outline-none [&>option]:bg-background"
      >
        {children}
      </select>
    </span>
    <ChevronDownIcon className="pointer-events-none absolute right-4 h-4 w-4 text-ink-300" />
  </label>
);

const Stat = ({ icon: Icon, label, value }) => (
  <div className="flex min-w-0 items-center gap-3 px-5 py-4">
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand-bright">
      <Icon className="h-5 w-5" />
    </span>
    <div className="min-w-0">
      <p className="text-xs text-ink-300">{label}</p>
      <p className="text-base font-semibold tabular-nums text-ink-50 sm:text-lg">{value}</p>
    </div>
  </div>
);

const stamp = (value) => (value ? `${formatCronologiaDay(value)} · ${formatCronologiaTime(value)}` : "—");

export const CronologiaVehicularPage = () => {
  const { user } = useAuth();
  const [periods, setPeriods] = useState(null);
  const [driverId, setDriverId] = useState("");
  const [plate, setPlate] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listCronologiaVehicularRequest()
      .then((items) => { if (active) setPeriods(items); })
      .catch((err) => { if (active) setError(parseApiError(err).message); });
    return () => { active = false; };
  }, []);

  const office = user?.cargo !== "CHOFER";
  const drivers = useMemo(
    () => [...new Map((periods ?? []).map(({ driver }) => [driver.id, driver])).values()].sort((a, b) => a.apellido.localeCompare(b.apellido)),
    [periods],
  );
  const plates = useMemo(
    () => [...new Set((periods ?? []).filter((item) => !driverId || item.driver.id === driverId).map((item) => item.targa))].sort(),
    [periods, driverId],
  );
  const visible = useMemo(
    () => (periods ?? []).filter((item) => (!driverId || item.driver.id === driverId) && (!plate || item.targa === plate)),
    [periods, driverId, plate],
  );

  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const first = visible.reduce((min, item) => (!min || item.desde < min ? item.desde : min), null);
  const last = visible.reduce((max, item) => { const end = item.hasta ?? item.desde; return !max || end > max ? end : max; }, null);
  const vehicles = new Set(visible.map((item) => item.targa)).size;
  const selectedDriver = drivers.find((driver) => driver.id === driverId);

  return (
    <section className="w-full space-y-5">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span className="glass-surface-sm flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-brand-bright sm:h-16 sm:w-16">
            <TruckIcon className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-ink-50 sm:text-3xl">Cronología vehicular</h1>
            <p className="text-sm text-ink-300 sm:text-base">
              {office ? "Historial de uso de choferes y vehículos" : "Historial de uso de tus vehículos"}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          {office && (
            <SelectField id="cronologia-chofer" icon={UserIcon} label="Chofer" value={driverId} onChange={(event) => { setDriverId(event.target.value); setPlate(""); setPage(1); }}>
              <option value="">Todos</option>
              {drivers.map((driver) => <option value={driver.id} key={driver.id}>{driver.nombre} {driver.apellido}</option>)}
            </SelectField>
          )}
          <SelectField id="cronologia-matricula" icon={TruckIcon} label="Matrícula" value={plate} onChange={(event) => { setPlate(event.target.value); setPage(1); }}>
            <option value="">Todas</option>
            {plates.map((targa) => <option value={targa} key={targa}>{targa}</option>)}
          </SelectField>
        </div>
      </header>

      <Alert>{error}</Alert>
      {periods === null && !error && <p role="status" className="text-sm text-ink-300">Cargando cronología…</p>}

      {periods && (
        <>
          <div className="glass-surface grid grid-cols-1 divide-y divide-line/15 overflow-hidden rounded-3xl sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
            <Stat icon={ClipboardListIcon} label="Total de movimientos" value={visible.length} />
            <Stat icon={TruckIcon} label="Vehículos utilizados" value={vehicles} />
            <Stat icon={CalendarIcon} label="Primer registro" value={stamp(first)} />
            <Stat icon={CalendarIcon} label="Último registro" value={stamp(last)} />
          </div>

          <div className="glass-surface overflow-hidden rounded-3xl">
            <div className={clsx(ROW_GRID, "hidden border-b border-line/15 px-6 py-4 text-xs font-medium uppercase tracking-wide text-ink-300 lg:grid")}>
              <span className="pl-7">Fecha y hora</span>
              <span>Vehículo</span>
              <span>Período de uso</span>
              <span>Estado</span>
            </div>

            {!visible.length ? (
              <p className="px-6 py-10 text-center text-sm text-ink-300">
                No hay tramos para mostrar{selectedDriver ? ` de ${selectedDriver.nombre} ${selectedDriver.apellido}` : ""}.
              </p>
            ) : (
              <ol>
                {rows.map((item, index) => {
                  const estado = estadoDe(item);
                  return (
                    <li
                      key={`${item.driver.id}-${item.desde}-${index}`}
                      className={clsx(ROW_GRID, "relative flex flex-col gap-3 border-b border-line/10 px-5 py-4 last:border-b-0 lg:px-6")}
                    >
                      <div className="flex items-center gap-4">
                        <span className="relative flex h-5 w-3 shrink-0 justify-center" aria-hidden="true">
                          {index > 0 && <span className="absolute -top-8 bottom-1/2 w-px bg-brand/40" />}
                          {index < rows.length - 1 && <span className="absolute -bottom-8 top-1/2 w-px bg-brand/40" />}
                          <span className="relative z-10 mt-1.5 h-3 w-3 rounded-full border-2 border-brand-bright bg-brand" />
                        </span>
                        <div className="tabular-nums">
                          <p className="font-semibold text-ink-50">{formatCronologiaDay(item.desde)}</p>
                          <p className="text-sm text-ink-300">{formatCronologiaTime(item.desde)}</p>
                        </div>
                      </div>

                      <div className="flex min-w-0 items-center gap-4">
                        <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-xl bg-line/10 text-ink-300">
                          <TruckIcon className="h-6 w-6" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink-50">{item.targa}</p>
                          <p className="text-sm text-ink-300">{item.modelo} · {item.driver.nombre} {item.driver.apellido}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 tabular-nums">
                        <ClockIcon className="h-5 w-5 shrink-0 text-ink-300" />
                        <div>
                          <p className="font-semibold text-ink-50">
                            {formatCronologiaDay(item.desde)} → {item.hasta ? formatCronologiaDay(item.hasta) : "Sin cierre"}
                          </p>
                          <p className="text-sm text-ink-300">
                            {formatCronologiaTime(item.desde)} – {item.hasta ? formatCronologiaTime(item.hasta) : "en curso"}
                          </p>
                        </div>
                      </div>

                      <div>
                        <span title={estado.hint} className={clsx("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium", estado.className)}>
                          <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
                          {estado.label}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/15 px-5 py-4 lg:px-6">
              <p className="text-sm text-ink-300">Mostrando {rows.length} de {visible.length} registros</p>
              {pages > 1 && (
                <nav aria-label="Paginación" className="flex items-center gap-1.5">
                  <button type="button" aria-label="Página anterior" disabled={current === 1} onClick={() => setPage(current - 1)} className="glass-surface-sm flex h-9 w-9 items-center justify-center rounded-lg text-ink-50 disabled:opacity-40">
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>
                  {Array.from({ length: pages }, (_, i) => i + 1)
                    .filter((n) => n === 1 || n === pages || Math.abs(n - current) <= 1)
                    .map((n, i, arr) => (
                      <span key={n} className="flex items-center gap-1.5">
                        {i > 0 && n - arr[i - 1] > 1 && <span className="px-1 text-ink-400">…</span>}
                        <button
                          type="button"
                          onClick={() => setPage(n)}
                          aria-current={n === current ? "page" : undefined}
                          className={clsx("h-9 min-w-9 rounded-lg px-3 text-sm font-semibold tabular-nums", n === current ? "bg-brand text-brand-foreground" : "glass-surface-sm text-ink-50")}
                        >
                          {n}
                        </button>
                      </span>
                    ))}
                  <button type="button" aria-label="Página siguiente" disabled={current === pages} onClick={() => setPage(current + 1)} className="glass-surface-sm flex h-9 w-9 items-center justify-center rounded-lg text-ink-50 disabled:opacity-40">
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </nav>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
};
