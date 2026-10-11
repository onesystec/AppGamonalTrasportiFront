// Colores de los peajes en los mapas: notorios y distintos del resto (rutas azules/verdes, pines de servicios).
export const PEAJE_COLOR_EN_RUTA = "#ff2bd6";
export const PEAJE_COLOR_CERCA = "#ff8a1a";
export const RUTA_COLOR = "#2f8dff";
export const RUTA_COLOR_SIN_PEAJE = "#22e093";

// Indice del vertice de la ruta mas cercano a un punto (para pintar de otro color el tramo donde esta el peaje).
export const nearestIndex = (path, point) => {
  let best = 0;
  let bestD = Infinity;
  path.forEach((p, i) => {
    const d = (p.lat - point.lat) ** 2 + ((p.lng - point.lng) * Math.cos((point.lat * Math.PI) / 180)) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
};

export const peajeTitulo = (p) => [p.nombre ?? (p.tipo === "PORTALE" ? "Pórtico free-flow" : "Peaje"), p.operador].filter(Boolean).join(" · ");
