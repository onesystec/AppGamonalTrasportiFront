// Paletas de color disponibles. Las variables CSS de cada una viven en
// src/index.css (bloques html[data-palette="..."]); aca solo va lo que necesita
// la interfaz para listarlas: nombre, descripcion y los 5 colores del circulo
// (en el orden en que aparecen, en sentido horario desde arriba, en el diseno de referencia).
export const DEFAULT_PALETTE = "clasico";

export const PALETTES = [
  {
    id: "clasico",
    label: "Clásico profesional",
    description: "Serio y atemporal.",
    swatches: ["#1484e8", "#019bfd", "#6dd4af", "#209a83", "#0a2c57"],
  },
  {
    id: "oceano",
    label: "Océano",
    description: "Fresco y tecnológico.",
    swatches: ["#017cf4", "#13c8f6", "#76ddfa", "#04a6db", "#013d87"],
  },
  {
    id: "grafito",
    label: "Grafito",
    description: "Minimalista y neutro.",
    swatches: ["#7d838c", "#c1c2c6", "#e4e5e8", "#8f969f", "#343a3f"],
  },
  {
    id: "elegancia",
    label: "Elegancia",
    description: "Premium y sofisticado.",
    swatches: ["#5d40b5", "#b490ec", "#dab87d", "#3f317c", "#0d1c4d"],
  },
  {
    id: "verano",
    label: "Verano",
    description: "Energético y luminoso.",
    swatches: ["#fd9a40", "#fddf79", "#84d2fd", "#3fbece", "#fd706b"],
  },
  {
    id: "aurora",
    label: "Aurora",
    description: "Suave y creativo.",
    swatches: ["#b7d6ad", "#fdedab", "#d8c2f2", "#f8becb", "#9dd3b1"],
  },
  {
    id: "halloween",
    label: "Halloween",
    description: "Oscuro y festivo.",
    swatches: ["#7747cb", "#9f6ce7", "#b9d967", "#fd9b3a", "#2a2933"],
  },
  {
    id: "navidad",
    label: "Navidad",
    description: "Cálido y estacional.",
    swatches: ["#d8363b", "#dab97b", "#91b397", "#f8eed9", "#145249"],
  },
];

export const PALETTE_IDS = PALETTES.map((p) => p.id);
