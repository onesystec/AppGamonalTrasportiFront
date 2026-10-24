import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { GuestRoute } from "./components/layout/GuestRoute";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { PageLoader } from "./components/ui/PageLoader";
import { useAuth } from "./context/AuthContext";
import { CARGO_LABELS } from "./lib/constants";
import { DataRefreshProvider } from "./context/DataRefreshContext";

// Paginas cargadas de forma perezosa (React.lazy): antes se importaban todas de
// forma estatica y Vite las metia junto con sus dependencias (recharts, Google Maps,
// etc.) en un unico bundle de ~1.2MB que se descargaba antes de poder ver siquiera el
// login. Con lazy(), cada pagina (y lo que solo ella usa) se descarga recien cuando el
// usuario navega a esa ruta.
const ForgotPasswordPage = lazy(() =>
  import("./pages/auth/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })),
);
const MisServiciosPage = lazy(() =>
  import("./pages/servicios/MisServiciosPage").then((m) => ({ default: m.MisServiciosPage }))
);
const MemorandumsPage = lazy(() => import("./pages/memorandums/MemorandumsPage").then((m) => ({ default: m.MemorandumsPage })));
const EmitirMemorandumPage = lazy(() => import("./pages/memorandums/EmitirMemorandumPage").then((m) => ({ default: m.EmitirMemorandumPage })));
const MemorandumDetailPage = lazy(() => import("./pages/memorandums/MemorandumDetailPage").then((m) => ({ default: m.MemorandumDetailPage })));
const RrhhLayout = lazy(() => import("./pages/rrhh/RrhhLayout").then((m) => ({ default: m.RrhhLayout })));
const RrhhIndex = lazy(() => import("./pages/rrhh/RrhhLayout").then((m) => ({ default: m.RrhhIndex })));
const BustaPagaRrhhPage = lazy(() =>
  import("./pages/bustapaga/BustaPagaRrhhPage").then((m) => ({ default: m.BustaPagaRrhhPage }))
);
const LoginPage = lazy(() => import("./pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage").then((m) => ({ default: m.RegisterPage })));
const ResetPasswordPage = lazy(() =>
  import("./pages/auth/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })),
);
const DashboardPage = lazy(() =>
  import("./pages/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const DriverDetailPage = lazy(() =>
  import("./pages/drivers/DriverDetailPage").then((m) => ({ default: m.DriverDetailPage })),
);
const DriversPage = lazy(() => import("./pages/drivers/DriversPage").then((m) => ({ default: m.DriversPage })));
const NewDriverPage = lazy(() =>
  import("./pages/drivers/NewDriverPage").then((m) => ({ default: m.NewDriverPage })),
);
const MapPage = lazy(() => import("./pages/map/MapPage").then((m) => ({ default: m.MapPage })));
const SeguimientoPage = lazy(() => import("./pages/map/SeguimientoPage").then((m) => ({ default: m.SeguimientoPage })));
const AreaCPage = lazy(() => import("./pages/finanzas/AreaCPage").then((m) => ({ default: m.AreaCPage })));
const MecanicaPage = lazy(() => import("./pages/mecanica/MecanicaPage").then((m) => ({ default: m.MecanicaPage })));
const DailySummaryPage = lazy(() =>
  import("./pages/notifications/DailySummaryPage").then((m) => ({ default: m.DailySummaryPage })),
);
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const ProfilePage = lazy(() => import("./pages/profile/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const NewDhlAbServiceRecordPage = lazy(() =>
  import("./pages/records/NewDhlAbServiceRecordPage").then((m) => ({ default: m.NewDhlAbServiceRecordPage })),
);
const NewExtrasStefaniaRecordPage = lazy(() =>
  import("./pages/records/NewExtrasStefaniaRecordPage").then((m) => ({ default: m.NewExtrasStefaniaRecordPage })),
);
const NewRecordPage = lazy(() =>
  import("./pages/records/NewRecordPage").then((m) => ({ default: m.NewRecordPage })),
);
const RecordDetailPage = lazy(() =>
  import("./pages/records/RecordDetailPage").then((m) => ({ default: m.RecordDetailPage })),
);
const RecordsListPage = lazy(() =>
  import("./pages/records/RecordsListPage").then((m) => ({ default: m.RecordsListPage })),
);
const NewVehiclePage = lazy(() =>
  import("./pages/vehicles/NewVehiclePage").then((m) => ({ default: m.NewVehiclePage })),
);
const VehicleDetailPage = lazy(() =>
  import("./pages/vehicles/VehicleDetailPage").then((m) => ({ default: m.VehicleDetailPage })),
);
const MancatoPagamentoPage = lazy(() =>
  import("./pages/mancato/MancatoPagamentoPage").then((m) => ({ default: m.MancatoPagamentoPage })),
);
const SollecitiPage = lazy(() =>
  import("./pages/sollecito/SollecitiPage").then((m) => ({ default: m.SollecitiPage })),
);
const NewMancatoPage = lazy(() =>
  import("./pages/mancato/NewMancatoPage").then((m) => ({ default: m.NewMancatoPage })),
);
const MancatoDetailPage = lazy(() =>
  import("./pages/mancato/MancatoDetailPage").then((m) => ({ default: m.MancatoDetailPage })),
);
const CombustiblePage = lazy(() =>
  import("./pages/combustible/CombustiblePage").then((m) => ({ default: m.CombustiblePage })),
);
const NewCombustiblePage = lazy(() =>
  import("./pages/combustible/NewCombustiblePage").then((m) => ({ default: m.NewCombustiblePage })),
);
const CombustibleDetailPage = lazy(() =>
  import("./pages/combustible/CombustibleDetailPage").then((m) => ({ default: m.CombustibleDetailPage })),
);
const FinanzasLayout = lazy(() =>
  import("./pages/finanzas/FinanzasLayout").then((m) => ({ default: m.FinanzasLayout })),
);
const FinanzasResumenPage = lazy(() =>
  import("./pages/finanzas/FinanzasResumenPage").then((m) => ({ default: m.FinanzasResumenPage })),
);
const PagosChoferesPage = lazy(() =>
  import("./pages/finanzas/PagosChoferesPage").then((m) => ({ default: m.PagosChoferesPage })),
);
const HorasAprobacionPage = lazy(() =>
  import("./pages/finanzas/HorasAprobacionPage").then((m) => ({ default: m.HorasAprobacionPage })),
);
const ParadasPage = lazy(() => import("./pages/finanzas/ParadasPage").then((m) => ({ default: m.ParadasPage })));
const MiCalendarioPage = lazy(() =>
  import("./pages/calendario/MiCalendarioPage").then((m) => ({ default: m.MiCalendarioPage })),
);
const PermisosChoferPage = lazy(() =>
  import("./pages/calendario/PermisosChoferPage").then((m) => ({ default: m.PermisosChoferPage })),
);
const VencimientosPage = lazy(() =>
  import("./pages/vencimientos/VencimientosPage").then((m) => ({ default: m.VencimientosPage })),
);
const ClienteApp = lazy(() => import("./pages/cliente/ClienteApp").then((m) => ({ default: m.ClienteApp })));
const AccesoClientesPage = lazy(() =>
  import("./pages/clientes/AccesoClientesPage").then((m) => ({ default: m.AccesoClientesPage })),
);
const PermisosPage = lazy(() =>
  import("./pages/calendario/PermisosPage").then((m) => ({ default: m.PermisosPage })),
);
const TrabajosAdicionalesPage = lazy(() => import("./pages/trabajos/TrabajosAdicionalesPage").then((m) => ({ default: m.TrabajosAdicionalesPage })));
const MisHorasPage = lazy(() => import("./pages/horas/MisHorasPage").then((m) => ({ default: m.MisHorasPage })));
const GastosServiciosPage = lazy(() =>
  import("./pages/finanzas/GastosServiciosPage").then((m) => ({ default: m.GastosServiciosPage })),
);
const MultasPage = lazy(() => import("./pages/multas/MultasPage").then((m) => ({ default: m.MultasPage })));
const NewMultaPage = lazy(() => import("./pages/multas/NewMultaPage").then((m) => ({ default: m.NewMultaPage })));
const MultaDetailPage = lazy(() =>
  import("./pages/multas/MultaDetailPage").then((m) => ({ default: m.MultaDetailPage })),
);
const VehiclesPage = lazy(() => import("./pages/vehicles/VehiclesPage").then((m) => ({ default: m.VehiclesPage })));

// Rutas de detalle/alta que las listas (Registros, Choferes, Vehiculos) pueden abrir
// como overlay superpuesto en vez de reemplazarse a si mismas - ver backgroundLocation
// mas abajo. Comparten path con sus rutas "normales" de mas abajo a proposito: si no
// hay backgroundLocation (entrada directa por URL, o un link que no la pasa, ej. desde
// el Dashboard o el Mapa), esas mismas paginas se siguen sirviendo ahi como pagina
// completa, exactamente como antes de este cambio.
// /multas/123 -> /finanzas/multas/123 (conserva lo que sigue y la query).
const LegacyRedirect = ({ from, to }) => {
  const location = useLocation();
  return <Navigate to={`${to}${location.pathname.slice(from.length)}${location.search}`} replace />;
};

// Pantallas de un solo perfil: el calendario es del chofer y los permisos de la oficina.
// allowRrhh: Recursos Humanos tambien entra (Choferes y Vehiculos).
const RoleOnly = ({ privileged, allowRrhh = false, redirectTo = "/", children }) => {
  const { user } = useAuth();
  const isPrivileged = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const isRrhh = user?.cargo === "RRHH";
  if (isRrhh) return allowRrhh ? children : <Navigate to="/busta-paga" replace />;
  return isPrivileged === privileged ? children : <Navigate to={redirectTo} replace />;
};

// Recursos Humanos (Busta paga + Memorandums) solo usa esa seccion, Choferes, Vehiculos y su perfil; cualquier otra direccion lo lleva a
// Busta paga (el servidor ademas le niega todo lo demas).
const RRHH_PATHS = ["/rrhh", "/busta-paga", "/memorandums", "/choferes", "/vehiculos", "/vencimientos", "/profile"];
const RrhhGuard = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (user?.cargo === "RRHH" && !RRHH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return <Navigate to="/busta-paga" replace />;
  }
  return <Outlet />;
};

// Direccion de la vista de un cliente (/cliente/...) abierta mientras todavia se inicia la sesion: espera, sin mandar a nadie al inicio. Cuando
// la sesion carga y es de un cliente, App muestra su propia vista; si no lo es, vuelve al inicio (o al login si no hay sesion).
const ClienteRutaPendiente = () => {
  const { isAuthenticated, initializing } = useAuth();
  if (initializing) return <PageLoader />;
  return <Navigate to={isAuthenticated ? "/" : "/login"} replace />;
};

const OverlayRoutes = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/records/extras-piazza/new" element={<NewRecordPage />} />
        <Route path="/records/dhl-ab-service/new" element={<NewDhlAbServiceRecordPage />} />
        <Route path="/records/extras-stefania/new" element={<NewExtrasStefaniaRecordPage />} />
        <Route path="/records/:id" element={<RecordDetailPage />} />
        <Route path="/choferes/new" element={<RoleOnly privileged allowRrhh><NewDriverPage /></RoleOnly>} />
        <Route path="/choferes/:id" element={<RoleOnly privileged allowRrhh><DriverDetailPage /></RoleOnly>} />
        <Route path="/vehiculos/new" element={<RoleOnly privileged allowRrhh><NewVehiclePage /></RoleOnly>} />
        <Route path="/vehiculos/:id" element={<RoleOnly privileged allowRrhh><VehicleDetailPage /></RoleOnly>} />
        <Route path="/finanzas/mancato/new" element={<NewMancatoPage />} />
        <Route path="/finanzas/mancato/:id" element={<MancatoDetailPage />} />
        <Route path="/finanzas/multas/new" element={<RoleOnly privileged redirectTo="/finanzas/combustible"><NewMultaPage /></RoleOnly>} />
        <Route path="/finanzas/multas/:id" element={<RoleOnly privileged redirectTo="/finanzas/combustible"><MultaDetailPage /></RoleOnly>} />
        <Route path="/finanzas/combustible/new" element={<NewCombustiblePage />} />
        <Route path="/finanzas/combustible/:id" element={<CombustibleDetailPage />} />
      </Route>
    </Routes>
  </Suspense>
);

// Cuando el Admin le cambia el cargo a alguien con la app abierta, AuthContext lo detecta y la vista (menu, inicio,
// permisos) se rearma sola. Aqui se lleva a la persona a su nueva pantalla de inicio y se le avisa.
const RoleChangeNotice = () => {
  // El cargo real, no el de la vista: el switch de modo chofer del Admin no es un cambio de cargo.
  const { realUser: user } = useAuth();
  const navigate = useNavigate();
  const lastRef = useRef({ id: null, cargo: null });
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const last = lastRef.current;
    if (user?.id && last.id === user.id && last.cargo && last.cargo !== user.cargo) {
      navigate("/", { replace: true });
      setNotice(`Tu cargo cambió a ${CARGO_LABELS[user.cargo] ?? user.cargo}. Ya se actualizó tu pantalla.`);
    }
    lastRef.current = { id: user?.id ?? null, cargo: user?.cargo ?? null };
  }, [user?.id, user?.cargo, navigate]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 8000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 top-4 z-[100] mx-auto max-w-md rounded-2xl bg-accent-500 px-4 py-3 text-center text-[14px] font-medium text-white shadow-lg"
      onClick={() => setNotice("")}
    >
      {notice}
    </div>
  );
};

function App() {
  const location = useLocation();
  const { user: sessionUser } = useAuth();
  const isCliente = sessionUser?.cargo === "CLIENTE";
  // Al navegar a un detalle/alta desde una lista (RecordsListPage/DriversPage/
  // VehiclesPage pasan backgroundLocation en el "state" del Link), la lista sigue
  // pintandose de fondo con la location de ANTES de navegar (nunca se desmonta, no
  // pierde su estado/no repite fetches) y el detalle/alta se superpone encima en un
  // <Routes> aparte con la location real - patron estandar de "modal route" de
  // react-router.
  const backgroundLocation = location.state?.backgroundLocation;

  // Un usuario de una empresa cliente tiene su propia vista (seguimiento de sus servicios), sin las pantallas de chofer ni de oficina.
  if (isCliente) return <Suspense fallback={<PageLoader />}><ClienteApp /></Suspense>;

  return (
    <DataRefreshProvider>
      <RoleChangeNotice />
      <Suspense fallback={<PageLoader />}>
        <Routes location={backgroundLocation ?? location}>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<RrhhGuard />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/resumen" element={<RoleOnly privileged><DailySummaryPage /></RoleOnly>} />
              <Route path="/mis-horas" element={<MisHorasPage />} />
              <Route path="/trabajos-adicionales" element={<TrabajosAdicionalesPage />} />
              <Route
                path="/mis-servicios"
                element={
                  <RoleOnly privileged={false}>
                    <MisServiciosPage />
                  </RoleOnly>
                }
              />
              <Route
                path="/calendario"
                element={
                  <RoleOnly privileged={false}>
                    <MiCalendarioPage />
                  </RoleOnly>
                }
              />
              <Route
                path="/permisos"
                element={
                  <RoleOnly privileged>
                    <PermisosPage />
                  </RoleOnly>
                }
              />
              <Route
                path="/permisos/:driverId"
                element={
                  <RoleOnly privileged>
                    <PermisosChoferPage />
                  </RoleOnly>
                }
              />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/ajustes" element={<SettingsPage />} />
              <Route path="/records" element={<RecordsListPage />} />
              <Route path="/records/extras-piazza" element={<RecordsListPage section="extras-piazza" />} />
              <Route path="/records/extras-piazza/new" element={<NewRecordPage />} />
              <Route path="/records/dhl-ab-service" element={<RecordsListPage section="dhl-ab-service" />} />
              <Route path="/records/dhl-ab-service/new" element={<NewDhlAbServiceRecordPage />} />
              <Route path="/records/extras-stefania" element={<RecordsListPage section="extras-stefania" />} />
              <Route path="/records/extras-stefania/new" element={<NewExtrasStefaniaRecordPage />} />
              <Route path="/records/:id" element={<RecordDetailPage />} />
              <Route path="/vencimientos" element={<RoleOnly privileged allowRrhh><VencimientosPage /></RoleOnly>} />
              <Route path="/acceso-clientes" element={<RoleOnly privileged><AccesoClientesPage /></RoleOnly>} />
              <Route path="/choferes" element={<RoleOnly privileged allowRrhh><DriversPage /></RoleOnly>} />
              <Route path="/choferes/new" element={<RoleOnly privileged allowRrhh><NewDriverPage /></RoleOnly>} />
              <Route path="/choferes/:id" element={<RoleOnly privileged allowRrhh><DriverDetailPage /></RoleOnly>} />
              <Route path="/vehiculos" element={<RoleOnly privileged allowRrhh><VehiclesPage /></RoleOnly>} />
              <Route path="/vehiculos/new" element={<RoleOnly privileged allowRrhh><NewVehiclePage /></RoleOnly>} />
              <Route path="/vehiculos/:id" element={<RoleOnly privileged allowRrhh><VehicleDetailPage /></RoleOnly>} />
              <Route path="/finanzas" element={<FinanzasLayout />}>
                <Route index element={<FinanzasResumenPage />} />
                <Route path="pagos" element={<RoleOnly privileged><PagosChoferesPage /></RoleOnly>} />
                <Route path="horas" element={<RoleOnly privileged><HorasAprobacionPage /></RoleOnly>} />
                <Route path="paradas" element={<RoleOnly privileged><ParadasPage /></RoleOnly>} />
                <Route path="gastos" element={<RoleOnly privileged><GastosServiciosPage /></RoleOnly>} />
                <Route path="area-c" element={<RoleOnly privileged><AreaCPage /></RoleOnly>} />
                <Route path="mancato" element={<MancatoPagamentoPage />} />
                <Route path="mancato/new" element={<NewMancatoPage />} />
                <Route path="mancato/:id" element={<MancatoDetailPage />} />
                <Route path="sollecitos" element={<RoleOnly privileged redirectTo="/finanzas/combustible"><SollecitiPage /></RoleOnly>} />
                <Route path="solicitos" element={<Navigate to="/finanzas/sollecitos" replace />} />
                {/* Las multas son de la oficina: el chofer solo ve Combustible y Mancato Pagamento. */}
                <Route path="multas" element={<RoleOnly privileged redirectTo="/finanzas/combustible"><MultasPage /></RoleOnly>} />
                <Route path="multas/new" element={<RoleOnly privileged redirectTo="/finanzas/combustible"><NewMultaPage /></RoleOnly>} />
                <Route path="multas/:id" element={<RoleOnly privileged redirectTo="/finanzas/combustible"><MultaDetailPage /></RoleOnly>} />
                <Route path="combustible" element={<CombustiblePage />} />
                <Route path="combustible/new" element={<NewCombustiblePage />} />
                <Route path="combustible/:id" element={<CombustibleDetailPage />} />
              </Route>
              {/* Las rutas de antes de Finanzas Operativas siguen funcionando (enlaces viejos, APK). */}
              <Route path="/mancato-pagamento/*" element={<LegacyRedirect from="/mancato-pagamento" to="/finanzas/mancato" />} />
              <Route path="/multas/*" element={<LegacyRedirect from="/multas" to="/finanzas/multas" />} />
              <Route path="/combustible/*" element={<LegacyRedirect from="/combustible" to="/finanzas/combustible" />} />
              <Route path="/mapa" element={<RoleOnly privileged><MapPage /></RoleOnly>} />
              <Route path="/mapa/seguimiento" element={<RoleOnly privileged><SeguimientoPage /></RoleOnly>} />
              {/* El Area C ahora vive en Finanzas; el enlace viejo sigue funcionando. */}
              <Route path="/mapa/area-c" element={<Navigate to="/finanzas/area-c" replace />} />
              {/* Control de Flota ya no existe: Area C esta en Finanzas y los excesos de velocidad en Vehiculos. */}
              <Route path="/control-flota" element={<Navigate to="/vehiculos" replace />} />
              <Route path="/mecanica" element={<RoleOnly privileged><MecanicaPage /></RoleOnly>} />
              <Route path="/rrhh" element={<RrhhIndex />} />
              <Route element={<RrhhLayout />}>
                <Route path="/busta-paga" element={<BustaPagaRrhhPage />} />
                <Route path="/memorandums" element={<MemorandumsPage />} />
                <Route path="/memorandums/nuevo" element={<EmitirMemorandumPage />} />
                <Route path="/memorandums/emitidos/:id" element={<MemorandumDetailPage />} />
              </Route>
            </Route>
            </Route>
          </Route>

          <Route path="/cliente/*" element={<ClienteRutaPendiente />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {backgroundLocation && <OverlayRoutes />}
    </DataRefreshProvider>
  );
}

export default App;
