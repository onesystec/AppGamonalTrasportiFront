// Enviar a un chofer sus datos de acceso por WhatsApp (enlace wa.me con el mensaje ya escrito).

// Direccion de la app: la misma que carga la app de Android (capacitor.config.json > server.url).
export const APP_URL = "https://app-gamonal-trasporti-front.vercel.app";

// wa.me pide el numero con prefijo de pais, solo digitos. Los celulares italianos se cargan muchas veces
// sin prefijo ("3444951035"): a esos se les pone el 39.
export const numeroWhatsapp = (celular) => {
  let digitos = String(celular ?? "").replace(/\D/g, "");
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  if (/^3\d{8,9}$/.test(digitos)) digitos = `39${digitos}`;
  return digitos.length >= 8 && !/^0+$/.test(digitos.replace(/^39/, "")) ? digitos : "";
};

export const mensajeCuenta = ({ nombre, correo, password }) =>
  [
    `Hola ${nombre ?? ""}, estos son tus datos para entrar a la app de Gamonal Trasporti:`.replace("Hola ,", "Hola,"),
    "",
    `Usuario: ${correo}`,
    password
      ? `Contraseña: ${password}`
      : "Contraseña: la que ya tienes (si no la recuerdas, toca «¿Olvidaste tu contraseña?» al entrar).",
    "",
    `App: ${APP_URL}`,
    ...(password ? ["", "Cuando entres, cámbiala desde Perfil > Contraseña."] : []),
  ].join("\n");

// Sin numero valido abre WhatsApp para elegir el contacto a mano.
export const enlaceWhatsapp = (celular, texto) => {
  const numero = numeroWhatsapp(celular);
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
};

// Contrasena temporal facil de dictar: sin letras que se confunden (l/I/O/0).
export const generarPassword = () => {
  const letras = "abcdefghjkmnpqrstuvwxyz";
  const mayus = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const nums = "23456789";
  const pick = (s) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  return `${pick(mayus)}${Array.from({ length: 5 }, () => pick(letras)).join("")}${Array.from({ length: 4 }, () => pick(nums)).join("")}`;
};
