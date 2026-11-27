import clsx from "clsx";
import { useState } from "react";
import { CATEGORIAS, FACTORES, TARIFAS_CATEGORIA, calcularCategoria } from "../../lib/categoriaPago";
import { parseApiError } from "../../lib/api";
import { setCategoriaPagoRequest } from "../../lib/finanzas.api";
import { formatCurrency } from "../../lib/format";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { CheckCircleIcon, AlertTriangleIcon, PencilIcon } from "../ui/icons";

const CAMPOS = [
  { campo: "conduccion", label: "Conducción" },
  { campo: "reperibilidad", label: "Reperibilità" },
  { campo: "esperas", label: "Esperas" },
  { campo: "disponibilidad", label: "Disponibilidad" },
  { campo: "productividad", label: "Productividad" },
  { campo: "ajuste", label: "Ajuste manual (+/-)" },
];

const toForm = (manual) => ({
  categoria: manual?.categoria ?? "",
  factor: manual?.factor ? String(manual.factor) : "",
  ...Object.fromEntries(CAMPOS.map(({ campo }) => [campo, manual?.[campo] != null ? String(manual[campo]).replace(".", ",") : ""])),
  nota: manual?.nota ?? "",
});

const parseMonto = (text) => {
  const t = String(text ?? "").trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

const fieldClass = "glass-input w-full rounded-lg px-3 py-2 text-[13px] text-ink-50";

// Calculo por categoria (Junior / Senior / Master) del chofer en el mes: comparativo "si cumple la meta" contra lo real, con cada valor
// editable a mano. Lo guardado se usa tambien en el Excel y el PDF.
export const CategoriaPagoCard = ({ driver, month, manual, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => toForm(manual));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Mientras se edita, el calculo se ve con lo que se va escribiendo.
  const borrador = editing
    ? {
        categoria: form.categoria || null,
        factor: form.factor ? Number(form.factor) : null,
        ...Object.fromEntries(CAMPOS.map(({ campo }) => [campo, Number.isNaN(parseMonto(form[campo])) ? null : parseMonto(form[campo])])),
        nota: form.nota,
      }
    : manual;
  const c = calcularCategoria(driver, borrador ?? {});

  const startEdit = () => {
    setForm(toForm(manual));
    setError("");
    setEditing(true);
  };

  const save = async (valores) => {
    setSaving(true);
    setError("");
    try {
      const saved = await setCategoriaPagoRequest({ driverId: driver.driverId, month, ...valores });
      onSaved(driver.driverId, saved);
      setEditing(false);
    } catch (err) {
      setError(parseApiError(err).message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const guardar = () => {
    const montos = Object.fromEntries(CAMPOS.map(({ campo }) => [campo, parseMonto(form[campo])]));
    const invalido = CAMPOS.find(({ campo }) => Number.isNaN(montos[campo]));
    if (invalido) return setError(`${invalido.label}: escribe un número válido (ej. 100 o 85,50)`);
    save({ categoria: form.categoria || null, factor: form.factor ? Number(form.factor) : null, ...montos, nota: form.nota.trim() || null });
  };

  const restablecer = () =>
    save({ categoria: null, factor: null, ...Object.fromEntries(CAMPOS.map(({ campo }) => [campo, null])), nota: null });

  const set = (campo) => (e) => setForm((prev) => ({ ...prev, [campo]: e.target.value }));

  return (
    <div className="overflow-hidden rounded-xl border border-line/10">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-line/[0.05] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-300">Cálculo por categoría</span>
          <span className="rounded-md bg-accent-500/15 px-2 py-0.5 text-[12px] font-semibold text-accent-300">{c.categoria.label}</span>
          <span
            className={clsx(
              "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-medium",
              c.cumple ? "bg-success-500/15 text-success-500" : "bg-warning-500/15 text-warning-500"
            )}
          >
            {c.cumple ? <CheckCircleIcon className="h-3.5 w-3.5" /> : <AlertTriangleIcon className="h-3.5 w-3.5" />}
            {c.cumple ? "Cumple" : "No cumple"}
          </span>
          {c.editadoAMano && !editing && <span className="text-[11px] text-ink-400">· con ajustes manuales</span>}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium text-accent-400 transition-colors hover:bg-accent-500/10 hover:text-accent-300"
          >
            <PencilIcon className="h-4 w-4" />
            Editar
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        <p className="text-[12.5px] text-ink-400">
          Meta {c.categoria.label}: <b className="text-ink-100">{c.categoria.metaKm.toLocaleString("es-AR")} km</b> · referencia neta{" "}
          <b className="text-ink-100">{formatCurrency(c.categoria.referencia)}/mes</b> · factor <b className="text-ink-100">{c.factor}</b>
          {!c.categoriaManual && " · categoría según los km del mes"}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {c.objetivos.map((o) => (
            <span
              key={o.clave}
              className={clsx("rounded-lg px-2.5 py-1 text-[11.5px]", o.ok ? "bg-success-500/10 text-success-500" : "bg-warning-500/10 text-warning-500")}
              title={`Meta: ${o.meta}`}
            >
              {o.label}: {o.real}
            </span>
          ))}
        </div>

        {editing && (
          <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-line/[0.04] p-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-[11.5px] text-ink-400">
              Categoría
              <select value={form.categoria} onChange={set("categoria")} className={fieldClass}>
                <option value="">Automática ({CATEGORIAS.find((x) => x.value === c.categoriaAuto)?.label})</option>
                {CATEGORIAS.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label} ({x.metaKm.toLocaleString("es-AR")} km)
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] text-ink-400">
              Factor
              <select value={form.factor} onChange={set("factor")} className={fieldClass}>
                <option value="">Automático ({c.factorAuto})</option>
                {FACTORES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            {CAMPOS.map(({ campo, label }) => (
              <label key={campo} className="flex flex-col gap-1 text-[11.5px] text-ink-400">
                {label} (€)
                <input
                  type="text"
                  inputMode="decimal"
                  value={form[campo]}
                  onChange={set(campo)}
                  placeholder={`Auto: ${String(c.auto[campo]).replace(".", ",")}`}
                  className={fieldClass}
                />
              </label>
            ))}
            <label className="col-span-2 flex flex-col gap-1 text-[11.5px] text-ink-400 sm:col-span-3">
              Nota (sale en el PDF)
              <input type="text" value={form.nota} onChange={set("nota")} maxLength={500} placeholder="Motivo del ajuste (opcional)" className={fieldClass} />
            </label>
            <p className="col-span-2 text-[11px] text-ink-400 sm:col-span-3">Deja un campo vacío para que se calcule solo.</p>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-line/10">
          <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] gap-3 bg-line/[0.04] px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            <span>Concepto</span>
            <span>Si cumple la meta</span>
            <span>Resultado del mes</span>
          </div>
          {c.filas.map((f) => (
            <div
              key={f.clave}
              className={clsx(
                "grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] items-center gap-3 border-t border-line/10 px-3 py-2 text-[12.5px]",
                f.subtotal && "bg-line/[0.03] font-semibold"
              )}
            >
              <span className="font-medium text-ink-50">{f.concepto}</span>
              <span className="text-ink-300">{f.meta}</span>
              <span className="text-ink-50">{f.real}</span>
            </div>
          ))}
          <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] items-center gap-3 border-t border-line/20 bg-line/[0.06] px-3 py-2.5 text-[13.5px] font-bold text-ink-50">
            <span>Resultado</span>
            <span>{formatCurrency(c.meta.resultado)}</span>
            <span>{formatCurrency(c.resultado)}</span>
          </div>
        </div>

        <p className="text-[13px] font-semibold text-accent-300">
          {c.diferencia > 0
            ? `Le faltan ${formatCurrency(c.diferencia)} para el resultado de cumplir la meta.`
            : c.diferencia < 0
              ? `Supera en ${formatCurrency(-c.diferencia)} el resultado de cumplir la meta.`
              : "Resultado igual al de cumplir la meta."}
        </p>
        {c.nota && !editing && <p className="text-[12px] text-ink-300">Nota: {c.nota}</p>}
        <p className="text-[11px] text-ink-400">
          Conducción = km ÷ factor × {TARIFAS_CATEGORIA.conduccionEur} € · Reperibilità = salidas × {TARIFAS_CATEGORIA.reperibilidadEur} € · Esperas = horas ×{" "}
          {TARIFAS_CATEGORIA.esperaEur} €. Propuesta ilustrativa: no cambia el total a pagar de arriba.
        </p>

        <Alert>{error}</Alert>
        {editing && (
          <div className="flex flex-wrap justify-end gap-2">
            {manual && (
              <Button variant="ghost" className="w-auto! px-4!" disabled={saving} onClick={restablecer}>
                Restablecer todo
              </Button>
            )}
            <Button variant="ghost" className="w-auto! px-4!" disabled={saving} onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button className="w-auto! px-5!" loading={saving} onClick={guardar}>
              Guardar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
