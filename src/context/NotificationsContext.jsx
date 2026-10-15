import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { PHONE_GPS_ENABLED } from "../lib/features";
import { useAuth } from "./AuthContext";
import {
  computeAreaCAlerts,
  computeBirthdayAlerts,
  computeCurrentService,
  computeDriverDocumentAlerts,
  computeLocationPermissionAlerts,
  computeOverdueServices,
  computeMultaAlerts,
  computeMySpeedingAlerts,
  computeVehicleDocumentAlerts,
  computeVehicleMaintenanceAlerts,
} from "../lib/dashboardStats";
import { listDocumentsRequest } from "../lib/documents.api";
import { formatDate } from "../lib/format";
import { desdeCorte } from "../lib/fechasCorte";
import { cancelIdle, scheduleIdle } from "../lib/idle";
import { startVisibleInterval } from "../lib/polling";
import {
  listPendingRecordsRequest,
  listRecordFilesRequest,
  listRecordsRequest,
} from "../lib/records.api";
import { listMultaAlertsRequest } from "../lib/multas.api";
import { getGpsEstadoRequest } from "../lib/gps.api";
import { gpsEstadoTitle, isGpsFailing } from "../lib/gps";
import { listPermisosRequest } from "../lib/permisos.api";
import { computeSeguimientoAlerts } from "../lib/seguimiento";
import { listSeguimientoRequest } from "../lib/seguimiento.api";
import { listUsersRequest } from "../lib/users.api";
import { driverInScope, getNotificationScopeRequest, vehicleInScope } from "../lib/notifications.api";
import {
  getVehicleRequest,
  listMySpeedingEventsRequest,
  listUnpaidAreaCEntriesRequest,
  listVehicleLivePositionsRequest,
  listVehiclesRequest,
} from "../lib/vehicles.api";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
// Las alertas OWNER/ADMIN dependen de tiempos concretos (ETA a 45min, vencimientos
// a 30 dias): se refrescan solas cada 2 minutos para no depender de que el usuario navegue.
const OWNER_REFRESH_MS = 2 * 60 * 1000;
// Cambiar de pantalla vuelve a armar los avisos (unos 15 pedidos en paralelo al servidor), pero no mas de una vez cada tanto: navegar
// rapido entre pantallas disparaba esa rafaga en cada paso. El primer armado de la sesion y el que se hace cada OWNER_REFRESH_MS no se frenan.
const MIN_REBUILD_MS = 30 * 1000;

const SEVERITY_ORDER = { urgent: 0, warning: 1, reminder: 2 };
const sortBySeverity = (list) =>
  [...list].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

// "Eliminar" una notificacion no borra nada del backend (las alertas se recalculan
// solas en cada refresh, no son filas propias) - queda guardado en localStorage (por
// dispositivo/navegador, con la severidad que tenia en ese momento) para no volver a
// mostrarla. Si la misma alerta (mismo id) reaparece MAS grave que cuando se
// descarto (ej. paso de "recordatorio" a "urgente"), se vuelve a mostrar igual - no
// queremos que descartar un aviso temprano termine tapando algo que se puso critico.
const dismissedStorageKey = (userId) => `gt-dismissed-alerts:${userId}`;

const loadDismissed = (userId) => {
  if (!userId) return {};
  try {
    return JSON.parse(localStorage.getItem(dismissedStorageKey(userId))) ?? {};
  } catch {
    return {};
  }
};

const saveDismissed = (userId, dismissed) => {
  if (!userId) return;
  try {
    localStorage.setItem(dismissedStorageKey(userId), JSON.stringify(dismissed));
  } catch {
    // localStorage lleno o bloqueado (modo privado) - no rompe el resto de la app.
  }
};

const isDismissed = (alert, dismissed) => {
  const dismissedSeverity = dismissed[alert.id];
  if (dismissedSeverity == null) return false;
  return SEVERITY_ORDER[alert.severity] >= SEVERITY_ORDER[dismissedSeverity];
};

// Alertas del chofer: solo lo que le pertenece en su trabajo (sus servicios, sus horas, su exceso de velocidad, sus documentos).
// Los avisos de gestion de la flota (tagliando, documentos de vehiculos, Area C...) son de la oficina y no le llegan.
const buildChoferAlerts = async (user) => {
  const records = await listRecordsRequest();
  const list = [];

  computeOverdueServices(records).forEach((record) => {
    list.push({
      id: `overdue-${record.id}`,
      severity: "warning",
      message: `Servicio ${record.codigo} sigue abierto y ya paso su fecha de servicio (${formatDate(record.fechaServicio)}).`,
    });
  });

  // Servicios que otro chofer no pudo terminar y se le asignaron: falta la hora de recepcion.
  records
    .filter((r) => r.origen && !r.traspasoHora && r.estado !== "ANNULLATO" && desdeCorte(r.fechaServicio))
    .forEach((record) => {
      const from = record.origen.chofer ? `${record.origen.chofer.nombre} ${record.origen.chofer.apellido}` : "otro chofer";
      list.push({
        id: `traspaso-${record.id}`,
        severity: "urgent",
        message: `Se te asigno el servicio ${record.origen.codigo} que dejo ${from}. Indica a que hora recibiste el paquete: hasta entonces queda pendiente.`,
        link: `/records/${record.id}`,
      });
    });

  // Horas que el responsable devolvio para corregir.
  records
    .filter((r) => r.jornada?.estado === "DEVUELTAS" && desdeCorte(r.fechaServicio))
    .forEach((record) => {
      list.push({
        id: `horas-devueltas-${record.id}`,
        severity: "warning",
        message: `Tus horas del servicio ${record.codigo} fueron devueltas: ${record.jornada.nota ?? "corrigelas"}.`,
        link: `/records/${record.id}`,
      });
    });

  const current = computeCurrentService(records);
  if (current?.vehicle?.id) {
    try {
      const vehicle = await getVehicleRequest(current.vehicle.id);
      if (vehicle.estado === "EN_MANTENIMIENTO") {
        list.push({
          id: `maintenance-${vehicle.id}`,
          severity: "warning",
          message: `El vehiculo asignado (${vehicle.targa}) esta en mantenimiento.`,
        });
      }
    } catch {
      // si falla la consulta del vehiculo, no bloquea el resto de las alertas
    }
  }

  const now = Date.now();
  const recentDelivered = records.filter(
    (r) =>
      r.estado === "CONSEGNATO" && desdeCorte(r.fechaServicio) && now - new Date(r.fechaServicio).getTime() <= FOURTEEN_DAYS_MS
  );

  const filesByRecord = await Promise.all(
    recentDelivered.map((r) => listRecordFilesRequest(r.id).catch(() => []))
  );

  recentDelivered.forEach((record, idx) => {
    const hasEvidence = filesByRecord[idx].some((f) => f.tipoArchivo === "FOTO_ENTREGA" || f.tipoArchivo === "BOLLA");
    if (!hasEvidence) {
      list.push({
        id: `evidence-${record.id}`,
        severity: "warning",
        message: `Falta subir la foto de entrega del servicio ${record.codigo}.`,
      });
    }
  });

  // Excesos de velocidad del propio chofer (el aviso le llega solo a quien iba al volante).
  list.push(...computeMySpeedingAlerts(await listMySpeedingEventsRequest().catch(() => [])));

  // Sus propios documentos por vencer (carnet, permisos...).
  const myDocuments = await listDocumentsRequest().catch(() => []);
  list.push(...computeDriverDocumentAlerts(myDocuments, [user], new Date(), { propio: true }));

  return list;
};

// Notificaciones OWNER/ADMIN: documentos de choferes y vehiculos por vencer, y
// cumpleanios proximos. Los servicios por vencer (ETA) ya NO estan aca: el panel de
// Pendientes de Registros los cubre mejor (con colores de urgencia), y traer el
// historico completo de registros solo para esa alerta hacia que las notificaciones
// tardaran en cargar. computeLocationPermissionAlerts solo necesita saber que chofer
// esta "en camino" ahora mismo, asi que le alcanza con los pendientes de hoy.
const buildOwnerAlerts = async ({ user }) => {
  const [
    pendingRecords,
    allUsers,
    allVehicles,
    allDocuments,
    areaCEntries,
    multaAlerts,
    permisosPendientes,
    gpsEstado,
    ,
    seguimiento,
    scope,
  ] =
    await Promise.all([
      listPendingRecordsRequest(),
      listUsersRequest(),
      listVehiclesRequest(),
      listDocumentsRequest(),
      // Area C sin pagar: el servidor ya manda solo las de los vehiculos del Responsable.
      listUnpaidAreaCEntriesRequest(),
      // Multas vencidas / por vencer / descuentos pendientes (una sola consulta liviana).
      listMultaAlertsRequest().catch(() => null),
      // Solicitudes de permiso de los choferes esperando respuesta (solo las de su asignacion).
      listPermisosRequest({ estado: "PENDIENTE" }).catch(() => []),
      // Estado del GPS de la flota (OneSystec): avisa si esta bloqueado o caido.
      getGpsEstadoRequest().catch(() => null),
      // Se pide (y se descarta el resultado) solo para que el backend corra la
      // deteccion de Area C/exceso de velocidad como efecto de esta misma consulta
      // (ver checkAreaCEntries/checkSpeedingEvents en vehicle.service.js) - asi corre
      // cada 2 minutos mientras cualquier pantalla de la app este abierta, no solo el Mapa.
      // El resultado real de las alertas viene de las requests de arriba.
      listVehicleLivePositionsRequest().catch(() => null),
      // Seguimiento de servicios en camino: sin GPS activo o fuera de su ETA. De paso el backend manda los push.
      listSeguimientoRequest().catch(() => null),
      // A que vehiculos y choferes se refiere lo suyo (el Admin ve todo).
      getNotificationScopeRequest(user.id).catch(() => ({ todo: true })),
    ]);

  // Un Responsable solo recibe avisos de su asignacion: sus vehiculos y sus choferes.
  const vehicles = allVehicles.filter((v) => vehicleInScope(scope, v.id));
  const users = allUsers.filter((u) => driverInScope(scope, u.id));
  const documents = allDocuments.filter((d) => driverInScope(scope, d.usuarioId));

  // Los avisos del seguimiento (servicio sin GPS o fuera de ETA) piden accion ya: van siempre arriba de todo.
  return [...computeSeguimientoAlerts(seguimiento), ...sortBySeverity([
    ...(PHONE_GPS_ENABLED ? computeLocationPermissionAlerts(users, pendingRecords) : []),
    ...computeDriverDocumentAlerts(documents, users),
    ...computeVehicleDocumentAlerts(vehicles),
    ...computeVehicleMaintenanceAlerts(vehicles),
    ...computeBirthdayAlerts(users),
    ...computeAreaCAlerts(areaCEntries),
    ...computeMultaAlerts(multaAlerts, true),
    // El GPS de toda la flota no es de ningun area: lo ven el Admin y todos los Responsables.
    ...(isGpsFailing(gpsEstado)
      ? [
          {
            id: "gps-flota",
            severity: "urgent",
            message: `${gpsEstadoTitle(gpsEstado)}. Las paradas se calculan con el celular de los choferes que lo autorizaron.`,
            link: "/finanzas/paradas",
          },
        ]
      : []),
    ...(permisosPendientes.length
      ? [
          {
            id: "permisos-pendientes",
            severity: "warning",
            message: `${permisosPendientes.length} ${
              permisosPendientes.length === 1 ? "solicitud de permiso espera" : "solicitudes de permiso esperan"
            } tu respuesta.`,
            link: "/permisos",
          },
        ]
      : []),
  ])];
};

const NotificationsContext = createContext(null);

// Una sola fuente para toda la app: NotificationsBell (header, en cada pantalla) y
// Resumen (pestania Diario) antes llamaban cada uno a su propia copia de este fetch -
// mismos pedidos (users/vehiculos/pendientes/documentos) disparados varias veces en
// simultaneo en cada carga de pagina. Montado una vez en AppShell, todos comparten
// el mismo resultado.
export const NotificationsProvider = ({ children }) => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState({});

  const isChofer = user?.cargo === "CHOFER";
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";

  // Se recarga cada vez que cambia el usuario (login/logout), no solo al montar -
  // sin esto, cerrar sesion y entrar con otra cuenta en el mismo navegador seguia
  // mostrando los descartes del usuario anterior hasta refrescar la pagina entera.
  useEffect(() => {
    setDismissed(loadDismissed(user?.id));
  }, [user?.id]);

  const dismiss = (alert) => {
    setDismissed((prev) => {
      const next = { ...prev, [alert.id]: alert.severity };
      saveDismissed(user?.id, next);
      return next;
    });
  };

  const lastBuildRef = useRef({ key: null, at: 0 });

  useEffect(() => {
    if (!isChofer && !isPrivileged) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const build = () => (isChofer ? buildChoferAlerts(user) : buildOwnerAlerts({ user }));
    const sessionKey = `${user?.id}|${isChofer ? "chofer" : "oficina"}`;

    const run = () => {
      setLoading(true);
      return build()
        .then((list) => {
          if (cancelled) return;
          // Se anota cuando el resultado SE USO: si el armado se cancelo por cambiar de pantalla a mitad, el siguiente no se salta.
          lastBuildRef.current = { key: sessionKey, at: Date.now() };
          setAlerts(list);
        })
        .catch(() => {
          if (!cancelled) setAlerts([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    // Solo se salta el armado por cambio de pantalla: si cambio la sesion o el rol, o pasaron MIN_REBUILD_MS, se arma igual.
    const last = lastBuildRef.current;
    const recent = last.key === sessionKey && Date.now() - last.at < MIN_REBUILD_MS;
    const idleId = recent ? null : scheduleIdle(run);
    // Pausa sola mientras la pestania no esta visible (ver startVisibleInterval) - una
    // pestania olvidada en segundo plano no tiene por que seguir pidiendo esto cada
    // 2 minutos para siempre (5 pedidos en paralelo cada vez, ver buildOwnerAlerts).
    const stopPolling = isPrivileged ? startVisibleInterval(run, OWNER_REFRESH_MS) : null;

    return () => {
      cancelled = true;
      if (idleId != null) cancelIdle(idleId);
      if (stopPolling) stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChofer, isPrivileged, pathname, user?.id]);

  const visibleAlerts = alerts.filter((a) => !isDismissed(a, dismissed));

  return (
    <NotificationsContext.Provider value={{ alerts: visibleAlerts, loading, dismiss }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications debe usarse dentro de un NotificationsProvider");
  return ctx;
};
