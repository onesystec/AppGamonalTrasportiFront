import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Switch } from "../ui/Switch";
import { Textarea } from "../ui/Textarea";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { CATEGORIA_VEHICULO_LABELS, LITROS_MINIMOS_COMBUSTIBLE } from "../../lib/vehiculos";
import { setFaltantesExcepcionRequest, updateDeclaracionesRequest } from "../../lib/records.api";

// Que le falta a un servicio terminado: se muestra como avisos rojos en la lista y el detalle.
export const FALTANTE_LABELS = { ida: "Peaje de ida", vuelta: "Peaje de vuelta", combustible: "Carburante" };

export const hasFaltantes = (record) => (record.faltantes?.pendientes ?? 0) > 0;

export const FaltantesChips = ({ faltantes, className = "" }) => {
  if (!faltantes?.pendientes) return null;
  const items = Object.keys(FALTANTE_LABELS).filter((key) => faltantes[key]);
  return (
    <span className={`flex flex-wrap items-center gap-1 ${className}`}>
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-danger-500">Falta</span>
      {items.map((key) => (
        <span key={key} className="rounded-full bg-danger-500/15 px-2 py-0.5 text-[10.5px] font-medium text-danger-500">
          {FALTANTE_LABELS[key]}
        </span>
      ))}
    </span>
  );
};

const fmtL = (n) => Number(n).toLocaleString("es-AR", { maximumFractionDigits: 1 });

// Los tres switches del chofer. "values" = lo declarado; "onToggle(campo, valor)" lo cambia. Si ya hay un peaje
// o un comprobante que lo cubre, ese punto esta resuelto y no pide switch. "Todo en orden" activa de una vez los
// que siguen sin resolver.
// Con onAdd (el chofer, dentro del servicio) los avisos abren el formulario ahi mismo en vez de llevar a otra pantalla.
export const FaltantesSwitches = ({ record, values, onToggle, onAll, disabled, onAdd }) => {
  const location = useLocation();
  const mancatos = record.mancatos ?? [];
  const f = record.faltantes ?? {};
  // En un viaje compacto los peajes pueden estar asignados a cualquiera de sus servicios: manda lo que calcula el servidor.
  const hasIda = f.tieneIda ?? mancatos.some((m) => m.tramo === "IDA");
  const hasVuelta = f.tieneVuelta ?? mancatos.some((m) => m.tramo === "VUELTA");
  const ownFuel = record.combustible?.comprobantes?.count ?? 0;
  const day = f.combustibleDia;
  const fuelDone = ownFuel > 0 || (day?.comprobantes ?? 0) > 0 || Boolean(day?.declarado && !values.sinCombustible);
  const litros = f.litrosEstimados;

  const fuelDoneText =
    ownFuel > 0
      ? `Carburante: ${ownFuel} comprobante${ownFuel === 1 ? "" : "s"} cargado${ownFuel === 1 ? "" : "s"}`
      : (day?.comprobantes ?? 0) > 0
        ? "Carburante: el vehículo tiene comprobante ese día"
        : "Carburante: ya declarado en otro servicio del vehículo ese día";

  let fuelHint;
  if (day && day.litros > 0) {
    fuelHint = `Ese día el vehículo suma unos ${fmtL(day.litros)} L en ${day.servicios} servicio${day.servicios === 1 ? "" : "s"}${
      litros ? ` (este: ${fmtL(litros.min)}–${fmtL(litros.max)} L, ${CATEGORIA_VEHICULO_LABELS[record.vehicle?.categoria]})` : ""
    }. ${
      f.exigeCombustible
        ? "Se pide un comprobante del día o este switch en cualquiera de sus servicios."
        : `Por debajo de ${LITROS_MINIMOS_COMBUSTIBLE} L no se exige comprobante.`
    }`;
  } else {
    fuelHint = "Este vehículo no tiene categoría de consumo o el servicio no tiene km: no se puede estimar.";
  }

  const rows = [
    { done: hasIda, field: "sinPeajeIda" },
    { done: hasVuelta, field: "sinPeajeVuelta" },
    { done: fuelDone, field: "sinCombustible" },
  ];
  const unresolved = rows.filter((r) => !r.done && !values[r.field]).map((r) => r.field);

  const row = ({ done, doneText, id, label, field, hint, uploadTo, uploadLabel, add }) =>
    done ? (
      <div className="flex items-center gap-2 text-[13px] text-success-500">
        <span aria-hidden="true">✓</span>
        {doneText}
      </div>
    ) : (
      <div className="flex flex-col gap-1.5">
        <Switch id={id} label={label} description={hint} checked={Boolean(values[field])} disabled={disabled} onChange={(v) => onToggle(field, v)} />
        {!values[field] &&
          (onAdd ? (
            <button type="button" onClick={() => onAdd(add)} className="w-fit text-[12.5px] font-medium text-accent-400 hover:text-accent-300">
              {uploadLabel} &darr;
            </button>
          ) : (
            <Link
              to={uploadTo}
              state={{ backgroundLocation: location }}
              className="w-fit text-[12.5px] font-medium text-accent-400 hover:text-accent-300"
            >
              {uploadLabel} &rarr;
            </Link>
          ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      {row({
        done: hasIda,
        doneText: "Peaje de ida: aviso subido",
        id: "sin-peaje-ida",
        label: "Servicio de ida: no tuve mancato pagamento",
        field: "sinPeajeIda",
        hint: "Actívalo si en la ida no usaste peaje o ya lo pagaste en la barrera: no te llegará ningún aviso.",
        uploadTo: "/finanzas/mancato/new",
        uploadLabel: "Subir mancato pagamento de ida",
        add: { tipo: "peaje", tramo: "IDA" },
      })}
      {row({
        done: hasVuelta,
        doneText: "Peaje de vuelta: aviso subido",
        id: "sin-peaje-vuelta",
        label: "Volviendo después del servicio: no tuve mancato pagamento",
        field: "sinPeajeVuelta",
        hint: "Actívalo si al retornar no usaste peaje o ya lo pagaste en la barrera.",
        uploadTo: "/finanzas/mancato/new",
        uploadLabel: "Subir mancato pagamento de vuelta",
        add: { tipo: "peaje", tramo: "VUELTA" },
      })}
      {row({
        done: fuelDone,
        doneText: fuelDoneText,
        id: "sin-combustible",
        label: "Carburante: no fue necesario llenar para este servicio",
        field: "sinCombustible",
        hint: fuelHint,
        uploadTo: "/finanzas/combustible/new",
        uploadLabel: "Cargar comprobante de combustible",
        add: { tipo: "combustible" },
      })}
      {onAll && unresolved.length > 1 && (
        <Button variant="ghost" className="sm:w-auto sm:self-start sm:px-5" disabled={disabled} onClick={() => onAll(unresolved)}>
          Todo en orden: sin gastos para declarar
        </Button>
      )}
    </div>
  );
};

// Excepcion de la oficina: "no corresponde" exigirle nada a este servicio, con el motivo a la vista.
const ExcepcionBlock = ({ record, onReload }) => {
  const f = record.faltantes;
  const [editing, setEditing] = useState(false);
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const apply = async (aplicar) => {
    setSaving(true);
    setError("");
    try {
      await setFaltantesExcepcionRequest(record.id, { aplicar, nota });
      setEditing(false);
      setNota("");
      onReload?.();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  if (f.excepcion) {
    return (
      <div className="mt-4 rounded-xl bg-accent-500/10 px-3.5 py-3 text-[13px] text-ink-200">
        <b className="text-ink-50">Excepción de la oficina:</b> {f.excepcion.nota}
        {f.excepcion.por && <span className="text-ink-400"> — {f.excepcion.por}</span>}
        <Alert>{error}</Alert>
        <button
          type="button"
          disabled={saving}
          onClick={() => apply(false)}
          className="mt-2 block text-[12.5px] font-medium text-accent-400 hover:text-accent-300 disabled:opacity-50"
        >
          Quitar la excepción
        </button>
      </div>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-4 text-[12.5px] font-medium text-accent-400 hover:text-accent-300"
      >
        Marcar como "no corresponde" (excepción de la oficina)
      </button>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-2 rounded-xl border border-line/10 p-3">
      <Textarea
        id="faltantes-excepcion-nota"
        label="Motivo (obligatorio)"
        rows={2}
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Ej: servicio duplicado, el peaje quedó asignado a otro servicio..."
      />
      <Alert>{error}</Alert>
      <div className="flex gap-2">
        <Button className="sm:w-auto sm:px-5" loading={saving} disabled={nota.trim().length < 3} onClick={() => apply(true)}>
          Aplicar excepción
        </Button>
        <Button variant="ghost" className="sm:w-auto sm:px-5" disabled={saving} onClick={() => setEditing(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
};

// Tarjeta del detalle de un servicio terminado: cada cambio se guarda al instante.
export const FaltantesCard = ({ record, onReload, onAdd }) => {
  const { user } = useAuth();
  const isOffice = user?.cargo === "OWNER" || user?.cargo === "ADMIN";
  const f = record.faltantes;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [local, setLocal] = useState({});
  const declaredKey = JSON.stringify(f?.declarado ?? {});
  // Cuando llega el servicio recargado, lo declarado ya es lo guardado.
  useEffect(() => {
    setLocal({});
  }, [declaredKey]);
  if (!f?.aplica) return null;

  const values = { ...f.declarado, ...local };
  const save = async (changes) => {
    setError("");
    setSaving(true);
    setLocal((prev) => ({ ...prev, ...changes }));
    try {
      await updateDeclaracionesRequest(record.id, changes);
      onReload?.();
    } catch (err) {
      setLocal({});
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`mt-6 rounded-2xl border p-4 ${f.pendientes > 0 ? "border-danger-500/40 bg-danger-500/[0.07]" : "border-line/10 bg-line/[0.03]"}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-ink-50">Peajes y carburante</h3>
        {f.pendientes > 0 ? (
          <FaltantesChips faltantes={f} />
        ) : (
          <span className="text-[12px] font-medium text-success-500">{f.excepcion ? "Con excepción" : "Todo al día"}</span>
        )}
      </div>
      <Alert>{error}</Alert>
      {!f.excepcion && (
        <FaltantesSwitches
          record={record}
          values={values}
          onToggle={(field, value) => save({ [field]: value })}
          onAll={(fields) => save(Object.fromEntries(fields.map((field) => [field, true])))}
          disabled={saving}
          onAdd={onAdd}
        />
      )}
      {isOffice && <ExcepcionBlock record={record} onReload={onReload} />}
    </div>
  );
};

// Aviso del panel del chofer: servicios terminados con peajes o carburante sin declarar.
export const FaltantesBanner = ({ records }) => {
  const location = useLocation();
  const pending = records
    .filter(hasFaltantes)
    .sort((a, b) => new Date(b.fechaServicio) - new Date(a.fechaServicio));
  if (pending.length === 0) return null;

  return (
    <section className="rounded-3xl border border-danger-500/40 bg-danger-500/[0.08] p-5">
      <h2 className="text-[17px] font-semibold text-ink-50">
        {pending.length} servicio{pending.length === 1 ? "" : "s"} sin declarar peajes o carburante
      </h2>
      <p className="mt-1 text-[13px] text-ink-300">
        Sube el mancato pagamento o el comprobante, o activa el switch si no hubo. Así dejan de salir en rojo.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {pending.slice(0, 3).map((record) => (
          <Link
            key={record.id}
            to={`/records/${record.id}`}
            state={{ backgroundLocation: location }}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background/60 px-3.5 py-2.5 text-[13px] hover:bg-line/10"
          >
            <span className="min-w-0 truncate font-medium text-ink-50">
              {record.codigo} · {record.destinazione}
            </span>
            <FaltantesChips faltantes={record.faltantes} />
          </Link>
        ))}
      </div>
      {pending.length > 3 && (
        <Link to="/records" className="mt-3 inline-block text-[13px] font-medium text-accent-400 hover:text-accent-300">
          Ver los {pending.length} servicios &rarr;
        </Link>
      )}
    </section>
  );
};
