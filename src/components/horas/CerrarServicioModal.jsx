import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { CameraPickButton } from "../ui/CameraPickButton";
import { CheckCircleIcon, PaperclipIcon } from "../ui/icons";
import { TextField } from "../ui/TextField";
import { Textarea } from "../ui/Textarea";
import { parseApiError } from "../../lib/api";
import { cierreServicioRequest } from "../../lib/horas.api";
import { listRecordFilesRequest, updateDeclaracionesRequest, uploadRecordFileRequest } from "../../lib/records.api";
import { ViajeStops } from "../chofer/ViajeStops";
import { FaltantesSwitches } from "../records/FaltantesPanel";

const MIN_CHIPS = [0, 15, 30, 45, 60];

const MinutesField = ({ id, label, hint, value, onChange }) => (
  <div>
    <TextField
      id={id}
      label={label}
      type="number"
      inputMode="numeric"
      min="0"
      step="5"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
    <div className="mt-2 flex flex-wrap gap-1.5">
      {MIN_CHIPS.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(String(m))}
          className={
            Number(value) === m
              ? "rounded-full bg-accent-500/20 px-2.5 py-1 text-[12px] font-medium text-accent-400"
              : "rounded-full glass-surface-sm px-2.5 py-1 text-[12px] text-ink-300 hover:bg-line/10"
          }
        >
          {m === 0 ? "Ninguna" : `${m} min`}
        </button>
      ))}
    </div>
    {hint && <p className="mt-1.5 text-[12px] text-ink-400">{hint}</p>}
  </div>
);

// Cierre de un servicio por el chofer. Ya no declara horas: las horas de manejo salen de los km del sistema (km / 85). Solo:
// la espera del servicio, la foto de la bolla de trabajo (opcional por ahora; puede ser mas de una) y las declaraciones de
// peajes y carburante (con sus fotos de mancato pagamento y de carburante). Al enviar, el servicio queda entregado.
export const CerrarServicioModal = ({ record, onClose, onDone }) => {
  const [esperaMin, setEsperaMin] = useState(String(record.jornada?.esperaMin ?? 0));
  const [comentarios, setComentarios] = useState(record.comentarios ?? "");
  const [bollas, setBollas] = useState([]);
  const [bollasGuardadas, setBollasGuardadas] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  // Lo que el chofer declara sobre peajes y carburante de este servicio.
  const [declared, setDeclared] = useState(() => ({
    sinPeajeIda: Boolean(record.faltantes?.declarado?.sinPeajeIda),
    sinPeajeVuelta: Boolean(record.faltantes?.declarado?.sinPeajeVuelta),
    sinCombustible: Boolean(record.faltantes?.declarado?.sinCombustible),
  }));
  const viaje = record.compactado?.principal ? record.compactado : null;

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saving, onClose]);

  // Bollas que ya se subieron antes (por ejemplo desde otra sesion).
  useEffect(() => {
    let cancelled = false;
    listRecordFilesRequest(record.id)
      .then((files) => {
        if (!cancelled) setBollasGuardadas(files.filter((f) => f.tipoArchivo === "BOLLA").length);
      })
      .catch(() => {
        if (!cancelled) setBollasGuardadas(0);
      });
    return () => {
      cancelled = true;
    };
  }, [record.id]);

  const totalBollas = (bollasGuardadas ?? 0) + bollas.length;

  const addBollas = (e) => {
    const picked = [...(e.target.files ?? [])];
    e.target.value = "";
    if (picked.length) setBollas((prev) => [...prev, ...picked]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await cierreServicioRequest(record.id, {
        esperaMin: Number(esperaMin) || 0,
        ...(comentarios.trim() ? { comentarios: comentarios.trim() } : {}),
      });
      // Las fotos de la bolla, una por una; las que se suban bien no se vuelven a mandar si algo falla despues.
      let remaining = bollas;
      while (remaining.length > 0) {
        await uploadRecordFileRequest(record.id, remaining[0], "BOLLA");
        remaining = remaining.slice(1);
        setBollas(remaining);
        setBollasGuardadas((n) => (n ?? 0) + 1);
      }
      // Declaraciones de peajes y carburante, si el chofer las cambio.
      const changed = Object.fromEntries(
        Object.entries(declared).filter(([field, value]) => value !== Boolean(record.faltantes?.declarado?.[field]))
      );
      if (Object.keys(changed).length > 0) await updateDeclaracionesRequest(record.id, changed).catch(() => {});
      setSent(true);
      onDone?.();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => !saving && onClose()}
        className="absolute inset-0 bg-backdrop backdrop-blur-sm"
      />

      <div className="glass-surface relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background p-5 sm:rounded-3xl sm:p-6">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircleIcon className="h-12 w-12 text-success-500" />
            <h2 className="text-[19px] font-semibold text-ink-50">Servicio terminado</h2>
            <p className="text-[14px] text-ink-300">
              Tu espera quedó registrada.
            </p>
            <div className="mt-2 w-full rounded-2xl bg-warning-500/10 px-4 py-3 text-left">
              <p className="text-[14px] font-medium text-ink-50">¿Pasaste por algun peaje sin pagar?</p>
              <p className="mt-0.5 text-[13px] text-ink-300">Sube el aviso de mancato pagamento ahora para no olvidarte.</p>
              <Link
                to="/finanzas/mancato/new"
                className="mt-2 inline-block text-[13px] font-semibold text-accent-400 hover:text-accent-300"
              >
                Subir mancato pagamento &rarr;
              </Link>
            </div>
            <Button className="mt-2" onClick={onClose}>
              Listo
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <h2 className="text-[19px] font-semibold text-ink-50">{viaje ? "Terminar viaje" : "Terminar servicio"}</h2>
              <p className="mt-0.5 text-[13px] text-ink-300">
                {record.codigo} &middot; {record.destinazione}
              </p>
            </div>

            {viaje && (
              <div className="rounded-xl bg-accent-500/10 px-4 py-3">
                <p className="mb-2 text-[13px] text-ink-200">
                  <b className="text-accent-300">Viaje compacto de {viaje.total} servicios.</b> Al enviar, todos los
                  servicios del viaje quedan entregados. La espera y la bolla son las de todo el viaje.
                </p>
                <ViajeStops compactado={viaje} />
              </div>
            )}

            <Alert>{error}</Alert>

            <MinutesField
              id="cierre-espera"
              label="Espera (minutos)"
              hint="Tiempo que esperaste al cliente en este servicio. Se paga aparte."
              value={esperaMin}
              onChange={setEsperaMin}
            />

            <div className="rounded-2xl border border-line/10 bg-line/[0.03] p-4">
              <h3 className="text-[14px] font-semibold text-ink-50">Foto de la bolla de trabajo</h3>
              <p className="mt-0.5 text-[12px] text-ink-400">
                Súbela si la tienes. Puedes subir más de una foto (si la bolla tiene varias hojas, o hay más de una bolla).
              </p>
              <p className="mt-2 text-[13px] text-ink-200">
                {bollasGuardadas === null
                  ? "Revisando las que ya subiste..."
                  : totalBollas === 0
                    ? "Todavía no hay ninguna foto."
                    : `${totalBollas} ${totalBollas === 1 ? "foto" : "fotos"} de bolla${bollasGuardadas > 0 ? ` (${bollasGuardadas} ya ${bollasGuardadas === 1 ? "subida" : "subidas"})` : ""}.`}
              </p>
              {bollas.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {bollas.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 text-[13px] text-ink-100">
                      <span className="min-w-0 truncate">{file.name}</span>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setBollas((prev) => prev.filter((_, i) => i !== index))}
                        className="shrink-0 text-[12px] font-medium text-danger-500 hover:brightness-110"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <CameraPickButton
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line/20 px-4 py-2 text-[13px] font-medium text-ink-50 transition hover:bg-line/10"
                  label={totalBollas > 0 ? "Tomar otra foto" : "Tomar foto"}
                  onChange={addBollas}
                  disabled={saving}
                />
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line/20 px-4 py-2 text-[13px] font-medium text-ink-50 transition hover:bg-line/10">
                  <PaperclipIcon className="h-4 w-4" />
                  {totalBollas > 0 ? "Elegir otro archivo" : "Elegir foto o archivo"}
                  <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={addBollas} disabled={saving} />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-line/10 bg-line/[0.03] p-4">
              <h3 className="mb-3 text-[14px] font-semibold text-ink-50">Peajes y carburante</h3>
              <FaltantesSwitches
                record={{ ...record, faltantes: { ...record.faltantes, litrosEstimados: record.faltantes?.litrosEstimados } }}
                values={declared}
                onToggle={(field, value) => setDeclared((prev) => ({ ...prev, [field]: value }))}
                onAll={(fields) => setDeclared((prev) => ({ ...prev, ...Object.fromEntries(fields.map((f) => [f, true])) }))}
                disabled={saving}
              />
            </div>

            <Textarea
              id="cierre-comentarios"
              label="Comentarios (opcional)"
              rows={2}
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
            />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="ghost" className="sm:w-auto sm:px-6" disabled={saving} onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" className="sm:w-auto sm:px-6" loading={saving}>
                Terminar servicio
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
