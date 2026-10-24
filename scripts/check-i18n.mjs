// Comprueba que el italiano tiene exactamente las mismas claves que el espanol (y que no hay textos vacios).
import { es } from "../src/i18n/es.js";
import { it } from "../src/i18n/it.js";

const missing = Object.keys(es).filter((key) => !(key in it));
const extra = Object.keys(it).filter((key) => !(key in es));
const empty = Object.entries(it).filter(([, value]) => !String(value).trim()).map(([key]) => key);
if (missing.length || extra.length || empty.length) {
  console.error({ missing, extra, empty });
  process.exit(1);
}
console.log(`i18n ok: ${Object.keys(es).length} claves`);
