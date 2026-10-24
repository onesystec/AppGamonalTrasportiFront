import { formatCurrency } from "../../lib/format";

const nf = (value) => Number(value).toLocaleString("es-AR", { maximumFractionDigits: 2 });

// Un minuto antes del inicio de la banda siguiente: "22:00" -> "21:59".
const minusMinute = (hhmm) => {
  const total = (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) + 1439) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

// Reglas de pago vigentes (vienen del servidor, ver config/payRates.js), siempre a la vista para que
// nadie tenga que adivinar como se calcula.
export const PayRulesCard = ({ reglas, title = "Como se calcula" }) => {
  const day = `${reglas.banda.diaInicio}-${minusMinute(reglas.banda.nocheInicio)}`;
  const night = `${reglas.banda.nocheInicio}-${minusMinute(reglas.banda.diaInicio)}`;
  const km =
    reglas.kmBloqueDiaEur === reglas.kmBloqueNocheEur ? (
      <b className="text-ink-50">{formatCurrency(reglas.kmBloqueDiaEur)}</b>
    ) : (
      <>
        <b className="text-ink-50">{formatCurrency(reglas.kmBloqueDiaEur)}</b> de dia /{" "}
        <b className="text-ink-50">{formatCurrency(reglas.kmBloqueNocheEur)}</b> de noche
      </>
    );

  return (
    <div className="glass-surface-sm flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl px-5 py-3 text-[13px] text-ink-300">
      <span className="font-semibold text-ink-50">{title}</span>
      <span>
        Dia ({day}): <b className="text-ink-50">{formatCurrency(reglas.horaDiaEur)}</b>/h
      </span>
      <span>
        Noche ({night}): <b className="text-ink-50">{formatCurrency(reglas.horaNocheEur)}</b>/h
      </span>
      <span>
        Espera: <b className="text-ink-50">{formatCurrency(reglas.esperaHoraEur)}</b>/h, se suma
      </span>
      <span>
        Sin horas aprobadas: {km} cada {nf(reglas.kmBloque)} km{reglas.pagoPorKm ? " (85, 90 o 95 segun el chofer)" : ""}
      </span>
      {reglas.reperibilidad && (
        <span>
          Reperibilidad: <b className="text-ink-50">+{formatCurrency(reglas.reperibilidad.extraEur)}</b> por servicio fuera del
          horario laboral: sale en fin de semana o festivo{reglas.reperibilidad.nocheCuenta ? ", o es de noche (sale de noche o pasa la mayor parte en la noche)" : ""}
        </span>
      )}
      {reglas.redondeoHoras > 0 && <span>Horas redondeadas a {nf(reglas.redondeoHoras * 60)} min</span>}
    </div>
  );
};
