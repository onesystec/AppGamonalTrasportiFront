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
