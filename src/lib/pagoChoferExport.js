// Informes del pago de un chofer en el mes (Excel y PDF), con el logo y formato formal. Solo presentan los datos que ya calculo el
// servidor (desglose, totales y servicios): no recalculan nada.
import logoUrl from "../assets/logo.webp";
import { downloadBlob } from "./csv";
import { payCalcText } from "./finanzas";
import { formatCurrency, formatDate, formatKm } from "./format";
import { formatHours } from "./horas";
import { buildDesglose, monthLabel, servicioHorasTexto, servicioKmTexto } from "./pagoChofer";
import { PAGE_H, PAGE_W, PdfDoc, wrapText } from "./pdfWriter";
import { XS, buildXlsx } from "./xlsxWriter";

const EMPRESA = "Gamonal Trasporti SRL";
const NAVY = "#1e2a4a";
const ACCENT = "#e11d48";
const MUTED = "#6b7280";
const LIGHT = "#f1f3f8";
const BORDER = "#d5dae5";

const nf = (value) => Number(value).toLocaleString("es-AR", { maximumFractionDigits: 1 });
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// El logo de la app (webp) pasado por un canvas a JPEG (PDF) y PNG (Excel), con fondo blanco.
let logoCache;
const loadLogo = () => {
  if (!logoCache)
    logoCache = new Promise((resolve) => {
      if (typeof Image === "undefined") return resolve(null);
      const img = new Image();
      img.onload = async () => {
        try {
          const size = Math.min(img.naturalWidth || 192, 256);
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, 0, 0, size, size);
          const toBytes = (type) =>
            new Promise((res) => canvas.toBlob((b) => (b ? b.arrayBuffer().then((buf) => res(new Uint8Array(buf))) : res(null)), type, 0.92));
          const [jpeg, png] = await Promise.all([toBytes("image/jpeg"), toBytes("image/png")]);
          resolve({ jpeg, png, size });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = logoUrl;
    });
  return logoCache;
};

const fileBase = (driver, month) =>
  `Pago_${driver.nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")}_${month}`;

// Todo lo que va en el informe, ya en texto.
const buildModel = (params) => {
  const { driver, servicios, reglas, month, kmh } = params;
  const desglose = buildDesglose(driver) ?? { filas: [], resumen: [], avisos: [] };
  const datos = [
    ["Chofer", driver.nombre],
    ["Período", monthLabel(month)],
    ["Servicios pagados", `${driver.servicios}`],
  ];
  if (driver.km > 0) datos.push(["Kilómetros", formatKm(driver.km)]);
  if (driver.horasManejo > 0) datos.push(["Horas de manejo", `${formatHours(driver.horasManejo)} (km ÷ ${kmh} km/h)`]);
  if (driver.horas > 0) datos.push(["Horas", `${nf(driver.horas)} h`]);
  if (driver.asistencia)
    datos.push([
      "Asistencia",
      [
        `${driver.asistencia.trabajados} ${driver.asistencia.trabajados === 1 ? "día trabajado" : "días trabajados"}`,
        driver.asistencia.noTrabajados > 0 && `${driver.asistencia.noTrabajados} sin justificar`,
        driver.asistencia.justificados > 0 && `${driver.asistencia.justificados} justificados`,
      ]
        .filter(Boolean)
        .join(" - "),
    ]);

  const aparte = driver.pagoAparte
    ? [
        { label: "Básico (horario laboral)", detalle: "Servicios de lunes a viernes de dia, mas la espera", pago: driver.basico },
        {
          label: "Aparte del básico",
          detalle:
            driver.aparte?.servicios > 0
              ? `${driver.aparte.servicios} ${driver.aparte.servicios === 1 ? "servicio" : "servicios"} fuera de horario: ${formatCurrency(driver.aparte.base)} de trabajo + ${formatCurrency(driver.aparte.reperibilidad)} de reperibilita${driver.aparte.espera > 0 ? ` + ${formatCurrency(driver.aparte.espera)} de espera` : ""}`
              : "Sin servicios fuera de horario este mes",
          pago: driver.aparte?.total ?? 0,
        },
      ]
    : null;

  const reglasChofer = { ...reglas, kmBloque: kmh };
  const filasServicios = (servicios ?? []).map((s) => ({
    fecha: formatDate(s.fecha),
    codigo: s.codigo ?? "",
    cliente: [s.cliente, s.destinazione].filter(Boolean).join(" - ") || "-",
    km: servicioKmTexto(s),
    horas: servicioHorasTexto(s),
    calculo: payCalcText(s, reglasChofer),
    pago: s.total,
  }));

  return {
    titulo: "Detalle de pago al chofer",
    periodo: monthLabel(month),
    emitido: formatDate(new Date()),
    datos,
    ...desglose,
    total: driver.total,
    aparte,
    servicios: filasServicios,
    totalServicios: filasServicios.reduce((s, f) => s + (Number(f.pago) || 0), 0),
    categoria: params.categoria ?? null,
  };
};

// ---------- Excel ----------

const estimateHeight = (texts) => {
  // Lineas aproximadas por celda segun el ancho de su columna (caracteres por linea).
  const lines = Math.max(1, ...texts.map(([text, chars]) => Math.ceil(String(text ?? "").length / chars)));
  return Math.max(16, lines * 13 + 3);
};

export const downloadPagoChoferXlsx = async (params) => {
  const m = buildModel(params);
  const logo = await loadLogo();
  const rows = [];
  const merges = [];
  const add = (cells, height) => {
    rows.push({ cells, height });
    return rows.length; // numero de fila (1-based)
  };
  const merge = (row, from, to) => merges.push(`${from}${row}:${to}${row}`);
  const section = (title) => {
    add([]);
    const r = add([{ v: title.toUpperCase(), s: XS.section }, { s: XS.section }, { s: XS.section }, { s: XS.section }, { s: XS.section }], 20);
    merge(r, "A", "E");
  };

  // Encabezado (logo en la columna A, textos desde la B).
  let r = add([null, { v: m.titulo, s: XS.title }], 26);
  merge(r, "B", "E");
  r = add([null, { v: EMPRESA, s: XS.accentTitle }], 16);
  merge(r, "B", "E");
  r = add([null, { v: `Período: ${m.periodo}   ·   Emitido el ${m.emitido}`, s: XS.subtitle }], 16);
  merge(r, "B", "E");

  section("Datos del chofer");
  for (const [label, value] of m.datos) {
    r = add([{ v: label, s: XS.label }, { v: value, s: XS.value }]);
    merge(r, "B", "E");
  }
  r = add([{ v: "Total a pagar", s: XS.label }, { v: round2(m.total), s: XS.bigMoney }], 20);
  merge(r, "B", "E");

  if (m.resumen.length) {
    section("Resumen del mes");
    r = add([{ v: "Franja", s: XS.th }, { v: "Cantidad", s: XS.th }, { v: "Detalle", s: XS.th }, { s: XS.th }, { v: "Pago", s: XS.thRight }]);
    merge(r, "C", "D");
    for (const item of m.resumen) {
      r = add([{ v: item.titulo, s: XS.td }, { v: item.grande, s: XS.td }, { v: item.detalle, s: XS.td }, { s: XS.td }, { v: round2(item.pago), s: XS.tdMoney }]);
      merge(r, "C", "D");
    }
  }

  section("Desglose del pago");
  r = add([{ v: "Concepto", s: XS.th }, { s: XS.th }, { v: "Cantidad", s: XS.th }, { v: "Cómo se calcula", s: XS.th }, { v: "Pago", s: XS.thRight }]);
  merge(r, "A", "B");
  if (m.filas.length === 0) {
    r = add([{ v: "Este chofer no tiene pagos por servicios este mes.", s: XS.td }, { s: XS.td }, { s: XS.td }, { s: XS.td }, { s: XS.td }]);
    merge(r, "A", "E");
  }
  for (const fila of m.filas) {
    r = add(
      [{ v: fila.concepto, s: XS.td }, { s: XS.td }, { v: fila.cantidad, s: XS.td }, { v: fila.calculo, s: XS.td }, { v: round2(fila.pago), s: XS.tdMoney }],
      estimateHeight([[fila.concepto, 40], [fila.cantidad, 22], [fila.calculo, 46]])
    );
    merge(r, "A", "B");
  }
  r = add([{ v: "TOTAL A PAGAR", s: XS.totalLabel }, { s: XS.totalLabel }, { s: XS.totalLabel }, { s: XS.totalLabel }, { v: round2(m.total), s: XS.totalMoney }], 18);
  merge(r, "A", "D");

  if (m.aparte) {
    section("Básico y aparte");
    for (const item of [...m.aparte, { label: "Total a pagar", detalle: "Básico + aparte", pago: m.total }]) {
      r = add([{ v: item.label, s: XS.td }, { s: XS.td }, { v: item.detalle, s: XS.td }, { s: XS.td }, { v: round2(item.pago), s: XS.tdMoney }], estimateHeight([[item.detalle, 70]]));
      merge(r, "A", "B");
      merge(r, "C", "D");
    }
  }

  if (m.categoria) {
    const c = m.categoria;
    section(`Cálculo por categoría: ${c.categoria.label}`);
    r = add([{ v: `Meta ${c.categoria.label}: ${c.categoria.metaKm.toLocaleString("es-AR")} km · Referencia neta: ${formatCurrency(c.categoria.referencia)}/mes · Factor: ${c.factor}`, s: XS.label }]);
    merge(r, "A", "E");
    r = add([{ v: "Concepto", s: XS.th }, { v: "Cálculo", s: XS.th }, { s: XS.th }, { s: XS.th }, { v: "Importe", s: XS.thRight }]);
    merge(r, "B", "D");
    for (const f of c.filas) {
      r = add([{ v: f.concepto, s: f.subtotal ? XS.totalLabel : XS.td }, { v: f.real, s: XS.td }, { s: XS.td }, { s: XS.td }, { v: round2(f.valor), s: f.subtotal ? XS.totalMoney : XS.tdMoney }], estimateHeight([[f.real, 95]]));
      merge(r, "B", "D");
    }
    r = add([{ v: "RESULTADO DEL MES", s: XS.totalLabel }, { s: XS.totalLabel }, { s: XS.totalLabel }, { s: XS.totalLabel }, { v: round2(c.resultado), s: XS.totalMoney }], 18);
    merge(r, "A", "D");
    if (c.nota) {
      r = add([{ v: `Nota: ${c.nota}`, s: XS.note }, { s: XS.note }, { s: XS.note }, { s: XS.note }, { s: XS.note }], estimateHeight([[c.nota, 110]]));
      merge(r, "A", "E");
    }
    r = add([{ v: "Propuesta ilustrativa. Pago definitivo sujeto a jornada remunerable y revisión en nómina.", s: XS.small }]);
    merge(r, "A", "E");
  }

  if (m.avisos.length) {
    section("Observaciones");
    for (const aviso of m.avisos) {
      r = add([{ v: aviso.texto, s: XS.note }, { s: XS.note }, { s: XS.note }, { s: XS.note }, { s: XS.note }], estimateHeight([[aviso.texto, 120]]));
      merge(r, "A", "E");
    }
  }

  if (m.servicios.length) {
    section(`Servicios del mes (${m.servicios.length})`);
    add([{ v: "Fecha", s: XS.th }, { v: "Código", s: XS.th }, { v: "Cliente - destino", s: XS.th }, { v: "Cálculo", s: XS.th }, { v: "Pago", s: XS.thRight }, { v: "Km", s: XS.thRight }, { v: "Horas de manejo", s: XS.thRight }]);
    for (const s of m.servicios)
      add(
        [{ v: s.fecha, s: XS.td }, { v: s.codigo, s: XS.td }, { v: s.cliente, s: XS.td }, { v: s.calculo, s: XS.td }, { v: round2(s.pago), s: XS.tdMoney }, { v: s.km, s: XS.td }, { v: s.horas, s: XS.td }],
        estimateHeight([[s.codigo, 26], [s.cliente, 22], [s.calculo, 46]])
      );
    r = add([{ v: "Total servicios", s: XS.totalLabel }, { s: XS.totalLabel }, { s: XS.totalLabel }, { s: XS.totalLabel }, { v: round2(m.totalServicios), s: XS.totalMoney }], 18);
    merge(r, "A", "D");
  }

  // Firmas.
  add([]);
  add([]);
  add([]);
  r = add([{ v: "______________________________", s: XS.small }, { s: XS.small }, null, { v: "______________________________", s: XS.small }]);
  merge(r, "A", "B");
  r = add([{ v: `Firma del chofer: ${params.driver.nombre}`, s: XS.label }, { s: XS.label }, null, { v: `Por ${EMPRESA}`, s: XS.label }]);
  merge(r, "A", "B");
  add([]);
  r = add([{ v: `Documento generado por ONE DRIVER el ${m.emitido}.`, s: XS.small }]);
  merge(r, "A", "E");

  const blob = buildXlsx({
    name: "Pago chofer",
    cols: [19, 24, 24, 50, 15, 11, 15],
    rows,
    merges,
    image: logo?.png ? { png: logo.png, col: 0, row: 0, width: 66, height: 66 } : undefined,
  });
  downloadBlob(`${fileBase(params.driver, params.month)}.xlsx`, blob);
};

// ---------- PDF ----------

const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 34;

// Que partes lleva el PDF: calendario de asistencia, calculo del pago y detalle de entregas (todas por defecto).
export const PDF_PARTES = [
  { value: "asistencia", label: "Calendario de asistencia" },
  { value: "calculo", label: "Cálculo del pago (por categoría)" },
  { value: "entregas", label: "Detalle de entregas" },
];
const DEFAULT_OPCIONES = { asistencia: true, calculo: true, entregas: true };

const COLORES_DIA = {
  TRABAJADO: { fill: "#16a34a", text: "#ffffff" },
  NO_TRABAJADO: { fill: "#dc2626", text: "#ffffff" },
  JUSTIFICADO: { fill: "#f59e0b", text: "#ffffff" },
  PERMISO_PENDIENTE: { fill: "#fde68a", text: "#92400e" },
  DESCANSO: { fill: "#d1d5db", text: "#374151" },
  LIBRE_FIN_DE_SEMANA: { fill: "#e5e7eb", text: "#6b7280" },
};
const LEYENDA_DIAS = [
  ["TRABAJADO", "Trabajó (n.º de entregas y km del día)"],
  ["NO_TRABAJADO", "Falta sin justificar"],
  ["JUSTIFICADO", "Permiso justificado"],
  ["DESCANSO", "Descanso / libre"],
];

// Dibuja el informe de UN chofer en el documento (empieza en una pagina nueva salvo que sea la primera).
const drawDriverPdf = (doc, logo, params, opciones, nuevaPagina) => {
  const op = { ...DEFAULT_OPCIONES, ...opciones };
  const m = { ...buildModel(params), ...(op.calculo ? {} : { titulo: "Reporte mensual del chofer" }) };
  let y = 0;
  if (nuevaPagina) doc.addPage();

  const header = (first) => {
    if (first) {
      doc.rect(0, 0, PAGE_W, 6, { fill: NAVY });
      doc.drawImage(MARGIN, 26, 54, 54);
      const tx = logo?.jpeg ? MARGIN + 66 : MARGIN;
      doc.text(tx, 30, m.titulo, { size: 18, bold: true, color: NAVY });
      doc.text(tx, 54, EMPRESA, { size: 11, bold: true, color: ACCENT });
      doc.text(tx, 69, "Pagos a choferes · Finanzas operativas", { size: 9, color: MUTED });
      doc.text(PAGE_W - MARGIN, 32, "PERÍODO", { size: 8, bold: true, color: MUTED, align: "right" });
      doc.text(PAGE_W - MARGIN, 43, m.periodo, { size: 12, bold: true, color: NAVY, align: "right" });
      doc.text(PAGE_W - MARGIN, 61, `Emitido el ${m.emitido}`, { size: 8.5, color: MUTED, align: "right" });
      doc.line(MARGIN, 92, PAGE_W - MARGIN, 92, { color: ACCENT, width: 1.2 });
      y = 108;
    } else {
      doc.rect(0, 0, PAGE_W, 6, { fill: NAVY });
      doc.drawImage(MARGIN, 18, 24, 24);
      const tx = logo?.jpeg ? MARGIN + 32 : MARGIN;
      doc.text(tx, 21, `${m.titulo} - ${params.driver.nombre}`, { size: 10, bold: true, color: NAVY });
      doc.text(tx, 33, `${EMPRESA} · ${m.periodo}`, { size: 8, color: MUTED });
      doc.line(MARGIN, 50, PAGE_W - MARGIN, 50, { color: BORDER });
      y = 64;
    }
  };

  const ensure = (h, onNewPage) => {
    if (y + h <= FOOTER_Y - 14) return false;
    doc.addPage();
    header(false);
    onNewPage?.();
    return true;
  };

  const section = (title) => {
    ensure(80);
    y += 6;
    doc.rect(MARGIN, y, CONTENT_W, 20, { fill: NAVY });
    doc.text(MARGIN + 10, y + 6, title.toUpperCase(), { size: 9, bold: true, color: "#ffffff" });
    y += 28;
  };

  // Tabla: columns [{ title, width, align, bold }]; rows: arrays de texto; opts.total: [label, value]
  const table = (columns, rows, { total } = {}) => {
    const size = 8.5;
    const lineH = 11;
    const pad = 5;
    const drawHead = () => {
      doc.rect(MARGIN, y, CONTENT_W, 18, { fill: LIGHT });
      let x = MARGIN;
      for (const col of columns) {
        const tx = col.align === "right" ? x + col.width - pad : x + pad;
        doc.text(tx, y + 5.5, col.title, { size: 8, bold: true, color: NAVY, align: col.align === "right" ? "right" : "left" });
        x += col.width;
      }
      y += 18;
    };
    drawHead();
    rows.forEach((row, i) => {
      const wrapped = row.map((cell, c) => wrapText(cell, columns[c].width - pad * 2, size, columns[c].bold));
      const h = Math.max(...wrapped.map((l) => l.length)) * lineH + pad * 2 - 2;
      ensure(h, drawHead);
      if (i % 2 === 1) doc.rect(MARGIN, y, CONTENT_W, h, { fill: "#fafbfd" });
      let x = MARGIN;
      wrapped.forEach((lines, c) => {
        const col = columns[c];
        lines.forEach((line, li) => {
          const tx = col.align === "right" ? x + col.width - pad : x + pad;
          doc.text(tx, y + pad + li * lineH, line, { size, bold: col.bold, color: col.color ?? "#1f2937", align: col.align === "right" ? "right" : "left" });
        });
        x += col.width;
      });
      y += h;
      doc.line(MARGIN, y, PAGE_W - MARGIN, y, { color: BORDER, width: 0.5 });
    });
    if (total) {
      ensure(24);
      doc.rect(MARGIN, y, CONTENT_W, 22, { fill: NAVY });
      doc.text(MARGIN + pad + 2, y + 7, total[0], { size: 9.5, bold: true, color: "#ffffff" });
      doc.text(PAGE_W - MARGIN - pad, y + 6.5, total[1], { size: 10.5, bold: true, color: "#ffffff", align: "right" });
      y += 22;
    }
    y += 8;
  };

  header(true);

  // Datos del chofer + total destacado.
  const boxH = 18 + Math.ceil(m.datos.length / 2) * 30;
  doc.rect(MARGIN, y, CONTENT_W, boxH, { fill: LIGHT });
  doc.rect(MARGIN, y, 3, boxH, { fill: ACCENT });
  const colW = (CONTENT_W - 170) / 2;
  m.datos.forEach(([label, value], i) => {
    const x = MARGIN + 16 + (i % 2) * colW;
    const ry = y + 12 + Math.floor(i / 2) * 30;
    doc.text(x, ry, label.toUpperCase(), { size: 7, bold: true, color: MUTED });
    const lines = wrapText(value, colW - 12, 9.5, true);
    if (lines.length === 1) doc.text(x, ry + 9, lines[0], { size: 9.5, bold: true, color: "#1f2937" });
    else wrapText(value, colW - 12, 8, true).slice(0, 2).forEach((line, li) => doc.text(x, ry + 9 + li * 9.5, line, { size: 8, bold: true, color: "#1f2937" }));
  });
  const tx = PAGE_W - MARGIN - 14;
  const destacado = !op.calculo
    ? ["ENTREGAS DEL MES", String(m.servicios.length || params.driver.servicios)]
    : m.categoria
      ? [`RESULTADO · ${m.categoria.categoria.label.toUpperCase()}`, formatCurrency(m.categoria.resultado)]
      : ["TOTAL A PAGAR", formatCurrency(m.total)];
  doc.text(tx, y + boxH / 2 - 16, destacado[0], { size: 8, bold: true, color: MUTED, align: "right" });
  doc.text(tx, y + boxH / 2 - 4, destacado[1], { size: 17, bold: true, color: NAVY, align: "right" });
  y += boxH + 12;

  if (op.asistencia && params.calendario?.length) {
    const dias = params.calendario;
    section("Asistencia del mes");
    const cellW = CONTENT_W / 7;
    const cellH = 31;
    // Km hechos cada dia (suma de los km de sus entregas, por la fecha del servicio en hora de Italia).
    const kmPorDia = new Map();
    for (const sv of params.servicios ?? []) {
      if (!sv.fecha || !(Number(sv.km) > 0)) continue;
      const dia = new Date(sv.fecha).toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
      kmPorDia.set(dia, (kmPorDia.get(dia) ?? 0) + Number(sv.km));
    }
    ensure(16 + cellH * 6 + 36);
    ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].forEach((d, i) =>
      doc.text(MARGIN + cellW * i + cellW / 2, y, d, { size: 7.5, bold: true, color: MUTED, align: "center" })
    );
    y += 11;
    const [yy, mm] = dias[0].fecha.split("-").map(Number);
    const offset = (new Date(Date.UTC(yy, mm - 1, 1)).getUTCDay() + 6) % 7;
    let filas = 0;
    dias.forEach((d, i) => {
      const pos = offset + i;
      const col = pos % 7;
      const row = Math.floor(pos / 7);
      filas = Math.max(filas, row + 1);
      const cx = MARGIN + cellW * col + cellW / 2;
      const cy = y + row * cellH + 10;
      const dia = Number(d.fecha.slice(8, 10));
      const color = COLORES_DIA[d.estado];
      doc.text(cx - 12, cy - 9, String(dia), { size: 6, color: MUTED, align: "right" });
      if (color) {
        doc.circle(cx, cy, 8.5, { fill: color.fill });
        const label = d.estado === "TRABAJADO" ? String(d.servicios ?? "") : d.estado === "NO_TRABAJADO" ? "F" : "";
        if (label) doc.text(cx, cy - 3.4, label, { size: 7.5, bold: true, color: color.text, align: "center" });
      } else doc.circle(cx, cy, 8.5, { stroke: "#d1d5db" });
      const km = kmPorDia.get(d.fecha);
      if (km) doc.text(cx, cy + 10.5, formatKm(km), { size: 6, color: "#374151", align: "center" });
    });
    y += filas * cellH + 2;
    const cuenta = (estado) => dias.filter((d) => d.estado === estado).length;
    const entregas = dias.reduce((s, d) => s + (d.estado === "TRABAJADO" ? Number(d.servicios) || 0 : 0), 0);
    let lx = MARGIN;
    for (const [estado, label] of LEYENDA_DIAS) {
      doc.circle(lx + 4, y + 4, 4, { fill: COLORES_DIA[estado].fill });
      doc.text(lx + 12, y + 0.5, label, { size: 7.5, color: "#374151" });
      lx += estado === "TRABAJADO" ? 175 : 112;
    }
    y += 14;
    doc.text(
      MARGIN,
      y,
      `Días trabajados: ${cuenta("TRABAJADO")}  ·  Faltas sin justificar: ${cuenta("NO_TRABAJADO")}  ·  Justificados: ${cuenta("JUSTIFICADO")}  ·  Entregas: ${entregas}`,
      { size: 8.5, bold: true, color: NAVY }
    );
    y += 20;
  }

  if (op.calculo && m.categoria) {
    const c = m.categoria;
    section(`Cálculo por categoría: ${c.categoria.label}`);
    ensure(30);
    doc.text(MARGIN, y, `Meta ${c.categoria.label}: ${c.categoria.metaKm.toLocaleString("es-AR")} km  ·  Referencia neta: ${formatCurrency(c.categoria.referencia)}/mes  ·  Factor: ${c.factor}`, { size: 8.5, color: "#374151" });
    y += 16;
    table(
      [
        { title: "Concepto", width: 110, bold: true },
        { title: "Cálculo", width: 315, color: "#374151" },
        { title: "Importe", width: CONTENT_W - 425, align: "right", bold: true },
      ],
      c.filas.map((f) => [f.concepto, f.real, formatCurrency(f.valor)]),
      { total: ["RESULTADO DEL MES", formatCurrency(c.resultado)] }
    );
    if (c.nota) {
      for (const line of wrapText(`Nota: ${c.nota}`, CONTENT_W, 8.5)) {
        ensure(12);
        doc.text(MARGIN, y, line, { size: 8.5, color: "#374151" });
        y += 11;
      }
    }
    doc.text(MARGIN, y, "Propuesta ilustrativa. Pago definitivo sujeto a jornada remunerable y revisión en nómina.", { size: 7.5, color: MUTED });
    y += 18;
  }

  if (op.calculo && m.avisos.length) {
    section("Observaciones");
    for (const aviso of m.avisos) {
      const lines = wrapText(aviso.texto, CONTENT_W - 24, 8.5);
      const h = lines.length * 11 + 8;
      ensure(h + 4);
      doc.rect(MARGIN, y, CONTENT_W, h, { fill: aviso.tono === "warn" ? "#fef3c7" : LIGHT });
      doc.text(MARGIN + 8, y + 4, "•", { size: 9, bold: true, color: aviso.tono === "warn" ? "#b45309" : MUTED });
      lines.forEach((line, i) => doc.text(MARGIN + 18, y + 4 + i * 11, line, { size: 8.5, color: aviso.tono === "warn" ? "#92400e" : "#374151" }));
      y += h + 4;
    }
    y += 4;
  }

  if (op.entregas && m.servicios.length) {
    section(`Detalle de entregas del mes (${m.servicios.length})`);
    table(
      [
        { title: "Fecha", width: 58 },
        { title: "Código", width: 118, bold: true },
        { title: "Cliente - destino", width: 199 },
        { title: "Km", width: 60, align: "right" },
        { title: "Horas de manejo", width: CONTENT_W - 435, align: "right" },
      ],
      m.servicios.map((s) => [s.fecha, s.codigo, s.cliente, s.km, s.horas])
    );
  }

  // Firmas.
  ensure(80);
  y += 40;
  const sigW = 200;
  doc.line(MARGIN, y, MARGIN + sigW, y, { color: "#9ca3af", width: 0.8 });
  doc.line(PAGE_W - MARGIN - sigW, y, PAGE_W - MARGIN, y, { color: "#9ca3af", width: 0.8 });
  doc.text(MARGIN, y + 6, "Firma del chofer", { size: 8, bold: true, color: NAVY });
  doc.text(MARGIN, y + 17, params.driver.nombre, { size: 8, color: MUTED });
  doc.text(PAGE_W - MARGIN - sigW, y + 6, "Por la empresa", { size: 8, bold: true, color: NAVY });
  doc.text(PAGE_W - MARGIN - sigW, y + 17, EMPRESA, { size: 8, color: MUTED });
};

const finishPdf = (doc) => {
  const pages = doc.pageCount;
  for (let i = 0; i < pages; i++) {
    doc.onPage(i);
    doc.line(MARGIN, FOOTER_Y, PAGE_W - MARGIN, FOOTER_Y, { color: BORDER });
    doc.text(MARGIN, FOOTER_Y + 7, `${EMPRESA} · Documento generado por ONE DRIVER`, { size: 7.5, color: MUTED });
    doc.text(PAGE_W - MARGIN, FOOTER_Y + 7, `Página ${i + 1} de ${pages}`, { size: 7.5, color: MUTED, align: "right" });
  }
  return doc.toBlob();
};

const newDoc = async () => {
  const logo = await loadLogo();
  const doc = new PdfDoc();
  if (logo?.jpeg) doc.setImage(logo.jpeg, logo.size, logo.size);
  return { doc, logo };
};

// PDF de un chofer. opciones: { asistencia, calculo, entregas } (todas en true si no se pasan).
export const downloadPagoChoferPdf = async (params, opciones) => {
  const { doc, logo } = await newDoc();
  drawDriverPdf(doc, logo, params, opciones, false);
  downloadBlob(`${fileBase(params.driver, params.month)}.pdf`, finishPdf(doc));
};

// Reporte del mes de todos los choferes: una hoja resumen y despues el informe de cada uno (cada uno empieza en su pagina).
export const downloadReporteMesPdf = async ({ month, choferes, opciones }) => {
  const op = { ...DEFAULT_OPCIONES, ...opciones };
  const { doc, logo } = await newDoc();
  const periodo = monthLabel(month);
  doc.rect(0, 0, PAGE_W, 6, { fill: NAVY });
  doc.drawImage(MARGIN, 26, 54, 54);
  const tx = logo?.jpeg ? MARGIN + 66 : MARGIN;
  doc.text(tx, 30, "Reporte mensual de choferes", { size: 18, bold: true, color: NAVY });
  doc.text(tx, 54, EMPRESA, { size: 11, bold: true, color: ACCENT });
  doc.text(tx, 69, `${choferes.length} choferes · ${PDF_PARTES.filter((p) => op[p.value]).map((p) => p.label.toLowerCase()).join(", ")}`, { size: 9, color: MUTED });
  doc.text(PAGE_W - MARGIN, 32, "PERÍODO", { size: 8, bold: true, color: MUTED, align: "right" });
  doc.text(PAGE_W - MARGIN, 43, periodo, { size: 12, bold: true, color: NAVY, align: "right" });
  doc.text(PAGE_W - MARGIN, 61, `Emitido el ${formatDate(new Date())}`, { size: 8.5, color: MUTED, align: "right" });
  doc.line(MARGIN, 92, PAGE_W - MARGIN, 92, { color: ACCENT, width: 1.2 });

  // Tabla resumen.
  const cols = [
    { title: "Chofer", w: 150 },
    { title: "Entregas", w: 55, right: true },
    { title: "Km", w: 70, right: true },
    { title: "Días trab.", w: 60, right: true },
    { title: "Faltas", w: 50, right: true },
  ];
  if (op.calculo) cols.push({ title: "Categoría", w: 60 }, { title: "Resultado", w: CONTENT_W - 445, right: true });
  let y = 108;
  const head = () => {
    doc.rect(MARGIN, y, CONTENT_W, 18, { fill: LIGHT });
    let x = MARGIN;
    for (const c of cols) {
      doc.text(c.right ? x + c.w - 5 : x + 5, y + 5.5, c.title, { size: 8, bold: true, color: NAVY, align: c.right ? "right" : "left" });
      x += c.w;
    }
    y += 18;
  };
  head();
  let totalResultado = 0;
  choferes.forEach((p, i) => {
    if (y > FOOTER_Y - 40) {
      doc.addPage();
      y = 40;
      head();
    }
    const dias = p.calendario ?? [];
    const trab = dias.length ? dias.filter((d) => d.estado === "TRABAJADO").length : p.driver.asistencia?.trabajados ?? "-";
    const faltas = dias.length ? dias.filter((d) => d.estado === "NO_TRABAJADO").length : p.driver.asistencia?.noTrabajados ?? "-";
    const vals = [p.driver.nombre, String(p.servicios?.length ?? p.driver.servicios), formatKm(p.driver.km), String(trab), String(faltas)];
    if (op.calculo) {
      vals.push(p.categoria?.categoria.label ?? "-", p.categoria ? formatCurrency(p.categoria.resultado) : "-");
      totalResultado += p.categoria?.resultado ?? 0;
    }
    if (i % 2 === 1) doc.rect(MARGIN, y, CONTENT_W, 18, { fill: "#fafbfd" });
    let x = MARGIN;
    cols.forEach((c, ci) => {
      doc.text(c.right ? x + c.w - 5 : x + 5, y + 5, wrapText(vals[ci], c.w - 10, 8.5, ci === 0)[0], { size: 8.5, bold: ci === 0, color: "#1f2937", align: c.right ? "right" : "left" });
      x += c.w;
    });
    y += 18;
    doc.line(MARGIN, y, PAGE_W - MARGIN, y, { color: BORDER, width: 0.5 });
  });
  if (op.calculo) {
    doc.rect(MARGIN, y, CONTENT_W, 22, { fill: NAVY });
    doc.text(MARGIN + 7, y + 7, "TOTAL RESULTADO DEL MES", { size: 9.5, bold: true, color: "#ffffff" });
    doc.text(PAGE_W - MARGIN - 5, y + 6.5, formatCurrency(totalResultado), { size: 10.5, bold: true, color: "#ffffff", align: "right" });
  }

  for (const p of choferes) drawDriverPdf(doc, logo, p, op, true);
  downloadBlob(`Reporte_choferes_${month}.pdf`, finishPdf(doc));
};
