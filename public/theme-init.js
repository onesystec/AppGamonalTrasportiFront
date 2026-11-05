// Tema y paleta antes de pintar (evita el parpadeo). Va en un archivo propio y no en linea porque el CSP no permite scripts en linea.
(function () {
  try {
    var theme = localStorage.getItem("gt-theme") || "dark";
    if (localStorage.getItem("gt-theme-pref") === "system" && window.matchMedia) {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.classList.add(theme);
    // Dentro de OneSystec (en un marco) la paleta se guarda aparte y por defecto es Oceano; lo que el usuario elija manda.
    var framed = window.self !== window.top;
    var palette = localStorage.getItem(framed ? "gt-palette-onesystec" : "gt-palette");
    if (!palette && framed) palette = "oceano";
    if (palette && palette !== "clasico") {
      document.documentElement.setAttribute("data-palette", palette);
    }
  } catch (e) {
    document.documentElement.classList.add("dark");
  }
})();
