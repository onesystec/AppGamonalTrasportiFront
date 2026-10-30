import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarioAncho } from "../../components/calendario/CalendarioAncho";
import { PendingPermisoItem } from "../../components/calendario/PendingPermisoItem";
import { PermisoCard } from "../../components/calendario/PermisoCard";
import { ProximosPermisosCard } from "../../components/calendario/ProximosPermisosCard";
import { RegistrarPermisoCard } from "../../components/calendario/RegistrarPermisoCard";
import { ResumenMesCard } from "../../components/calendario/ResumenMesCard";
import { ServiciosDelDia } from "../../components/calendario/ServiciosDelDia";
import { MonthSelector } from "../../components/finanzas/MonthSelector";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { PageLoader } from "../../components/ui/PageLoader";
import { MailIcon, PhoneIcon, PlusIcon } from "../../components/ui/icons";
import { parseApiError } from "../../lib/api";
import { AREA_OPTIONS, CARGO_LABELS } from "../../lib/constants";
import { currentMonth } from "../../lib/finanzas";
import { formatDate, formatDateOnly } from "../../lib/format";
import { DIA_ESTADOS, permisoTipoLabel } from "../../lib/permisos";
import { deletePermisoRequest, getCalendarioRequest, listPermisosRequest } from "../../lib/permisos.api";
import { getUserRequest } from "../../lib/users.api";

const SMALL = "sm:w-auto sm:px-4 sm:py-1.5 sm:text-[13px]";

const Stat = ({ label, value }) => (
  <div className="min-w-[120px] flex-1 px-4 py-1">
    <span className="block text-[12px] text-ink-300">{label}</span>
    <span className="mt-0.5 block text-[16px] font-semibold text-ink-50">{value}</span>
  </div>
);

const tabClass = (active) =>
  clsx(
    "whitespace-nowrap border-b-2 px-4 py-3 text-[14px] font-medium transition-colors",
    active ? "border-accent-400 text-ink-50" : "border-transparent text-ink-300 hover:text-ink-50"
  );

// Permisos y asistencia de UN chofer (oficina): datos del chofer, solicitudes por resolver,
// calendario del mes, resumen y alta de permisos.
export const PermisosChoferPage = () => {
  const { driverId } = useParams();
  const [driver, setDriver] = useState(null);
  const [month, setMonth] = useState(currentMonth);
  const [calendar, setCalendar] = useState(null);
  const [permisos, setPermisos] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [removeId, setRemoveId] = useState(null);
  const [removing, setRemoving] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    getUserRequest(driverId)
      .then(setDriver)
      .catch((err) => setError(parseApiError(err).message));
  }, [driverId]);

  const loadPermisos = useCallback(
    () =>
      listPermisosRequest({ estado: "TODAS", driverId })
        .then(setPermisos)
        .catch((err) => setError(parseApiError(err).message)),
    [driverId]
  );

  const loadCalendar = useCallback(
    () =>
      getCalendarioRequest({ month, driverId })
        .then(setCalendar)
        .catch((err) => setError(parseApiError(err).message)),
    [month, driverId]
  );

  useEffect(() => {
    loadPermisos();
  }, [loadPermisos]);

  useEffect(() => {
    setCalendar(null);
    setSelected(null);
    loadCalendar();
  }, [loadCalendar]);

  const refreshAll = () => {
    setError("");
    loadPermisos();
    loadCalendar();
  };

  const confirmRemove = async () => {
    setRemoving(true);
    try {
      await deletePermisoRequest(removeId);
      setRemoveId(null);
      refreshAll();
    } catch (err) {
      setError(parseApiError(err).message);
      setRemoveId(null);
    } finally {
      setRemoving(false);
    }
  };

  const goToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    formRef.current?.querySelector("select")?.focus();
  };

  const pendientes = useMemo(() => (permisos ?? []).filter((p) => p.estado === "PENDIENTE"), [permisos]);
  const resueltos = useMemo(() => (permisos ?? []).filter((p) => p.estado !== "PENDIENTE"), [permisos]);
  const selectedDay = calendar?.days.find((d) => d.fecha === selected);
  const serviciosMes = calendar ? calendar.days.reduce((sum, d) => sum + d.servicios, 0) : null;
  const areaLabel = driver ? AREA_OPTIONS.find((a) => a.value === driver.area)?.label : null;

  if (!driver && !error) return <PageLoader />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/permisos" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
          &larr; Volver a Permisos
        </Link>
        <Button className="sm:w-auto sm:px-5 sm:py-2 sm:text-[13px]" onClick={goToForm}>
          <PlusIcon className="h-4 w-4" />
          Registrar permiso o dia libre
        </Button>
      </div>

      <Alert>{error}</Alert>

      {driver && (
        <section className="glass-surface flex flex-col gap-4 rounded-2xl p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Avatar user={driver} className="h-16 w-16 text-xl sm:h-20 sm:w-20" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[22px] font-semibold leading-tight text-ink-50 sm:text-[26px]">
                  {driver.nombre} {driver.apellido}
                </h1>
                <span
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                    driver.estado === "ACTIVO" ? "bg-success-500/15 text-success-500" : "bg-line/10 text-ink-300"
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {driver.estado === "ACTIVO" ? "Activo" : "Inactivo"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-300">
                <span>{CARGO_LABELS[driver.cargo] ?? "Chofer"}</span>
                {driver.numeroCelular && (
                  <span className="inline-flex items-center gap-1.5">
                    <PhoneIcon className="h-3.5 w-3.5" />
                    {driver.numeroCelular}
                  </span>
                )}
                {driver.correoElectronico && (
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <MailIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{driver.correoElectronico}</span>
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {areaLabel && (
                  <span className="rounded-full bg-accent-500/20 px-3 py-1 text-[12px] font-medium text-accent-300">
                    {areaLabel}
                  </span>
                )}
                {driver.vehiculoAsignado && (
                  <span className="rounded-full bg-line/10 px-3 py-1 text-[12px] font-medium text-ink-200">
                    {driver.vehiculoAsignado.modelo || driver.vehiculoAsignado.targa}
                  </span>
                )}
                <Link to={`/choferes/${driver.id}`} className="text-[12px] font-medium text-accent-400 hover:text-accent-300">
                  Ver perfil completo &rarr;
                </Link>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap divide-line/10 rounded-2xl border border-line/10 bg-line/[0.03] py-2 sm:divide-x">
            <Stat label="Ultimo servicio" value={calendar?.ultimoServicio ? formatDateOnly(calendar.ultimoServicio) : "-"} />
            <Stat label="Alta en el sistema" value={formatDate(driver.createdAt)} />
            <Stat label="Servicios del mes" value={serviciosMes ?? "-"} />
          </div>
        </section>
      )}

      <nav aria-label="Secciones del chofer" className="-mx-4 flex overflow-x-auto border-b border-line/15 px-4 sm:mx-0 sm:px-0">
        <span className={tabClass(true)}>Permisos</span>
        <Link to={`/choferes/${driverId}`} className={tabClass(false)}>
          Perfil y documentos
        </Link>
        <Link
          to={`/records?q=${encodeURIComponent(driver ? `${driver.nombre} ${driver.apellido}` : "")}`}
          className={tabClass(false)}
        >
          Servicios
        </Link>
      </nav>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="glass-surface rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-[16px] font-semibold text-ink-50">
                  {showAll ? "Todas las solicitudes" : "Solicitudes pendientes"}
                  {pendientes.length > 0 && (
                    <span className="rounded-full bg-danger-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {pendientes.length}
                    </span>
                  )}
                </h2>
                <p className="mt-0.5 text-[13px] text-ink-300">
                  Revisa y gestiona las solicitudes de permiso de este chofer.
                </p>
              </div>
              {resueltos.length > 0 && (
                <Button variant="ghost" className={SMALL} onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Solo pendientes" : "Ver todas"}
                </Button>
              )}
            </div>

            {!permisos && <p className="mt-4 text-[13px] text-ink-300">Cargando...</p>}
            {permisos && pendientes.length === 0 && !showAll && (
              <p className="mt-4 text-[13px] text-ink-300">No hay solicitudes pendientes.</p>
            )}
            <div className="mt-4 grid grid-cols-1 gap-3 2xl:grid-cols-2">
              {pendientes.map((p) => (
                <PendingPermisoItem key={p.id} permiso={p} showDriver={false} onResolved={refreshAll} onError={setError} />
              ))}
              {showAll &&
                resueltos.map((p) => (
                  <PermisoCard
                    key={p.id}
                    permiso={p}
                    actions={
                      <Button variant="ghost" className={SMALL} onClick={() => setRemoveId(p.id)}>
                        Quitar
                      </Button>
                    }
                  />
                ))}
            </div>
          </section>

          <section className="glass-surface rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-semibold text-ink-50">Calendario de actividad</h2>
                <p className="mt-0.5 text-[13px] text-ink-300">Dias trabajados, permisos y ausencias del chofer.</p>
              </div>
              <MonthSelector month={month} onChange={setMonth} allowFuture />
            </div>

            <div className="mt-4">
              {!calendar && !error && <PageLoader />}
              {calendar && <CalendarioAncho data={calendar} selected={selected} onSelect={(dia) => setSelected(dia.fecha)} />}
            </div>

            {selectedDay && (
              <div className="mt-4 rounded-xl border border-line/10 bg-line/[0.03] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[13px] text-ink-200">
                    <b className="text-ink-50">{formatDateOnly(selectedDay.fecha)}</b>
                    {DIA_ESTADOS[selectedDay.estado].label && <> &middot; {DIA_ESTADOS[selectedDay.estado].label}</>}
                    {selectedDay.serviciosDetalle?.length > 0 && (
                      <> &middot; {selectedDay.serviciosDetalle.length} servicio(s)</>
                    )}
                    {selectedDay.adicionales?.length > 0 && <> &middot; {selectedDay.adicionales.length} trabajo(s) adicional(es)</>}
                    {selectedDay.permiso && (
                      <span className="block text-ink-300">
                        {permisoTipoLabel(selectedDay.permiso.tipo)}
                        {selectedDay.permiso.tipo !== "DESCANSO" && `: ${selectedDay.permiso.motivo}`}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedDay.permiso && (
                      <Button variant="ghost" className={SMALL} onClick={() => setRemoveId(selectedDay.permiso.id)}>
                        Quitar permiso
                      </Button>
                    )}
                    {["NO_TRABAJADO", "FUTURO", "HOY"].includes(selectedDay.estado) && (
                      <Button className={SMALL} onClick={goToForm}>
                        Justificar o marcar libre
                      </Button>
                    )}
                  </div>
                </div>
                <ServiciosDelDia servicios={selectedDay.serviciosDetalle} adicionales={selectedDay.adicionales} />
              </div>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          {calendar && <ResumenMesCard data={calendar} />}
          {permisos && <ProximosPermisosCard permisos={permisos} today={calendar?.today ?? `${currentMonth()}-01`} />}
          <RegistrarPermisoCard ref={formRef} driverId={driverId} date={selected} onDone={refreshAll} />
        </aside>
      </div>

      <ConfirmModal
        open={Boolean(removeId)}
        title="Quitar el permiso"
        description="Se borra del calendario del chofer. Ese dia volvera a contar segun sus servicios."
        confirmLabel="Quitar"
        cancelLabel="Volver"
        loading={removing}
        onConfirm={confirmRemove}
        onCancel={() => setRemoveId(null)}
      />
    </div>
  );
};
