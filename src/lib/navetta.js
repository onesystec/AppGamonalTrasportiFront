// Las navette (HP, COLT: "NAVETTA SETTALA", "NAVETTA SEGRATE", "Navetta Ferrera"...) nunca traen Shipment ni Order: no se piden ni se avisa de que faltan.
// Si la descripcion si los trae, se usan igual. Se reconocen por la palabra "navetta" en el destino, la ciudad o la descripcion.
export const esNavetta = (...textos) => textos.some((t) => /navett/i.test(String(t ?? "")));
