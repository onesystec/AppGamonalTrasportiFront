// Generador minimo de PDF en el navegador (sin dependencias): paginas A4 con texto Helvetica, rectangulos, lineas y una imagen JPEG
// (el logo). Las coordenadas se pasan desde arriba a la izquierda, en puntos (A4 = 595 x 842).

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;

// Anchos de Helvetica y Helvetica-Bold (AFM, 1/1000 em) para los caracteres 32..126.
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HELV_B = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

// Caracteres fuera de Latin-1 que existen en WinAnsiEncoding.
const WIN_ANSI = { "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "•": 0x95, "–": 0x96, "—": 0x97, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "™": 0x99 };

const toWinAnsi = (text) => {
  let out = "";
  for (const ch of String(text ?? "")) {
    const code = ch.codePointAt(0);
    if (WIN_ANSI[ch]) out += String.fromCharCode(WIN_ANSI[ch]);
    else if (ch === " " || ch === " ") out += " ";
    else if (code >= 32 && code <= 255 && !(code >= 127 && code < 160)) out += ch;
    else if (code === 10 || code === 9) out += " ";
    else out += "?";
  }
  return out;
};

const charWidth = (ch, bold) => {
  const table = bold ? HELV_B : HELV;
  const code = ch.charCodeAt(0);
  if (code >= 32 && code <= 126) return table[code - 32];
  if (code === 0xa0) return 278;
  // Letras con acento: el ancho de la letra base.
  const base = ch.normalize("NFD")[0];
  const b = base.charCodeAt(0);
  if (b >= 32 && b <= 126) return table[b - 32];
  return 556;
};

export const textWidth = (text, size, bold = false) => {
  let w = 0;
  for (const ch of toWinAnsi(text)) w += charWidth(ch, bold);
  return (w * size) / 1000;
};

// Parte un texto en lineas que entran en `width`.
export const wrapText = (text, width, size, bold = false) => {
  // Una palabra mas ancha que la columna (ej. un codigo de servicio largo) se corta en pedazos para que no pise la columna de al lado.
  const words = [];
  for (const word of String(text ?? "").split(/\s+/).filter(Boolean)) {
    if (textWidth(word, size, bold) <= width) {
      words.push(word);
      continue;
    }
    // Primero se corta despues de cada guion (FARM-2026-10- / 100003-PIAZZA); solo si un pedazo sigue sin entrar, por letras.
    const parts = word.split(/(?<=-)/);
    let piece = "";
    const flush = () => {
      if (piece) words.push(piece);
      piece = "";
    };
    for (const part of parts) {
      if (textWidth(piece + part, size, bold) <= width) {
        piece += part;
        continue;
      }
      flush();
      if (textWidth(part, size, bold) <= width) {
        piece = part;
        continue;
      }
      for (const ch of part) {
        if (piece && textWidth(piece + ch, size, bold) > width) flush();
        piece += ch;
      }
    }
    flush();
  }
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size, bold) <= width || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
};

const pdfString = (text) => `(${toWinAnsi(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")})`;
const n = (v) => (Math.round(v * 100) / 100).toString();
const rgb = (hex) => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => n(parseInt(h.slice(i, i + 2), 16) / 255)).join(" ");
};

export class PdfDoc {
  constructor() {
    this.pages = [];
    this.image = null;
    this.addPage();
  }

  addPage() {
    this.ops = [];
    this.pages.push(this.ops);
    return this;
  }

  get pageCount() {
    return this.pages.length;
  }

  // Dibuja en una pagina ya creada (para numerar al final).
  onPage(index) {
    this.ops = this.pages[index];
    return this;
  }

  text(x, y, str, { size = 10, bold = false, color = "#1f2937", align = "left" } = {}) {
    let tx = x;
    if (align === "right") tx = x - textWidth(str, size, bold);
    else if (align === "center") tx = x - textWidth(str, size, bold) / 2;
    this.ops.push(`BT /${bold ? "F2" : "F1"} ${n(size)} Tf ${rgb(color)} rg ${n(tx)} ${n(PAGE_H - y - size * 0.8)} Td ${pdfString(str)} Tj ET`);
    return this;
  }

  rect(x, y, w, h, { fill, stroke, lineWidth = 0.6 } = {}) {
    const parts = [];
    if (fill) parts.push(`${rgb(fill)} rg`);
    if (stroke) parts.push(`${rgb(stroke)} RG ${n(lineWidth)} w`);
    parts.push(`${n(x)} ${n(PAGE_H - y - h)} ${n(w)} ${n(h)} re ${fill && stroke ? "B" : fill ? "f" : "S"}`);
    this.ops.push(parts.join(" "));
    return this;
  }

  // Circulo relleno con centro (cx, cy) y radio r.
  circle(cx, cy, r, { fill, stroke, lineWidth = 0.8 } = {}) {
    const k = 0.5523 * r;
    const Y = PAGE_H - cy;
    const path = [
      `${n(cx + r)} ${n(Y)} m`,
      `${n(cx + r)} ${n(Y + k)} ${n(cx + k)} ${n(Y + r)} ${n(cx)} ${n(Y + r)} c`,
      `${n(cx - k)} ${n(Y + r)} ${n(cx - r)} ${n(Y + k)} ${n(cx - r)} ${n(Y)} c`,
      `${n(cx - r)} ${n(Y - k)} ${n(cx - k)} ${n(Y - r)} ${n(cx)} ${n(Y - r)} c`,
      `${n(cx + k)} ${n(Y - r)} ${n(cx + r)} ${n(Y - k)} ${n(cx + r)} ${n(Y)} c`,
    ].join(" ");
    const parts = [];
    if (fill) parts.push(`${rgb(fill)} rg`);
    if (stroke) parts.push(`${rgb(stroke)} RG ${n(lineWidth)} w`);
    parts.push(`${path} ${fill && stroke ? "B" : fill ? "f" : "S"}`);
    this.ops.push(parts.join(" "));
    return this;
  }

  line(x1, y1, x2, y2, { color = "#d5dae5", width = 0.6 } = {}) {
    this.ops.push(`${rgb(color)} RG ${n(width)} w ${n(x1)} ${n(PAGE_H - y1)} m ${n(x2)} ${n(PAGE_H - y2)} l S`);
    return this;
  }

  // jpeg: Uint8Array de un JPEG RGB; se guarda una sola vez y se puede dibujar en varias paginas.
  setImage(jpeg, width, height) {
    this.image = { jpeg, width, height };
  }

  drawImage(x, y, w, h) {
    if (!this.image) return this;
    this.ops.push(`q ${n(w)} 0 0 ${n(h)} ${n(x)} ${n(PAGE_H - y - h)} cm /Im1 Do Q`);
    return this;
  }

  toBlob() {
    const chunks = [];
    const offsets = [];
    let length = 0;
    const push = (part) => {
      const bytes = typeof part === "string" ? Uint8Array.from(part, (c) => c.charCodeAt(0) & 0xff) : part;
      chunks.push(bytes);
      length += bytes.length;
    };
    const obj = (id, body) => {
      offsets[id] = length;
      push(`${id} 0 obj\n`);
      for (const part of [].concat(body)) push(part);
      push("\nendobj\n");
    };

    // 1 catalogo, 2 paginas, 3 Helvetica, 4 Helvetica-Bold, 5 imagen, luego pagina + contenido por cada pagina.
    const firstPage = 6;
    const kids = this.pages.map((_, i) => `${firstPage + i * 2} 0 R`).join(" ");
    push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${this.pages.length} >>`);
    obj(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    obj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    if (this.image) {
      obj(5, [
        `<< /Type /XObject /Subtype /Image /Width ${this.image.width} /Height ${this.image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${this.image.jpeg.length} >>\nstream\n`,
        this.image.jpeg,
        "\nendstream",
      ]);
    } else obj(5, "<< >>");
    this.pages.forEach((ops, i) => {
      const pageId = firstPage + i * 2;
      const content = ops.join("\n");
      const xobj = this.image ? " /XObject << /Im1 5 0 R >>" : "";
      obj(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xobj} >> /Contents ${pageId + 1} 0 R >>`);
      obj(pageId + 1, [`<< /Length ${content.length} >>\nstream\n`, content, "\nendstream"]);
    });

    const xrefAt = length;
    const total = firstPage + this.pages.length * 2;
    let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
    for (let id = 1; id < total; id++) xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    push(`${xref}trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`);
    return new Blob(chunks, { type: "application/pdf" });
  }
}
