import clsx from "clsx";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { MonthSelector } from "../../components/finanzas/MonthSelector";
import { Alert } from "../../components/ui/Alert";
import { PageLoader } from "../../components/ui/PageLoader";
import { Spinner } from "../../components/ui/Spinner";
import { CameraIcon, CloseIcon, DownloadIcon } from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { useLanguage, useT } from "../../i18n/index.jsx";
import { parseApiError } from "../../lib/api";
import { exportClienteServiciosRequest, getClienteFotosRequest, getClienteServiciosRequest } from "../../lib/cliente.api";
import { buildFullCsv, downloadCsv } from "../../lib/csv";
import { currentMonth } from "../../lib/finanzas";
import { horaRoma, minutosTexto } from "../../lib/seguimiento";

const ESTADO_PILL = {
  CONSEGNATO: "bg-success-500/15 text-success-500",
  IN_CONSEGNA: "bg-accent-500/15 text-accent-300",
  RITIRATO: "bg-accent-500/15 text-accent-300",
  IN_SOSPESO: "bg-line/15 text-ink-300",
  RISCHEDULATO: "bg-warning-500/15 text-warning-500",
  ANNULLATO: "bg-danger-500/15 text-danger-500",
};

const fechaCorta = (iso) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Rome" });

// Llego a tiempo (hasta 5 min de margen) o con cuantos minutos de retraso.
const puntualidad = (min, t) => (min == null ? "—" : min <= 5 ? t("track.onTime") : `+${minutosTexto(min)}`);

// El estado en el idioma de la persona: en italiano, el nombre del propio estado; en espanol, el que manda el servidor.
const estadoTexto = (s, t, language) => (language === "it" && ESTADO_PILL[s.estado] ? t(`state.${s.estado}`) : s.estadoLabel);

const FotosModal = ({ servicio, onClose }) => {
  const t = useT();
  const [fotos, setFotos] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getClienteFotosRequest(servicio.id)
      .then((list) => !cancelled && setFotos(list))
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
            <h2 className="text-[17px] font-semibold text-ink-50">{t("hist.photosOf", { code: servicio.codigo })}</h2>
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
                <span className="flex h-40 items-center justify-center bg-line/10 text-[14px] font-medium text-ink-100">{t("hist.openPdf")}</span>
              ) : (
                <img src={f.url} alt={f.tipo} className="h-40 w-full object-cover" loading="lazy" />
              )}
              <span className="block px-3 py-2 text-[13px] text-ink-300">{f.tipo}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ClienteHistorialPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const { user } = useAuth();
  const modulos = user?.clienteModulos ?? [];
  const verFotos = modulos.includes("FOTOS");
  const verExcel = modulos.includes("EXCEL");

  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [fotosDe, setFotosDe] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!modulos.includes("HISTORIAL")) return undefined;
    let cancelled = false;
    setData(null);
    getClienteServiciosRequest(month)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  if (!modulos.includes("HISTORIAL")) return <Navigate to="/cliente" replace />;

  const exportar = async () => {
    setExporting(true);
    setError("");
    try {
      const { servicios } = await exportClienteServiciosRequest(month);
      const columnas = ["hist.code", "hist.date", "hist.plate", "hist.destination", "hist.status", "hist.plannedTime", "hist.arrival", "hist.punctuality"].map((key) => t(key));
      const filas = servicios.map((s) => [
        s.codigo,
        fechaCorta(s.fecha),
        s.targa ?? "",
        s.destino,
        estadoTexto(s, t, language),
        horaRoma(s.etaPlan),
        s.llegoAt ? horaRoma(s.llegoAt) : "",
        s.puntualidadMin ?? "",
      ]);
      downloadCsv(`Servicios_${month}.csv`, buildFullCsv({ columnas, filas }));
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">{t("hist.title")}</h1>
          <p className="mt-1 text-[14px] text-ink-300">{t("hist.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthSelector month={month} onChange={setMonth} />
          {verExcel && (
            <button
              type="button"
              onClick={exportar}
              disabled={exporting || !data?.servicios.length}
              className="glass-surface-sm inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium text-ink-50 transition-colors hover:bg-line/10 disabled:opacity-50"
            >
              {exporting ? <Spinner className="h-4 w-4" /> : <DownloadIcon className="h-4 w-4" />}
              {t("hist.download")}
            </button>
          )}
        </div>
      </div>

      <Alert>{error}</Alert>
      {!data && !error && <PageLoader />}
      {data?.servicios.length === 0 && <p className="px-1 py-6 text-[14px] text-ink-400">{t("hist.none")}</p>}

      {data?.servicios.length > 0 && (
        <div className="glass-surface overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line/10 text-left text-[11px] font-medium uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2.5">{t("hist.date")}</th>
                <th className="px-2 py-2.5">{t("hist.service")}</th>
                <th className="px-2 py-2.5">{t("hist.plate")}</th>
                <th className="px-2 py-2.5">{t("hist.destination")}</th>
                <th className="px-2 py-2.5">{t("hist.status")}</th>
                <th className="px-2 py-2.5">{t("hist.arrival")}</th>
                {verFotos && <th className="px-2 py-2.5 text-center">{t("hist.photos")}</th>}
              </tr>
            </thead>
            <tbody>
              {data.servicios.map((s) => (
                <tr key={s.id} className="border-b border-line/[0.07] last:border-b-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-100">{fechaCorta(s.fecha)}</td>
                  <td className="px-2 py-2.5 text-ink-300">{s.codigo}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 font-semibold text-ink-50">{s.targa ?? "—"}</td>
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
                          onClick={() => setFotosDe(s)}
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
      )}

      {fotosDe && <FotosModal servicio={fotosDe} onClose={() => setFotosDe(null)} />}
    </div>
  );
};
