import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AUTH_LOGOUT_EVENT, parseApiError, setApiDriverMode } from "../lib/api";
import { loginRequest, meRequest, registerRequest, ssoLoginRequest } from "../lib/auth.api";
import { clearToken, getToken, setToken } from "../lib/token";

const AuthContext = createContext(null);

// Cada cuanto se vuelve a leer el usuario mientras la app esta a la vista, y el minimo entre dos lecturas.
const REFRESH_INTERVAL_MS = 60_000;
const REFRESH_MIN_GAP_MS = 15_000;
// Lo que cambia la vista o los permisos: si ninguno cambio no se toca el estado (evita renders de mas).
const ACCESS_FIELDS = ["cargo", "estado", "responsableTipo", "area", "nivelChofer", "areasPermitidas", "vehiculoAsignadoId"];
const accessChanged = (a, b) => ACCESS_FIELDS.some((key) => JSON.stringify(a?.[key]) !== JSON.stringify(b?.[key]));

const DRIVER_MODE_KEY = "gamonal-driver-mode";
const readDriverModePref = () => {
  try {
    return localStorage.getItem(DRIVER_MODE_KEY) === "1";
  } catch {
    return false;
  }
};
// Antes del primer pedido: el servidor ya responde en modo chofer desde la primera carga (si no es Admin/Owner lo ignora).
setApiDriverMode(readDriverModePref());

export const AuthProvider = ({ children }) => {
  const [realUser, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const hydrate = useCallback(async () => {
    if (!getToken()) {
      setInitializing(false);
      return;
    }
    try {
      const me = await meRequest();
      setUser(me);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    // Llegó desde el portal de OneSystec con un ticket de un solo uso
    // (?sso=...): lo cambiamos por una sesión real acá, sin pedir password.
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get("sso");
    if (!ticket) {
      hydrate();
      return;
    }

    (async () => {
      try {
        const { user: ssoUser, accessToken } = await ssoLoginRequest(ticket);
        setToken(accessToken);
        setUser(ssoUser);
      } catch {
        clearToken();
        setUser(null);
      } finally {
        params.delete("sso");
        const rest = params.toString();
        window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : ""));
        setInitializing(false);
      }
    })();
  }, [hydrate]);

  // El rol lo cambia otra persona (el Admin) y el servidor ya lo aplica en el siguiente pedido, pero esta
  // pantalla lo cargo al abrir. Se vuelve a leer al volver a la app y cada minuto mientras esta a la vista, y
  // la vista (menu, inicio, permisos) se rearma sola porque todo sale de este usuario.
  const lastRefreshRef = useRef(0);
  const refreshUser = useCallback(async ({ force = false } = {}) => {
    if (!getToken()) return;
    const now = Date.now();
    if (!force && now - lastRefreshRef.current < REFRESH_MIN_GAP_MS) return;
    lastRefreshRef.current = now;
    try {
      const me = await meRequest();
      setUser((prev) => (prev && prev.id === me.id && !accessChanged(prev, me) ? prev : me));
    } catch {
      // Sin red o servidor dormido: se reintenta en la siguiente vuelta. Un 401 ya cierra la sesion en api.js.
    }
  }, []);

  useEffect(() => {
    if (!realUser?.id) return undefined;
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshUser();
    };
    const timer = window.setInterval(onVisible, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [realUser?.id, refreshUser]);

  useEffect(() => {
    const handleForcedLogout = () => setUser(null);
    window.addEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout);
  }, []);

  const login = useCallback(async (credentials) => {
    try {
      const { user: loggedUser, token } = await loginRequest(credentials);
      setToken(token);
      setUser(loggedUser);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: parseApiError(error) };
    }
  }, []);

  const register = useCallback(async (payload) => {
    try {
      const { user: newUser, token } = await registerRequest(payload);
      setToken(token);
      setUser(newUser);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: parseApiError(error) };
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  // Modo chofer: solo OWNER y ADMIN. Con el switch activo ven la app exactamente como un chofer (menu, inicio,
  // permisos). El cambio es siempre manual y se recuerda en este dispositivo. El usuario real no se toca: el
  // servidor sigue viendo su cargo de siempre.
  const canUseDriverMode = realUser?.cargo === "OWNER" || realUser?.cargo === "ADMIN";
  const [driverModePref, setDriverModePref] = useState(readDriverModePref);
  const driverMode = canUseDriverMode && driverModePref;

  const setDriverMode = useCallback((next) => {
    setApiDriverMode(next);
    setDriverModePref(Boolean(next));
    try {
      if (next) localStorage.setItem(DRIVER_MODE_KEY, "1");
      else localStorage.removeItem(DRIVER_MODE_KEY);
    } catch {
      // Sin almacenamiento (navegacion privada): el modo vale solo mientras la app esta abierta.
    }
  }, []);

  // Lo que ve el resto de la app: el usuario real, o el mismo usuario como CHOFER mientras el modo esta activo.
  const user = useMemo(
    () => (driverMode && realUser ? { ...realUser, cargo: "CHOFER", areasPermitidas: [], responsableTipo: null } : realUser),
    [driverMode, realUser]
  );

  const value = useMemo(
    () => ({
      user,
      realUser,
      canUseDriverMode,
      driverMode,
      setDriverMode,
      isAuthenticated: Boolean(realUser),
      initializing,
      login,
      register,
      logout,
      setUser,
      refreshUser,
    }),
    [user, realUser, canUseDriverMode, driverMode, setDriverMode, initializing, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de un AuthProvider");
  return ctx;
};
