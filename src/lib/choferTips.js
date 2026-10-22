import { useEffect, useState } from "react";

// Consejos que ve el chofer mientras carga una pantalla (ver PageLoader). Solo buenas practicas de trabajo: nada de dinero, pagos, descuentos ni
// sueldo, para no dar pie a malentendidos.
export const CHOFER_TIPS = [
  "Sube tu mancato pagamento el mismo día en que lo recibes: así queda asignado a tu servicio y no se acumula.",
  "Sube el carburante apenas lo cargues, con la foto del ticket. Hecho en el momento, no se te olvida.",
  "Toma la foto de la bolla al entregar y súbela en ese momento, antes de pasar al siguiente servicio.",
  "Haz tus registros día a día: subir cada cosa al momento toma un minuto; juntarlas al final del mes toma mucho más.",
  "Con el botón «Tomar foto» se abre la cámara trasera directamente. Procura que la bolla se vea completa y sin sombras.",
  "Si pasas una barrera sin pagar, fotografía el aviso en cuanto lo recibas y súbelo desde Mancato pagamento.",
  "Al cargar carburante, comprueba que en el ticket se lean la fecha, los litros y la targa.",
  "Mantén la ubicación de la app en «Permitir todo el tiempo»: así tu seguimiento funciona aunque bloquees el teléfono.",
  "Activa las notificaciones de la app para no perderte avisos de tus servicios.",
  "Cuando termines un servicio, ciérralo en la app enseguida: tu responsable y el cliente ven el estado al instante.",
  "Si vas a llegar tarde a una entrega, avisa a tu responsable con tiempo.",
  "Empieza el día mirando «Hoy»: ahí ves tus servicios y lo que tienes pendiente de subir.",
  "Una foto clara a la primera evita tener que repetirla: limpia la lente y evita los reflejos.",
  "Respeta los límites de velocidad: tu seguridad y la de los demás es lo primero.",
  "Si cambias de furgoneta durante un servicio, indícalo al terminarlo para que todo quede bien registrado.",
];

// Lo que se recuerda del ultimo uso: la pantalla de carga sale antes de saber quien es el usuario.
export const CHOFER_VIEW_KEY = "gt_chofer_view";

export const isChoferView = () => {
  try {
    return localStorage.getItem(CHOFER_VIEW_KEY) === "1";
  } catch {
    return false;
  }
};

export const rememberChoferView = (isChofer) => {
  try {
    if (isChofer) localStorage.setItem(CHOFER_VIEW_KEY, "1");
    else localStorage.removeItem(CHOFER_VIEW_KEY);
  } catch {
    // sin almacenamiento: simplemente no se muestran consejos al abrir
  }
};

// Un consejo al azar que va cambiando cada pocos segundos mientras dura la carga (un arranque en frio del servidor puede tardar).
export const useChoferTip = (enabled) => {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * CHOFER_TIPS.length));
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % CHOFER_TIPS.length), 7000);
    return () => clearInterval(timer);
  }, [enabled]);
  return enabled ? CHOFER_TIPS[index] : null;
};
