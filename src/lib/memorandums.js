export const NIVEL_LABELS = { ENTENDIDO: "Confirmación con un toque", FIRMA: "Firma manuscrita" };

export const MODO_LABELS = {
  CHOFERES: "Todos los choferes",
  RESPONSABLES: "Todos los Responsables",
  AREA: "Choferes de una zona",
  PERSONAS: "Personas concretas",
};

// "2 de 5 firmaron" / "Todos confirmaron".
export const progresoLabel = (m) => (m.total > 0 && m.firmados === m.total ? "Todos confirmaron" : `${m.firmados} de ${m.total} confirmaron`);
