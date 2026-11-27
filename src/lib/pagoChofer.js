import { formatCurrency, formatKm } from "./format";
import { formatHours } from "./horas";

const nf = (value) => Number(value).toLocaleString("es-AR", { maximumFractionDigits: 1 });

// "2026-10" -> "Octubre 2026"
export const monthLabel = (month) => {
  const [y, m] = month.split("-").map(Number);
  const text = new Date(y, m - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" }).replace(" de ", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Desglose de lo que se paga a un chofer en el mes, armado desde los datos que manda el servidor (no recalcula nada): cada concepto con su
// cantidad, como se calcula y su pago; el resumen dia/noche/espera/reperibilidad y los avisos. Lo usan la pantalla y los informes Excel/PDF.
export const buildDesglose = (driver) => {
  const d = driver.desglose;
  if (!d) return null;
  const t = d.tarifas;
  const filas = [];
  for (const [franja, titulo] of [["dia", "dia"], ["noche", "noche"]]) {
    const tarifaKm = franja === "dia" ? t.kmBloqueDiaEur : t.kmBloqueNocheEur;
    const tarifaHora = franja === "dia" ? t.horaDiaEur : t.horaNocheEur;
    const km = d[franja].porKm;
    if (km.servicios > 0)
      filas.push({
        clave: `${franja}-km`,
        concepto: `Servicios de ${titulo} - por km`,
        cantidad: `${km.servicios} ${km.servicios === 1 ? "servicio" : "servicios"} - ${formatKm(km.km)}`,
        calculo: `${nf(km.km)} km ÷ ${t.kmh} km/h = ${formatHours(km.horas)} x ${formatCurrency(tarifaKm)}/h`,
        pago: km.pago,
      });
    const ruta = d[franja].porRuta;
    if (ruta.servicios > 0)
      filas.push({
        clave: `${franja}-ruta`,
        concepto: `Servicios de ${titulo} - cortos (tiempo de ruta)`,
        cantidad: `${ruta.servicios} ${ruta.servicios === 1 ? "servicio" : "servicios"} - ${formatKm(ruta.km)}`,
        calculo: `${formatHours(ruta.horas)} de ruta (ida y vuelta) x ${formatCurrency(tarifaHora)}/h${t.tiempoRutaHastaKm ? ` - menos de ${t.tiempoRutaHastaKm} km se paga por tiempo` : ""}`,
        pago: ruta.pago,
      });
    const horas = d[franja].porHoras;
    if (horas.servicios > 0)
      filas.push({
        clave: `${franja}-horas`,
        concepto: `Horas de ${titulo} (jornada)`,
        cantidad: formatHours(horas.horas),
        calculo: `${formatHours(horas.horas)} x ${formatCurrency(tarifaHora)}/h`,
        pago: horas.pago,
      });
  }
  if (d.espera.horas > 0)
    filas.push({
      clave: "espera",
      concepto: "Espera aprobada",
      cantidad: formatHours(d.espera.horas),
      calculo: `${formatHours(d.espera.horas)} x ${formatCurrency(t.esperaHoraEur)}/h`,
      pago: d.espera.pago,
    });
  if (d.reperibilidad.salidas > 0)
    filas.push({
      clave: "reperibilidad",
      concepto: "Reperibilidad (fuera del horario laboral)",
      cantidad: `${d.reperibilidad.salidas} ${d.reperibilidad.salidas === 1 ? "salida" : "salidas"}`,
      calculo: `${[
        d.reperibilidad.noche > 0 && `${d.reperibilidad.noche} de noche`,
        d.reperibilidad.finDeSemana > 0 && `${d.reperibilidad.finDeSemana} de fin de semana`,
        d.reperibilidad.festivo > 0 && `${d.reperibilidad.festivo} en festivo`,
      ]
        .filter(Boolean)
        .join(", ")} - ${d.reperibilidad.salidas} x ${formatCurrency(t.reperibilidadEur)}`,
      pago: d.reperibilidad.pago,
    });
  if (d.adicionales.count > 0)
    filas.push({
      clave: "adicionales",
      concepto: "Trabajos adicionales aprobados",
      cantidad: `${d.adicionales.count} - ${formatHours(d.adicionales.horas)}`,
      calculo: `horas a tarifa de dia (${formatCurrency(t.horaDiaEur)}/h) o de noche (${formatCurrency(t.horaNocheEur)}/h)`,
      pago: d.adicionales.pago,
    });

  // Totales de un vistazo: km de dia, km de noche, horas de espera y reperibilidad, cada uno con lo que se paga por ello.
  const franjaTotal = (f) => {
    const buckets = [d[f].porKm, d[f].porRuta, d[f].porHoras];
    return {
      servicios: buckets.reduce((s, b) => s + b.servicios, 0),
      km: buckets.reduce((s, b) => s + b.km, 0),
      horas: buckets.reduce((s, b) => s + b.horas, 0),
      pago: buckets.reduce((s, b) => s + b.pago, 0),
      porHoras: d[f].porHoras.servicios > 0,
    };
  };
  const dia = franjaTotal("dia");
  const noche = franjaTotal("noche");
  const resumen = [
    { clave: "dia", titulo: "Dia", grande: dia.porHoras && dia.km === 0 ? formatHours(dia.horas) : formatKm(dia.km), detalle: `${dia.servicios} ${dia.servicios === 1 ? "servicio" : "servicios"}${dia.horas > 0 && !(dia.porHoras && dia.km === 0) ? ` - ${formatHours(dia.horas)}` : ""}`, pago: dia.pago },
    { clave: "noche", titulo: "Noche", grande: noche.porHoras && noche.km === 0 ? formatHours(noche.horas) : formatKm(noche.km), detalle: `${noche.servicios} ${noche.servicios === 1 ? "servicio" : "servicios"}${noche.horas > 0 && !(noche.porHoras && noche.km === 0) ? ` - ${formatHours(noche.horas)}` : ""}`, pago: noche.pago },
    { clave: "espera", titulo: "Espera", grande: formatHours(d.espera.horas), detalle: d.espera.pendienteHoras > 0 ? `+ ${formatHours(d.espera.pendienteHoras)} por aprobar (no suma)` : "aprobada", pago: d.espera.pago },
    { clave: "rep", titulo: "Reperibilidad", grande: `${d.reperibilidad.salidas} ${d.reperibilidad.salidas === 1 ? "salida" : "salidas"}`, detalle: `${formatCurrency(t.reperibilidadEur)} por salida`, pago: d.reperibilidad.pago },
  ];

  const v = d.validaciones;
  const avisos = [
    d.espera.pendienteHoras > 0 && {
      tono: "warn",
      texto: `Espera por aprobar: ${formatHours(d.espera.pendienteHoras)} (serian ${formatCurrency(d.espera.pendientePago)}). No suma al pago hasta que un responsable la apruebe.`,
    },
    v.serviciosSinKm > 0 && { tono: "warn", texto: `${v.serviciosSinKm} ${v.serviciosSinKm === 1 ? "servicio sin km ni circuito" : "servicios sin km ni circuito"}: se pagan 0 hasta que tengan datos.` },
    v.kmARevisar > 0 && { tono: "warn", texto: `${v.kmARevisar} ${v.kmARevisar === 1 ? "servicio con km a revisar" : "servicios con km a revisar"} (el circuito tiene muchos mas km que los planificados).` },
    v.viajesIncluidos > 0 && { tono: "info", texto: `${v.viajesIncluidos} ${v.viajesIncluidos === 1 ? "servicio va incluido" : "servicios van incluidos"} en un viaje compactado: el viaje se paga una sola vez, en su servicio principal.` },
    v.horasPorAprobar > 0 && { tono: "info", texto: `${v.horasPorAprobar} ${v.horasPorAprobar === 1 ? "servicio con horas por aprobar" : "servicios con horas por aprobar"}.` },
    t.pagoPorKm && { tono: "info", texto: `Velocidad de pago: ${t.kmh} km/h (los km se pasan a horas de manejo con esa velocidad).` },
  ].filter(Boolean);

  return { filas, resumen, avisos };
};

// Km de la entrega y horas de manejo de un servicio, para mostrarlos en columnas propias ("-" si no hay dato).
export const servicioKmTexto = (s) => (Number(s.km) > 0 ? formatKm(s.km) : "-");
export const servicioHorasTexto = (s) => {
  const horas = s.modo === "HORAS" ? (Number(s.horasDia) || 0) + (Number(s.horasNoche) || 0) : Number(s.horasManejo) || 0;
  return horas > 0 ? formatHours(horas) : "-";
};
