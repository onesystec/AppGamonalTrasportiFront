import clsx from "clsx";
import { useState } from "react";
import { CATEGORIAS, FACTORES, TARIFAS_CATEGORIA, calcularCategoria } from "../../lib/categoriaPago";
import { parseApiError } from "../../lib/api";
import { setCategoriaPagoRequest } from "../../lib/finanzas.api";
import { formatCurrency } from "../../lib/format";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { PencilIcon } from "../ui/icons";
import { SegmentedControl } from "../ui/SegmentedControl";

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
export const CategoriaPagoCard = ({ driver, month, manual, servicios, onSaved }) => {
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
  const c = calcularCategoria(driver, borrador ?? {}, servicios);

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

  // Lo guardado hoy (para cambiar solo el factor sin tocar lo demas).
  const guardado = () => ({
    categoria: manual?.categoria ?? null,
    factor: manual?.factor ?? null,
    ...Object.fromEntries(CAMPOS.map(({ campo }) => [campo, manual?.[campo] ?? null])),
    nota: manual?.nota ?? null,
  });
  const cambiarFactor = (factor) => {
    if (editing) setForm((prev) => ({ ...prev, factor: String(factor) }));
    else if (factor !== c.factor) save({ ...guardado(), factor });
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
          {c.editadoAMano && !editing && <span className="text-[11px] text-ink-400">· con ajustes manuales</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-ink-300">Factor</span>
          <SegmentedControl
            options={FACTORES.map((f) => ({ value: f, label: String(f) }))}
            value={c.factor}
            onChange={cambiarFactor}
            className={clsx(saving && "pointer-events-none opacity-60")}
          />
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
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        <p className="text-[12.5px] text-ink-400">
          Meta {c.categoria.label}: <b className="text-ink-100">{c.categoria.metaKm.toLocaleString("es-AR")} km</b> · referencia neta{" "}
          <b className="text-ink-100">{formatCurrency(c.categoria.referencia)}/mes</b>
          {!c.categoriaManual && " · categoría según los km del mes"}
        </p>

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
          <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)_110px] gap-3 bg-line/[0.04] px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            <span>Concepto</span>
            <span>Cálculo</span>
            <span className="text-right">Importe</span>
          </div>
          {c.filas.map((f) => (
            <div
              key={f.clave}
              className={clsx(
                "grid grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)_110px] items-center gap-3 border-t border-line/10 px-3 py-2 text-[12.5px]",
                f.subtotal && "bg-line/[0.03] font-semibold"
              )}
            >
              <span className="font-medium text-ink-50">{f.concepto}</span>
              <span className="text-ink-300">{f.real}</span>
              <span className="text-right font-semibold text-ink-50">{formatCurrency(f.valor)}</span>
            </div>
          ))}
          <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)_110px] items-center gap-3 border-t border-line/20 bg-line/[0.06] px-3 py-2.5 text-[13.5px] font-bold text-ink-50">
            <span>Resultado del mes</span>
            <span />
            <span className="text-right">{formatCurrency(c.resultado)}</span>
          </div>
        </div>

        {c.nota && !editing && <p className="text-[12px] text-ink-300">Nota: {c.nota}</p>}
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

// Resumen de como se calcula por categoria (Junior, Senior, Master): va en la ventana "¿Como se calcula?".
export const CategoriasInfo = () => {
  const T = TARIFAS_CATEGORIA;
  return (
    <div className="flex flex-col gap-3 text-[13px] text-ink-300">
      <div className="overflow-hidden rounded-xl border border-line/10">
        <div className="grid grid-cols-3 gap-3 bg-line/[0.05] px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-400">
          <span>Categoría</span>
          <span>Meta mensual</span>
          <span>Referencia neta</span>
        </div>
        {CATEGORIAS.map((cat) => (
          <div key={cat.value} className="grid grid-cols-3 gap-3 border-t border-line/10 px-4 py-2">
            <span className="font-medium text-ink-50">{cat.label}</span>
            <span>{cat.metaKm.toLocaleString("es-AR")} km</span>
            <span>{formatCurrency(cat.referencia)}/mes</span>
          </div>
        ))}
      </div>
      <ul className="flex flex-col gap-1.5 [&>li]:rounded-xl [&>li]:bg-line/[0.06] [&>li]:px-3.5 [&>li]:py-2.5">
        <li>
          <b className="text-ink-50">Categoría:</b> la más alta cuya meta de km alcanza el chofer en el mes (por debajo de {CATEGORIAS[1].metaKm.toLocaleString("es-AR")} km es
          Junior). Se puede elegir a mano con Editar.
        </li>
        <li>
          <b className="text-ink-50">Conducción</b> = km del mes ÷ factor × {formatCurrency(T.conduccionEur)}. El factor (85, 90 o 95) se elige arriba en cada chofer; si no se
          elige, es 85 cuando cumple los objetivos y 95 cuando no.
        </li>
        <li>
          <b className="text-ink-50">Navette WIZZ:</b> cada servicio del cliente WIZZ (Fiumicino, Catania...) se paga {formatCurrency(T.navettaWizzEur)} fijo por navetta, no por
          km. Sus km sí cuentan para la meta de la categoría y la productividad.
        </li>
        <li>
          <b className="text-ink-50">Reperibilità</b> = salidas efectivas × {formatCurrency(T.reperibilidadEur)}.
        </li>
        <li>
          <b className="text-ink-50">Esperas</b> = horas de espera aprobadas × {formatCurrency(T.esperaEur)}. Las horas por aprobar se muestran pero no suman.
        </li>
        <li>
          <b className="text-ink-50">Actividad</b> = conducción + reperibilità + esperas.
        </li>
        <li>
          <b className="text-ink-50">Disponibilidad:</b> {formatCurrency(T.bonoDisponibilidad)} con {T.salidasMeta} salidas efectivas y sin faltas injustificadas.{" "}
          <b className="text-ink-50">Productividad:</b> {formatCurrency(T.bonoProductividad)} al llegar a la meta de km de su categoría.
        </li>
        <li>
          <b className="text-ink-50">Resultado del mes</b> = actividad + disponibilidad + productividad + ajuste manual. Cualquier valor se puede corregir con Editar y queda
          guardado para ese chofer y mes.
        </li>
        <li>
          <b className="text-ink-50">Objetivos comunes:</b> {T.salidasMeta} salidas de reperibilità al mes, 95 % de entregas puntuales y 100 % documentadas, asistencia y
          guardias cumplidas, checklist y limpieza del vehículo al día, conducción segura.
        </li>
      </ul>
      <p className="text-[11.5px] text-ink-400">Propuesta ilustrativa. Pago definitivo sujeto a jornada remunerable y revisión en nómina.</p>
    </div>
  );
};
