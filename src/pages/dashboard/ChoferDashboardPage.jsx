import { useCallback, useEffect, useRef, useState } from "react";
import { MancatoBanner } from "../../components/chofer/MancatoBanner";
import { RendimientoCard } from "../../components/chofer/RendimientoCard";
import { ResumenServiciosCard } from "../../components/chofer/ResumenServiciosCard";
import { ServiciosPendientesCard } from "../../components/chofer/ServiciosPendientesCard";
import { RecepcionPaqueteCard } from "../../components/horas/RecepcionPaqueteCard";
import { Alert } from "../../components/ui/Alert";
import { GlassCard } from "../../components/ui/GlassCard";
import { PageLoader } from "../../components/ui/PageLoader";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { useCerrarServicio } from "../../hooks/useCerrarServicio";
import { parseApiError } from "../../lib/api";
import { computeMyServiceCounts } from "../../lib/dashboardStats";
import { desdeCorte } from "../../lib/fechasCorte";
import { isPending, sortPending } from "../../lib/pendientes";
import { getSinSustentarRequest, listRecordsRequest } from "../../lib/records.api";
import { getMyDrivingStyleRequest, getMyProgressRequest } from "../../lib/metas.api";

export const ChoferDashboardPage = () => {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(null);
  const [estilo, setEstilo] = useState(null);
  const [sinSustentar, setSinSustentar] = useState(null);

  const load = useCallback(() => {
    setError("");
    listRecordsRequest()
      .then(setRecords)
      .catch((err) => setError(parseApiError(err).message));
    // La meta es un extra: si falla, el resto del dashboard se ve igual.
    getMyProgressRequest()
      .then(setProgress)
      .catch(() => {});
    // Registros sin sustentar (peajes y carburante): tambien un extra, no frena el resto.
    getSinSustentarRequest()
      .then(setSinSustentar)
      .catch(() => {});
    // El estilo de manejo viene del GPS y puede tardar: va aparte para no demorar el resto de la tarjeta.
    getMyDrivingStyleRequest()
      .then(setEstilo)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Al cerrar un servicio con "Guardar y salir" se recarga solo la lista de servicios (Mis servicios pendientes), no todo el dashboard.
  const { version: recordsVersion } = useDataRefresh("records");
  const seenRecordsVersion = useRef(recordsVersion);
  useEffect(() => {
    if (seenRecordsVersion.current === recordsVersion) return;
    seenRecordsVersion.current = recordsVersion;
    listRecordsRequest()
      .then(setRecords)
      .catch(() => {});
  }, [recordsVersion]);

  // Los servicios que aun no tienen su estilo de manejo se piden de a uno al GPS en segundo plano: mientras se calcula, se vuelve a consultar
  // cada tanto (hasta unos 5 minutos) para que el porcentaje aparezca solo.
  const calculandoEstilo = Boolean(estilo?.calculando);
  useEffect(() => {
    if (!calculandoEstilo) return undefined;
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      if (tries > 15) return clearInterval(id);
      getMyDrivingStyleRequest()
        .then(setEstilo)
        .catch(() => {});
      return undefined;
    }, 20000);
    return () => clearInterval(id);
  }, [calculandoEstilo]);

  const actions = useCerrarServicio(load);

  if (error) return <Alert>{error}</Alert>;

  if (!records) return <PageLoader />;

  // Solo lo que le pide algo: terminar el servicio, cargar horas, declarar peajes o carburante.
  const pendingServices = records.filter(isPending).sort(sortPending);
  // Servicios que otro chofer no pudo terminar y se le asignaron a este: falta la hora de recepcion.
  const awaitingReception = records.filter(
    (r) => r.origen && !r.traspasoHora && r.estado !== "ANNULLATO" && desdeCorte(r.fechaServicio)
  );
  const myServiceCounts = computeMyServiceCounts(records);

  return (
    <div className="flex flex-col gap-5">
      {awaitingReception.length > 0 && (
        <GlassCard className="border border-warning-500/30">
          <div className="flex flex-col divide-y divide-line/10">
            {awaitingReception.map((record) => (
              <RecepcionPaqueteCard key={record.id} record={record} onDone={load} className="py-3 first:pt-0 last:pb-0" />
            ))}
          </div>
        </GlassCard>
      )}

      <ServiciosPendientesCard
        services={pendingServices}
        openingId={actions.openingId}
        uploadingId={actions.uploadingId}
        errors={actions.errors}
        onClose={actions.onClose}
        onUpload={actions.onUpload}
      />

      <RendimientoCard progress={progress} estilo={estilo} sinSustentar={sinSustentar} />

      <ResumenServiciosCard counts={myServiceCounts} />

      <MancatoBanner />

      {actions.modal}
    </div>
  );
};
