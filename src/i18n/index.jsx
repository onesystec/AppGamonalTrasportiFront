import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { onParentLanguage } from "../lib/embedded";
import { es } from "./es";
import { it } from "./it";

// Idioma de las vistas del usuario cliente. Dentro de OneSystec lo manda OneSystec (cada cuenta tiene el suyo); por su cuenta, espanol.
const DICTIONARIES = { es, it };
const LOCALES = { es: "es-AR", it: "it-IT" };
const STORAGE_KEY = "gt-embedded-language";

// Solo en la sesion de esta pestana: el idioma que manda OneSystec no debe cambiar la app abierta por su cuenta.
const initialLanguage = () => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored === "it" || stored === "es" ? stored : "es";
  } catch {
    return "es";
  }
};

// "{nombre}" se rellena con los parametros. Si hay una clave "_one" y count es 1, se usa esa (cada idioma escribe su singular).
export const translate = (language, key, params) => {
  const dictionary = DICTIONARIES[language] ?? es;
  const template = (params?.count === 1 && dictionary[`${key}_one`]) || dictionary[key] || es[key] || key;
  return params ? template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match)) : template;
};

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(initialLanguage);

  useEffect(
    () =>
      onParentLanguage((value) => {
        setLanguage(value);
        try {
          sessionStorage.setItem(STORAGE_KEY, value);
        } catch {
          // Sin almacenamiento, la proxima vez arranca en espanol hasta que OneSystec lo mande.
        }
      }),
    []
  );

  const t = useCallback((key, params) => translate(language, key, params), [language]);
  // Idioma elegido por el propio usuario (el personal, en Ajustes de la app): solo "es" o "it".
  const chooseLanguage = useCallback((value) => {
    if (value === "es" || value === "it") setLanguage(value);
  }, []);
  const value = useMemo(() => ({ language, locale: LOCALES[language], t, setLanguage: chooseLanguage }), [language, t, chooseLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage debe usarse dentro de un LanguageProvider");
  return ctx;
};

export const useT = () => useLanguage().t;

// El personal de la oficina (no el cliente, cuyo idioma lo manda OneSystec) usa el idioma guardado en su cuenta, en cualquier dispositivo.
export const IdiomaSync = () => {
  const { realUser } = useAuth();
  const { setLanguage } = useLanguage();
  const idioma = realUser && realUser.cargo !== "CLIENTE" ? realUser.idioma : null;
  useEffect(() => {
    if (idioma) setLanguage(idioma);
  }, [idioma, setLanguage]);
  return null;
};
