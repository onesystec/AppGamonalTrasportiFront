// La app puede abrirse dentro de OneSystec (en un marco). Ahi la sesion la maneja OneSystec: no se cierra desde aqui, y un mapa a pantalla
// completa tambien tiene que ocupar la de OneSystec.
export const isEmbedded = (() => {
  try {
    return window.self !== window.top;
  } catch {
    // Un navegador que niega el acceso a window.top es porque estamos dentro de un marco de otro sitio.
    return true;
  }
})();

// Avisa a OneSystec de que un mapa paso a pantalla completa (o salio), para que esconda su propia cabecera. No lleva datos: solo el estado.
export const notifyParentFullscreen = (value) => {
  if (!isEmbedded) return;
  try {
    window.parent.postMessage({ source: "gamonal-driver", type: "fullscreen", value: Boolean(value) }, "*");
  } catch {
    // Sin padre al que avisar: el mapa igual ocupa todo el marco.
  }
};

// OneSystec manda su tema (claro/oscuro) y aqui se sigue: dentro de OneSystec no hay un tema propio que elegir. Solo se cree al padre directo.
export const onParentTheme = (callback) => {
  if (!isEmbedded) return () => {};
  const onMessage = (event) => {
    if (event.source !== window.parent) return;
    const data = event.data;
    if (data?.source === "onesystec" && data.type === "theme" && (data.value === "dark" || data.value === "light")) callback(data.value);
  };
  window.addEventListener("message", onMessage);
  // La app tarda en arrancar (entra con SSO): se avisa al padre cuando ya escucha para que mande el tema de nuevo.
  try {
    window.parent.postMessage({ source: "gamonal-driver", type: "ready" }, "*");
  } catch {
    // Sin padre al que avisar: se queda con su tema.
  }
  return () => window.removeEventListener("message", onMessage);
};

// El idioma de la cuenta, tambien lo manda OneSystec (junto con el tema). Mismo criterio: solo se cree al padre directo.
export const onParentLanguage = (callback) => {
  if (!isEmbedded) return () => {};
  const onMessage = (event) => {
    if (event.source !== window.parent) return;
    const data = event.data;
    if (data?.source === "onesystec" && data.type === "language" && (data.value === "es" || data.value === "it")) callback(data.value);
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
};
