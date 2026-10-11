import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_PALETTE, PALETTE_IDS } from "../lib/themes";

const ThemeContext = createContext(null);

const STORAGE_KEY = "gt-theme";
const PALETTE_STORAGE_KEY = "gt-palette";
// Lo que eligio el usuario: "light", "dark" o "system" (sigue al celular). STORAGE_KEY guarda el modo ya resuelto
// (lo lee index.html antes de pintar para no parpadear).
const PREFERENCE_KEY = "gt-theme-pref";
const PREFERENCES = ["light", "dark", "system"];
const DARK_QUERY = "(prefers-color-scheme: dark)";

const systemMode = () =>
  typeof window !== "undefined" && window.matchMedia?.(DARK_QUERY).matches ? "dark" : "light";
const resolveMode = (preference) => (preference === "system" ? systemMode() : preference);

const readStored = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

// La app arrancaba siempre oscura (bg-black fijo); se mantiene "dark" como
// default para que no cambie el aspecto para quien ya la usa.
const getInitialTheme = () => {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("light")) {
    return "light";
  }
  return "dark";
};

const getInitialPreference = () => {
  const stored = readStored(PREFERENCE_KEY);
  if (PREFERENCES.includes(stored)) return stored;
  // Quien ya usaba la app tenia guardado solo el modo (claro u oscuro): se respeta tal cual.
  return getInitialTheme();
};

const getInitialPalette = () => {
  const stored = readStored(PALETTE_STORAGE_KEY);
  return PALETTE_IDS.includes(stored) ? stored : DEFAULT_PALETTE;
};

// Se aplica al <html> de forma sincrona (antes de re-renderizar) para que los
// graficos, que leen colores literales de las variables CSS al renderizar,
// vean ya la paleta nueva y no la anterior.
const applyMode = (mode) => {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("light", mode === "light");
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage puede fallar en navegacion privada; no es critico.
  }
};

const storePreference = (preference) => {
  try {
    localStorage.setItem(PREFERENCE_KEY, preference);
  } catch {
    // idem
  }
};

const applyPalette = (palette) => {
  const root = document.documentElement;
  if (palette === DEFAULT_PALETTE) root.removeAttribute("data-palette");
  else root.setAttribute("data-palette", palette);
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, palette);
  } catch {
    // idem
  }
};

export const ThemeProvider = ({ children }) => {
  const [preference, setPreferenceState] = useState(getInitialPreference);
  const [theme, setThemeState] = useState(() => resolveMode(getInitialPreference()));
  const [palette, setPaletteState] = useState(getInitialPalette);

  const setThemePreference = useCallback((next) => {
    if (!PREFERENCES.includes(next)) return;
    const mode = resolveMode(next);
    storePreference(next);
    applyMode(mode);
    setPreferenceState(next);
    setThemeState(mode);
  }, []);

  // Con "Automatico" el modo sigue al celular, tambien si cambia con la app abierta (p. ej. por la hora).
  useEffect(() => {
    if (preference !== "system" || !window.matchMedia) return undefined;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      const mode = systemMode();
      applyMode(mode);
      setThemeState(mode);
    };
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  const setTheme = useCallback(
    (mode) => {
      if (mode === "dark" || mode === "light") setThemePreference(mode);
    },
    [setThemePreference]
  );

  const setPalette = useCallback((id) => {
    if (!PALETTE_IDS.includes(id)) return;
    applyPalette(id);
    setPaletteState(id);
  }, []);

  // El boton rapido del menu cambia al modo contrario del que se ve ahora (y deja de seguir al celular).
  const toggleTheme = useCallback(() => {
    setThemePreference(theme === "dark" ? "light" : "dark");
  }, [theme, setThemePreference]);

  const value = useMemo(
    () => ({ theme, preference, setTheme, setThemePreference, toggleTheme, palette, setPalette }),
    [theme, preference, setTheme, setThemePreference, toggleTheme, palette, setPalette]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de un ThemeProvider");
  return ctx;
};
