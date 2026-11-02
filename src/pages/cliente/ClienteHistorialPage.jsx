import clsx from "clsx";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { MonthSelector } from "../../components/finanzas/MonthSelector";
import { Alert } from "../../components/ui/Alert";
import { estadoTexto, esDhlMilano, FotosModal, TablaServicios, aplicativoTexto, fechaCorta } from "../../components/cliente/TablaServicios";
import { HojaMixta } from "../../components/solicitudes/HojaDhlMilano";
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
      const columnas = ["hist.code", "hist.date", "hist.plate", "hist.driver", "hist.circuit", "hist.destination", "hist.status", "hist.plannedTime", "hist.arrival", "hist.punctuality"].map((key) => t(key));
      const filas = servicios.map((s) => [
        s.codigo,
        fechaCorta(s.fecha),
        s.targa ?? "",
        s.chofer ?? "",
        aplicativoTexto(s.aplicativo),
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

  // DHL Milano en la hoja tipo Excel; el resto de servicios, en la tabla de siempre.
  const milano = (data?.servicios ?? []).filter(esDhlMilano);
  const otros = (data?.servicios ?? []).filter((s) => !esDhlMilano(s));

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
        <>
          {/* Celular: la tabla de siempre con todo. */}
          <div className="lg:hidden">
            <TablaServicios servicios={data.servicios} verFotos={verFotos} onFotos={setFotosDe} />
          </div>
          {/* Escritorio: DHL Milano en la hoja tipo Excel y, aparte, los demas servicios en la tabla de siempre. */}
          <div className="hidden flex-col gap-5 lg:flex">
            {milano.length > 0 && (
              <HojaMixta servicios={milano} verFotos={verFotos} estadoTexto={(r) => estadoTexto(r, t, language)} vacio="Nessun servizio per questo mese." />
            )}
            {otros.length > 0 && (
              <div className="flex flex-col gap-2">
                {milano.length > 0 && <h2 className="text-[14px] font-semibold text-ink-100">Altri servizi</h2>}
                <TablaServicios servicios={otros} verFotos={verFotos} onFotos={setFotosDe} />
              </div>
            )}
          </div>
        </>
      )}

      {fotosDe && <FotosModal servicio={fotosDe} onClose={() => setFotosDe(null)} />}
    </div>
  );
};
