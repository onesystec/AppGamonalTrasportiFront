import clsx from "clsx";
import { useEffect, useState } from "react";
import { Alert } from "../ui/Alert";
import { Spinner } from "../ui/Spinner";
import { CameraIcon, CloseIcon } from "../ui/icons";
import { useLanguage, useT } from "../../i18n/index.jsx";
import { parseApiError } from "../../lib/api";
import { getClienteFotosRequest } from "../../lib/cliente.api";
import { horaRoma, minutosTexto } from "../../lib/seguimiento";

// Piezas del historial de servicios del cliente que usan tanto el Historial como el Registro unificado: la tabla de siempre, el visor de fotos
// y los estados.
export const ESTADO_PILL = {
  CONSEGNATO: "bg-success-500/15 text-success-500",
  IN_CONSEGNA: "bg-accent-500/15 text-accent-300",
  RITIRATO: "bg-accent-500/15 text-accent-300",
  IN_SOSPESO: "bg-line/15 text-ink-300",
  RISCHEDULATO: "bg-warning-500/15 text-warning-500",
  ANNULLATO: "bg-danger-500/15 text-danger-500",
};

// "MILANO_12" -> "Milano 12"; "ROMA_2" -> "Roma 2".
export const aplicativoTexto = (value) => (value ? value.charAt(0) + value.slice(1).toLowerCase().replace("_", " ") : "");

export const fechaCorta = (iso) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Rome" });

// Llego a tiempo (hasta 5 min de margen) o con cuantos minutos de retraso.
export const puntualidad = (min, t) => (min == null ? "—" : min <= 5 ? t("track.onTime") : `+${minutosTexto(min)}`);

// El estado en el idioma de la persona: en italiano, el nombre del propio estado; en espanol, el que manda el servidor.
export const estadoTexto = (s, t, language) => (language === "it" && ESTADO_PILL[s.estado] ? t(`state.${s.estado}`) : s.estadoLabel);

export const FotosModal = ({ servicio, onClose }) => {
  const t = useT();
  const [fotos, setFotos] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getClienteFotosRequest(servicio.id)
      .then((list) => !cancelled && setFotos(servicio.tipo ? list.filter((f) => f.codigo === servicio.tipo) : list))
      .catch((err) => !cancelled && setError(parseApiError(err).message));
    return () => {
      cancelled = true;
    };
  }, [servicio.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t("hist.photosOf", { code: servicio.codigo })}>
      <button type="button" aria-label={t("common.close")} className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-popover p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold text-ink-50">
              {t("hist.photosOf", { code: servicio.codigo })}
              {servicio.tipo && ` · ${t(servicio.tipo === "BOLLA" ? "reg.photoPickup" : "reg.photoDelivery")}`}
            </h2>
            <p className="text-[13px] text-ink-300">{servicio.destino}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="rounded-lg p-1.5 text-ink-300 hover:bg-line/10 hover:text-ink-50">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <Alert>{error}</Alert>
        {!fotos && !error && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}
        {fotos?.length === 0 && <p className="py-6 text-center text-[14px] text-ink-300">{t("hist.noPhotos")}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fotos?.map((f) => (
            <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-line/10 hover:border-line/30">
              {f.esPdf ? (
                <span className="flex h-72 items-center justify-center bg-line/10 text-[14px] font-medium text-ink-100">{t("hist.openPdf")}</span>
              ) : (
                <img src={f.url} alt={f.tipo} className="h-72 w-full bg-black/20 object-contain" loading="lazy" />
              )}
              <span className="block px-3 py-2 text-[13px] text-ink-300">{f.tipo}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

// La tabla de siempre del historial (todos los servicios; en el celular y para lo que no es DHL Milano).
export const TablaServicios = ({ servicios, verFotos, onFotos }) => {
  const t = useT();
  const { language } = useLanguage();
  return (
      <div className="glass-surface overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[760px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line/10 text-left text-[11px] font-medium uppercase tracking-wide text-ink-400">
              <th className="px-4 py-2.5">{t("hist.date")}</th>
              <th className="px-2 py-2.5">{t("hist.service")}</th>
              <th className="px-2 py-2.5">{t("hist.plate")}</th>
              <th className="px-2 py-2.5">{t("hist.driverCircuit")}</th>
              <th className="px-2 py-2.5">{t("hist.destination")}</th>
              <th className="px-2 py-2.5">{t("hist.status")}</th>
              <th className="px-2 py-2.5">{t("hist.arrival")}</th>
              {verFotos && <th className="px-2 py-2.5 text-center">{t("hist.photos")}</th>}
            </tr>
          </thead>
          <tbody>
            {servicios.map((s) => (
              <tr key={s.id} className="border-b border-line/[0.07] last:border-b-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-ink-100">{fechaCorta(s.fecha)}</td>
                <td className="px-2 py-2.5 text-ink-300">{s.codigo}</td>
                <td className="whitespace-nowrap px-2 py-2.5 font-semibold text-ink-50">{s.targa ?? "—"}</td>
                <td className="whitespace-nowrap px-2 py-2.5">
                  <span className="block text-ink-100">{s.chofer ?? "—"}</span>
                  {s.aplicativo && <span className="block text-[12px] text-ink-400">{aplicativoTexto(s.aplicativo)}</span>}
                </td>
                <td className="max-w-[280px] px-2 py-2.5 text-ink-100">{s.destino}</td>
                <td className="px-2 py-2.5">
                  <span className={clsx("whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium", ESTADO_PILL[s.estado] ?? "bg-line/15 text-ink-300")}>
                    {estadoTexto(s, t, language)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 text-ink-300">
                  {s.llegoAt ? (
                    <>
                      {horaRoma(s.llegoAt)} <span className="text-ink-400">· {puntualidad(s.puntualidadMin, t)}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                {verFotos && (
                  <td className="px-2 py-2.5 text-center">
                    {s.fotos > 0 ? (
                      <button
                        type="button"
                        onClick={() => onFotos(s)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium text-accent-400 hover:bg-line/10"
                      >
                        <CameraIcon className="h-4 w-4" />
                        {s.fotos}
                      </button>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

  );
};

// DHL Milano: lo que se ve en la hoja tipo Excel (los demas servicios siguen en la tabla de siempre).
export const esDhlMilano = (s) => s.spedizzione === "DHL" && s.zona !== "ROMA";

export const PUNTO_ESTADO = {
  CONSEGNATO: "bg-success-500",
  ANNULLATO: "bg-danger-500",
  RISCHEDULATO: "bg-warning-500",
};
