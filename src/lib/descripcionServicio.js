// Lee la descripcion de un servicio (el mensaje que escribe la oficina) y saca lo que se puede autocompletar en el formulario:
//  - AORTIC: los Medtronic criticos ("MEDTRONIC ASAP CON APP *AORTIC*", "Sempre Medtronic Aortic"). Los "scheduled" no lo son necesariamente.
//  - Shipment y Order. A veces el mensaje los trae cruzados ("ORDER 171434512 | SHIPMEMT 1167746741"), asi que se asignan por la forma del
//    numero: el Shipment tiene 9 cifras y empieza por 171, el Order tiene 10 y empieza por 116. Si no tienen esa forma, manda la etiqueta.
const INVISIBLES = /[​-‏⁠-⁯﻿]/g;

const numeroTras = (texto, etiqueta) => new RegExp(`(?:${etiqueta})\\s*[:#.\\-]?\\s*(\\d{6,})`, "i").exec(texto)?.[1] ?? null;
const esShipment = (n) => /^171\d{6}$/.test(n ?? "");
const esOrder = (n) => /^116\d{7}$/.test(n ?? "");

export const analizarDescripcion = (descripcion) => {
  const texto = String(descripcion ?? "").replace(INVISIBLES, "");
  const aortic = /aortic/i.test(texto);
  let shipment = numeroTras(texto, "shipm\\w{1,5}|spedizione");
  let orderNumero = numeroTras(texto, "order|ordine");
  // Cruzados: cada numero va donde corresponde por su forma.
  const cruzado = (shipment && esOrder(shipment) && !esShipment(shipment)) || (orderNumero && esShipment(orderNumero) && !esOrder(orderNumero));
  if (cruzado) [shipment, orderNumero] = [orderNumero, shipment];
  // Un numero con la forma de uno solo y sin su etiqueta tambien se reconoce.
  if (!shipment && orderNumero && esShipment(orderNumero)) [shipment, orderNumero] = [orderNumero, null];
  if (!orderNumero && shipment && esOrder(shipment)) [shipment, orderNumero] = [null, shipment];
  return { aortic, shipment, orderNumero };
};

// Rellena un campo solo si esta vacio o si lo escribio esta misma deteccion antes (nunca pisa lo que la oficina tipeo a mano).
export const autocompletarCampos = (form, previo, detectado) => {
  const next = {};
  for (const campo of ["shipment", "orderNumero"]) {
    const nuevo = detectado[campo];
    if (nuevo && (!form[campo] || form[campo] === previo?.[campo])) next[campo] = nuevo;
  }
  return next;
};
