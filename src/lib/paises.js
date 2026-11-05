// Paises de las entregas (codigo ISO de 2 letras; mismos que el servidor, ver constants/paises.js). Italia es lo normal y no hace falta marcarla.
const CODIGOS = [
  "IT", "FR", "DE", "CH", "AT", "ES", "PT", "BE", "NL", "LU", "GB", "IE", "DK", "SE", "NO", "FI", "IS", "PL", "CZ", "SK", "HU", "SI", "HR", "BA", "RS", "ME", "MK", "AL",
  "XK", "GR", "BG", "RO", "MD", "UA", "LT", "LV", "EE", "MT", "CY", "SM", "VA", "MC", "AD", "LI", "TR", "MA", "TN", "DZ", "EG", "US", "CN",
];

const nombres = (lang) => new Intl.DisplayNames([lang], { type: "region" });

// "FR" -> "Francia" (o "France", "Francia"... segun el idioma). Si no se conoce, el mismo codigo.
export const nombrePais = (codigo, lang = "es") => {
  if (!codigo) return "";
  try {
    return nombres(lang).of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
};

// Opciones para un Select: Italia primero y despues el resto por orden alfabetico.
export const paisOptions = (lang = "es", porDefecto = "por defecto") => {
  const dn = nombres(lang);
  const resto = CODIGOS.filter((c) => c !== "IT")
    .map((value) => ({ value, label: dn.of(value) ?? value }))
    .sort((a, b) => a.label.localeCompare(b.label, lang));
  return [{ value: "", label: `${dn.of("IT")} (${porDefecto})` }, ...resto];
};
