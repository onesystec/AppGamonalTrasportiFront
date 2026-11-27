// Calculo por categoria (propuesta Gamonal Express): Junior, Senior y Master, cada una con su meta de km y su referencia neta.
//   Conduccion = km / factor x 10 EUR (factor 85 si cumple los objetivos, 95 si no)
//   Reperibilita = salidas efectivas x 10 EUR
//   Esperas = horas registradas x 7 EUR
//   Actividad = conduccion + reperibilita + esperas
//   Resultado = actividad + disponibilidad (100) + productividad (100) + ajuste manual
// Disponibilidad y productividad son un aproximado que la oficina puede cambiar a mano, igual que cualquier otro valor.
// No toca el "Total a pagar" de siempre: es un calculo aparte para comparar.

export const CATEGORIAS = [
  { value: "JUNIOR", label: "Junior", metaKm: 6800, referencia: 1000 },
  { value: "SENIOR", label: "Senior", metaKm: 10500, referencia: 1400 },
  { value: "MASTER", label: "Master", metaKm: 12500, referencia: 1600 },
];
export const FACTORES = [85, 90, 95];
export const TARIFAS_CATEGORIA = { conduccionEur: 10, reperibilidadEur: 10, esperaEur: 7, salidasMeta: 10, bonoDisponibilidad: 100, bonoProductividad: 100 };

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const nf = (v, d = 2) => Number(v).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: d });
const eur = (v) => `${Number(v).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

// Categoria a la que llega el chofer por los km del mes (la mas alta cuya meta alcanza; Junior si no llega a ninguna).
export const categoriaPorKm = (km) => [...CATEGORIAS].reverse().find((c) => km >= c.metaKm)?.value ?? "JUNIOR";

const has = (v) => v !== null && v !== undefined && v !== "";

// manual: lo guardado para el chofer en el mes ({ categoria, factor, conduccion, ... } con null = automatico).
export const calcularCategoria = (driver, manual = {}) => {
  const T = TARIFAS_CATEGORIA;
  const km = Number(driver.km) || 0;
  const salidas = Number(driver.salidasReperibilidad) || 0;
  const esperaHoras = Number(driver.esperaHoras) || 0;
  const esperaPendiente = Number(driver.esperaPendienteHoras) || 0;
  // Horas de espera aprobadas (las que suman) y, si hay, las que faltan aprobar (se muestran pero no suman).
  const esperaTexto = `${nf(esperaHoras)} h aprobadas${esperaPendiente > 0 ? ` (${nf(esperaPendiente)} h por aprobar)` : ""}`;
  const faltas = driver.asistencia?.noTrabajados ?? 0;

  const categoriaAuto = categoriaPorKm(km);
  const categoria = CATEGORIAS.find((c) => c.value === (manual.categoria || categoriaAuto)) ?? CATEGORIAS[0];

  const objetivos = [
    { clave: "km", label: "Kilómetros", meta: `${nf(categoria.metaKm, 0)}`, real: `${nf(km, 0)}`, ok: km >= categoria.metaKm },
    { clave: "salidas", label: "Salidas efectivas", meta: `${T.salidasMeta}`, real: `${salidas} de ${T.salidasMeta}`, ok: salidas >= T.salidasMeta },
  ];
  if (driver.asistencia)
    objetivos.push({
      clave: "asistencia",
      label: "Asistencia",
      meta: "Sin faltas injustificadas",
      real: faltas > 0 ? `${faltas} ${faltas === 1 ? "falta injustificada" : "faltas injustificadas"}` : `${driver.asistencia.trabajados} días, sin faltas`,
      ok: faltas === 0,
    });
  const cumple = objetivos.every((o) => o.ok);

  const factorAuto = cumple ? 85 : 95;
  const factor = has(manual.factor) ? Number(manual.factor) : factorAuto;

  const auto = {
    conduccion: round2((km / factor) * T.conduccionEur),
    reperibilidad: round2(salidas * T.reperibilidadEur),
    esperas: round2(esperaHoras * T.esperaEur),
    disponibilidad: salidas >= T.salidasMeta && faltas === 0 ? T.bonoDisponibilidad : 0,
    productividad: km >= categoria.metaKm ? T.bonoProductividad : 0,
    ajuste: 0,
  };
  const valor = (campo) => (has(manual[campo]) ? round2(manual[campo]) : auto[campo]);
  const v = Object.fromEntries(Object.keys(auto).map((campo) => [campo, valor(campo)]));
  const editado = (campo) => has(manual[campo]) && round2(manual[campo]) !== auto[campo];

  const actividad = round2(v.conduccion + v.reperibilidad + v.esperas);
  const resultado = round2(actividad + v.disponibilidad + v.productividad + v.ajuste);

  // Escenario "cumple la meta": meta de km de la categoria a factor 85, las 10 salidas, sus mismas esperas y los dos bonos.
  const meta = {
    conduccion: round2((categoria.metaKm / 85) * T.conduccionEur),
    reperibilidad: round2(T.salidasMeta * T.reperibilidadEur),
    esperas: auto.esperas,
    disponibilidad: T.bonoDisponibilidad,
    productividad: T.bonoProductividad,
  };
  meta.actividad = round2(meta.conduccion + meta.reperibilidad + meta.esperas);
  meta.resultado = round2(meta.actividad + meta.disponibilidad + meta.productividad);

  const filas = [
    {
      clave: "conduccion",
      concepto: "Conducción",
      meta: `${nf(categoria.metaKm, 0)} ÷ 85 × ${T.conduccionEur} = ${eur(meta.conduccion)}`,
      real: editado("conduccion") ? `${eur(v.conduccion)} (ajustado)` : `${nf(km, 0)} ÷ ${factor} × ${T.conduccionEur} = ${eur(v.conduccion)}`,
      valorMeta: meta.conduccion,
      valor: v.conduccion,
      editable: true,
    },
    {
      clave: "reperibilidad",
      concepto: "Reperibilità",
      meta: `${T.salidasMeta} × ${T.reperibilidadEur} = ${eur(meta.reperibilidad)}`,
      real: editado("reperibilidad") ? `${eur(v.reperibilidad)} (ajustado)` : `${salidas} × ${T.reperibilidadEur} = ${eur(v.reperibilidad)}`,
      valorMeta: meta.reperibilidad,
      valor: v.reperibilidad,
      editable: true,
    },
    {
      clave: "esperas",
      concepto: "Esperas",
      meta: `${nf(esperaHoras)} h × ${T.esperaEur} = ${eur(meta.esperas)}`,
      real: editado("esperas") ? `${eur(v.esperas)} (ajustado; ${esperaTexto})` : `${esperaTexto} × ${T.esperaEur} = ${eur(v.esperas)}`,
      valorMeta: meta.esperas,
      valor: v.esperas,
      editable: true,
    },
    { clave: "actividad", concepto: "Actividad", meta: eur(meta.actividad), real: "Conducción + reperibilità + esperas", valorMeta: meta.actividad, valor: actividad, subtotal: true },
    { clave: "disponibilidad", concepto: "Disponibilidad", meta: eur(meta.disponibilidad), real: editado("disponibilidad") ? "Según la actividad del mes" : `Bono de ${eur(T.bonoDisponibilidad)} con ${T.salidasMeta} salidas y sin faltas injustificadas`, valorMeta: meta.disponibilidad, valor: v.disponibilidad, editable: true },
    { clave: "productividad", concepto: "Productividad", meta: eur(meta.productividad), real: editado("productividad") ? "Según la actividad del mes" : `Bono de ${eur(T.bonoProductividad)} al llegar a la meta de km de la categoría`, valorMeta: meta.productividad, valor: v.productividad, editable: true },
  ];
  if (v.ajuste !== 0)
    filas.push({ clave: "ajuste", concepto: "Ajuste manual", meta: "-", real: manual.nota || "Ajuste a mano", valorMeta: 0, valor: v.ajuste, editable: true });

  return {
    categoria,
    categoriaAuto,
    categoriaManual: has(manual.categoria),
    factor,
    factorAuto,
    cumple,
    objetivos,
    auto,
    valores: v,
    actividad,
    resultado,
    meta,
    diferencia: round2(meta.resultado - resultado),
    filas,
    nota: manual.nota || "",
    editadoAMano: ["categoria", "factor", "conduccion", "reperibilidad", "esperas", "disponibilidad", "productividad", "ajuste"].some((c) => has(manual[c])),
  };
};
