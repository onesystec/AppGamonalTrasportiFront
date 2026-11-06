// Lee la descripcion de un servicio (el mensaje que escribe la oficina) y saca lo que se puede autocompletar en el formulario. Aprendido de las
// descripciones reales de DHL y AB Service:
//  - AORTIC: los Medtronic criticos ("MEDTRONIC ASAP CON APP *AORTIC*", "Sempre Medtronic Aortic"). Los "scheduled" no lo son necesariamente.
//  - Tipo de pedido: "ASAP" o "SCHEDULED" / "Schedulato".
//  - Aplicativo y zona: "MILANO 12" -> MILANO_12 (zona Milano, 1 a 18); "ROMA 2" -> ROMA_2 (zona Roma, 1 a 10).
//  - Shipment y Order. DHL: Shipment de 9 cifras que empieza por 171, Order de 10 que empieza por 116. AB Service: Shipment 182xxxxxx, Order
//    0xxxxxxxx (el Order conserva el cero). A veces el mensaje trae los dos cruzados ("ORDER 171434512 | SHIPMEMT 1167746741"): se asignan
//    por la forma del numero y no por la etiqueta. Un numero que no tiene la forma esperada no se completa solo y se avisa.
const INVISIBLES = /[​-‏⁠-⁯﻿]/g;

const FORMAS = {
  DHL: { shipment: /^171\d{6}$/, order: /^116\d{7}$/ },
  AB_SERVICE: { shipment: /^182\d{6}$/, order: /^0\d{8}$/ },
};
const MAX_APLICATIVO = { MILANO: 18, ROMA: 10 };

const numeroTras = (texto, etiqueta) => new RegExp(`(?:${etiqueta})\\s*[:#.\\-]?\\s*(\\d{6,})`, "i").exec(texto)?.[1] ?? null;

export const analizarDescripcion = (descripcion, spedizzione = "DHL") => {
  const texto = String(descripcion ?? "").replace(INVISIBLES, "");
  const forma = FORMAS[spedizzione] ?? FORMAS.DHL;
  const aortic = /aortic/i.test(texto);
  let shipment = numeroTras(texto, "shipm\\w{1,5}|spedizione");
  let orderNumero = numeroTras(texto, "order|ordine");
  // Cruzados: cada numero va donde corresponde por su forma.
  const cruzado = (shipment && forma.order.test(shipment) && !forma.shipment.test(shipment)) || (orderNumero && forma.shipment.test(orderNumero) && !forma.order.test(orderNumero));
  if (cruzado) [shipment, orderNumero] = [orderNumero, shipment];
  // Un numero con la forma de uno solo y sin su etiqueta tambien se reconoce.
  if (!shipment && orderNumero && forma.shipment.test(orderNumero)) [shipment, orderNumero] = [orderNumero, null];
  if (!orderNumero && shipment && forma.order.test(shipment)) [shipment, orderNumero] = [null, shipment];

  const avisos = [];
  if (shipment && !forma.shipment.test(shipment)) {
    avisos.push(`El Shipment ${shipment} no tiene la forma habitual (${spedizzione === "AB_SERVICE" ? "182 + 6 cifras" : "171 + 6 cifras"}): revisalo.`);
    shipment = null;
  }
  if (orderNumero && !forma.order.test(orderNumero)) {
    avisos.push(`El Order ${orderNumero} no tiene la forma habitual (${spedizzione === "AB_SERVICE" ? "9 cifras con cero inicial" : "116 + 7 cifras"}): revisalo.`);
    orderNumero = null;
  }

  const tipoPedido = /scheduled|schedulat/i.test(texto) ? "SCHEDULED" : /\basap\b/i.test(texto) ? "ASAP" : null;
  const ap = /\b(milano|roma)\s*(\d{1,2})\b/i.exec(texto);
  const zona = ap ? ap[1].toUpperCase() : null;
  const numeroAp = ap ? Number(ap[2]) : null;
  const aplicativo = zona && numeroAp >= 1 && numeroAp <= MAX_APLICATIVO[zona] ? `${zona}_${numeroAp}` : null;
  return { aortic, shipment, orderNumero, tipoPedido, aplicativo, zona: aplicativo ? zona : null, avisos };
};

// Rellena un campo solo si esta vacio o si lo escribio esta misma deteccion antes (nunca pisa lo que la oficina tipeo a mano).
const CAMPOS = ["shipment", "orderNumero", "tipoPedido", "aplicativo"];
export const autocompletarCampos = (form, previo, detectado) => {
  const next = {};
  for (const campo of CAMPOS) {
    const nuevo = detectado[campo];
    const loPusoLaDeteccion = Boolean(previo?.[campo]) && form[campo] === previo[campo];
    if (nuevo && (!form[campo] || loPusoLaDeteccion)) next[campo] = nuevo;
    // La descripcion cambio y ya no trae ese dato: se quita lo que puso la deteccion antes (lo escrito a mano se queda).
    else if (!nuevo && loPusoLaDeteccion) next[campo] = "";
  }
  // El aplicativo es de una zona: al completarlo, la zona sigue lo que dice el texto.
  if (next.aplicativo && detectado.zona) next.extrasPiazzaZona = detectado.zona;
  return next;
};
