import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PendingPermisoItem } from "../../components/calendario/PendingPermisoItem";
import { PermisoModal } from "../../components/calendario/PermisoModal";
import { MonthSelector } from "../../components/finanzas/MonthSelector";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { PageLoader } from "../../components/ui/PageLoader";
import { Pagination } from "../../components/ui/Pagination";
import { TextField } from "../../components/ui/TextField";
import { CalendarIcon, ChevronRightIcon, PlusIcon, UsersIcon } from "../../components/ui/icons";
import { parseApiError } from "../../lib/api";
import { CARGO_LABELS } from "../../lib/constants";
import { currentMonth } from "../../lib/finanzas";
import {
  getAsistenciaResumenRequest,
  getPermisosConfigRequest,
  listPermisosRequest,
  setPermisosConfigRequest,
} from "../../lib/permisos.api";

const PAGE_SIZE = 10;
const SMALL = "sm:w-auto sm:px-4 sm:py-2 sm:text-[13px]";

const STEP_BTN =
  "flex h-10 w-10 items-center justify-center rounded-xl border border-line/10 text-[18px] font-medium text-ink-100 transition-colors enabled:hover:bg-line/10 disabled:opacity-40";

// Tope de permisos por dia: cuantos choferes pueden estar de permiso a la vez. Vacio = sin tope.
const TopeCard = ({ onSaved, onError }) => {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPermisosConfigRequest()
      .then((cfg) => {
        setSaved(cfg.maxPorDia);
        setValue(cfg.maxPorDia ? String(cfg.maxPorDia) : "");
      })
      .catch(() => {});
  }, []);

  const save = async (next) => {
    setSaving(true);
    onError("");
    try {
      const cfg = await setPermisosConfigRequest(next);
      setSaved(cfg.maxPorDia);
      setValue(cfg.maxPorDia ? String(cfg.maxPorDia) : "");
      onSaved();
    } catch (err) {
      const parsed = parseApiError(err);
      onError(parsed.fieldErrors?.maxPorDia?.[0] ?? parsed.message);
    } finally {
      setSaving(false);
    }
  };

  const parsed = value.trim() === "" ? null : Number(value);
  const dirty = parsed !== saved;
  const invalid = parsed !== null && !(parsed >= 1);
  const step = (delta) => {
    const next = (parsed ?? 0) + delta;
    setValue(next >= 1 ? String(Math.min(next, 100)) : "");
  };

  return (
    <section className="glass-surface flex flex-wrap items-center gap-x-5 gap-y-4 rounded-2xl px-4 py-4 sm:px-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30">
        <UsersIcon className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1 basis-64">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-[16px] font-semibold text-ink-50">Tope de permisos por dia</h2>
          <span
            className={
              saved
                ? "rounded-full bg-accent-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-accent-300"
                : "rounded-full bg-line/10 px-2.5 py-0.5 text-[11px] font-semibold text-ink-300"
            }
          >
            {saved ? `Maximo ${saved} por dia` : "Sin tope"}
          </span>
        </div>
        <p className="mt-1 text-[13px] text-ink-300">
          Cuantos choferes pueden estar de permiso el mismo dia. La enfermedad y los dias libres no cuentan.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <button type="button" className={STEP_BTN} aria-label="Menos" disabled={parsed === null} onClick={() => step(-1)}>
            &minus;
          </button>
          <input
            id="permisos-tope"
            type="number"
            inputMode="numeric"
            min="1"
            max="100"
            placeholder="Sin tope"
            aria-label="Maximo de choferes de permiso por dia"
            className="glass-input h-10 w-24 rounded-xl px-2 text-center text-[15px] text-ink-50"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="button" className={STEP_BTN} aria-label="Mas" onClick={() => step(1)}>
            +
          </button>
        </div>
        <Button className="sm:w-auto sm:px-5 sm:py-2.5 sm:text-[13px]" loading={saving} disabled={!dirty || invalid} onClick={() => save(parsed)}>
          Guardar
        </Button>
        {saved && (
          <Button variant="ghost" className="sm:w-auto sm:px-4 sm:py-2.5 sm:text-[13px]" disabled={saving} onClick={() => save(null)}>
            Quitar tope
          </Button>
        )}
      </div>
    </section>
  );
};

const Count = ({ value, tone, label }) => (
  <span className="flex min-w-[64px] flex-col items-center">
    <span className={`text-[18px] font-semibold leading-none ${value > 0 ? tone : "text-ink-400"}`}>{value}</span>
    <span className="mt-1 text-[10px] text-ink-400">{label}</span>
  </span>
);

const initialsOf = (driver) => `${driver.nombre?.[0] ?? ""}${driver.apellido?.[0] ?? ""}`;

// "Permisos" (oficina): solicitudes por aprobar de todos los choferes, tope por dia y asistencia del
// mes de cada chofer. Cada chofer lleva a su pantalla con calendario y permisos.
export const PermisosPage = () => {
  const [permisos, setPermisos] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [month, setMonth] = useState(currentMonth);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [choferes, setChoferes] = useState([]);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  const loadPermisos = useCallback(
    () =>
      listPermisosRequest({ estado: "PENDIENTE" })
        .then(setPermisos)
        .catch((err) => setError(parseApiError(err).message)),
    []
  );

  const loadResumen = useCallback(
    () =>
      getAsistenciaResumenRequest(month)
        .then((items) => {
          setResumen(items);
          setChoferes(items.map((i) => i.driver));
        })
        .catch((err) => setError(parseApiError(err).message)),
    [month]
  );

  useEffect(() => {
    loadPermisos();
  }, [loadPermisos]);

  useEffect(() => {
    setResumen(null);
    loadResumen();
  }, [loadResumen]);

  // Al buscar o cambiar de mes se vuelve a la primera pagina.
  useEffect(() => {
    setPage(1);
  }, [filter, month]);

  const refreshAll = () => {
    setError("");
    loadPermisos();
    loadResumen();
  };

  const visibles = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (resumen ?? []).filter(
      (i) => !q || `${i.driver.nombre} ${i.driver.apellido}`.toLowerCase().includes(q)
    );
  }, [resumen, filter]);

  const pageCount = Math.max(1, Math.ceil(visibles.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = visibles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30">
            <CalendarIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-[26px] font-semibold leading-tight text-ink-50">Permisos</h1>
            <p className="mt-0.5 max-w-xl text-[14px] text-ink-300">
              Solicitudes de los choferes, justificaciones y asistencia del mes.
            </p>
          </div>
        </div>
        <Button className="sm:w-auto sm:px-5 sm:py-2 sm:text-[13px]" onClick={() => setModal(true)}>
          <PlusIcon className="h-4 w-4" />
          Registrar permiso o dia libre
        </Button>
      </div>

      <Alert>{error}</Alert>
      <TopeCard onSaved={refreshAll} onError={setError} />

      <section className="flex flex-col gap-3">
        <h2 className="text-[17px] font-semibold text-ink-50">
          Por aprobar {permisos?.length > 0 && <span className="text-warning-500">({permisos.length})</span>}
        </h2>
        {!permisos && !error && <PageLoader />}
        {permisos?.length === 0 && <p className="text-[13px] text-ink-300">No hay solicitudes pendientes.</p>}
        {permisos?.length > 0 && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {permisos.map((p) => (
              <PendingPermisoItem key={p.id} permiso={p} onResolved={refreshAll} onError={setError} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold text-ink-50">Asistencia del mes</h2>
            <p className="text-[13px] text-ink-300">Incluye choferes, responsables y admin. Toca uno para ver su calendario y sus permisos.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <TextField
              id="permisos-buscar"
              placeholder="Buscar por nombre..."
              className="w-52"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <MonthSelector month={month} onChange={setMonth} allowFuture />
          </div>
        </div>

        {!resumen && !error && <PageLoader />}
        {resumen && (
          <div className="glass-surface divide-y divide-line/10 overflow-hidden rounded-2xl">
            {visibles.length === 0 && <p className="px-5 py-4 text-[13px] text-ink-300">Sin resultados.</p>}
            {pageItems.map(({ driver, summary, pendientes }) => (
              <Link
                key={driver.id}
                to={`/permisos/${driver.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-line/[0.05] sm:px-5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-[12px] font-semibold text-accent-300">
                  {initialsOf(driver)}
                </span>
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block truncate text-[14px] font-semibold text-ink-50">
                    {driver.nombre} {driver.apellido}
                    {driver.cargo !== "CHOFER" && (
                      <span className="ml-2 rounded-full bg-line/10 px-2 py-0.5 align-middle text-[10px] font-medium text-ink-300">
                        {CARGO_LABELS[driver.cargo]}
                      </span>
                    )}
                  </span>
                  {pendientes > 0 && (
                    <span className="text-[12px] font-medium text-warning-500">
                      {pendientes} {pendientes === 1 ? "solicitud pendiente" : "solicitudes pendientes"}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1 sm:gap-3">
                  <Count value={summary.trabajados} tone="text-success-500" label="Trabajados" />
                  <Count value={summary.noTrabajados} tone="text-danger-500" label="No trab." />
                  <Count value={summary.justificados} tone="text-warning-500" label="Justif." />
                  <Count value={summary.descansos} tone="text-ink-300" label="Libres" />
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-400" />
              </Link>
            ))}
          </div>
        )}
        {resumen && visibles.length > 0 && (
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            pageSize={PAGE_SIZE}
            total={visibles.length}
            noun="personas"
            onChange={setPage}
          />
        )}
      </section>

      {modal && <PermisoModal choferes={choferes} onClose={() => setModal(false)} onDone={refreshAll} />}
    </div>
  );
};
