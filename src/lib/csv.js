// Separador ";" y decimales con coma (no ".") - un CSV con "," como separador de
// columna Y de decimales es ambiguo, y Excel en espanol/italiano (la configuracion
// real de esta operacion) espera ";" entre columnas. Mismo criterio que formatCurrency
// (locale es-AR) ya usa en el resto de la app, solo que sin el simbolo de moneda: en
// una celda numerica de Excel el simbolo € rompe que se pueda sumar/graficar directo.
const CSV_DELIMITER = ";";

const escapeCsvField = (value) => {
  const str = String(value ?? "");
  return /[";\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

export const downloadCsv = (filename, csvContent) => {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// CSV del export completo: el servidor manda las columnas y las filas ya escritas como texto.
export const buildFullCsv = ({ columnas, filas }) => {
  const header = columnas.map(escapeCsvField).join(CSV_DELIMITER);
  const rows = filas.map((fila) => fila.map(escapeCsvField).join(CSV_DELIMITER));
  return `\uFEFF${[header, ...rows].join("\r\n")}`;
};
