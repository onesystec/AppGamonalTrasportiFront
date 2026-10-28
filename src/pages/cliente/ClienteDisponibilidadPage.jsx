import clsx from "clsx";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { PageLoader } from "../../components/ui/PageLoader";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../i18n/index.jsx";
import { parseApiError } from "../../lib/api";
import { getClienteDisponibilidadRequest } from "../../lib/cliente.api";
import { diaCorto, diaSemana, esFinDeSemana, sumarDias } from "../../lib/disponibilidad";

const RANGOS = [7, 14, 30];
const todayRome = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });

// Disponibilitá del usuario cliente: que choferes (por nombre) y que vehiculos (por targa) estan libres u ocupados cada dia, y cuantos choferes hay
// libres. Sin motivos y sin servicios de nadie: solo "libre" o "no disponible".

// Una fila de la tabla: el nombre (o la targa) y una celda por dia, verde si esta libre y roja si no esta disponible.
const Fila = ({ nombre, ocupados, dias, locale, t, mono = false }) => {
  const set = new Set(ocupados);
  return (
    <tr>
      <th scope="row" className={clsx("sticky left-0 z-10 max-w-[170px] truncate bg-background py-1 pl-1 pr-3 text-left text-[13px] font-medium text-ink-50", mono && "tracking-wide")}>
        {nombre}
      </th>
      {dias.map((day) => (
        <td key={day} className="p-0.5">
          <span
            title={`${diaCorto(day, locale)} - ${set.has(day) ? t("disp.client.busy") : t("disp.cellFree")}`}
            className={clsx("block h-8 w-full min-w-[26px] rounded-md", set.has(day) ? "bg-danger-500/30" : "bg-success-500/20")}
          />
        </td>
      ))}
    </tr>
  );
};

const Separador = ({ texto, columnas }) => (
  <tr>
    <td colSpan={columnas} className="px-1 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
      {texto}
    </td>
  </tr>
);
export const ClienteDisponibilidadPage = () => {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const [rango, setRango] = useState(14);
  const [desde, setDesde] = useState(todayRome);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  const hasta = sumarDias(desde, rango - 1);
  useEffect(() => {
    let cancelled = false;
    setError("");
    getClienteDisponibilidadRequest({ desde, hasta })
      .then((result) => !cancelled && setData(result))
      .catch((err) => !cancelled && setError(parseApiError(err).message));
    return () => {
      cancelled = true;
    };
  }, [desde, hasta]);

  if (!user?.clienteModulos?.includes("DISPONIBILIDAD")) return <Navigate to="/cliente" replace />;

  const hoy = data?.hoy ?? todayRome();
  const filtro = q.trim().toLowerCase();
  const vehiculos = (data?.vehiculos ?? []).filter((v) => !filtro || v.targa.toLowerCase().includes(filtro));
  const choferes = (data?.choferes.lista ?? []).filter((c) => !filtro || c.nombre.toLowerCase().includes(filtro));
  const mover = (n) => setDesde((d) => sumarDias(d, n * rango));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-50">{t("disp.title")}</h1>
        <p className="mt-1 max-w-xl text-[13px] text-ink-300">{t("disp.client.subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-label={t("disp.prev")} onClick={() => mover(-1)} className="flex h-9 w-9 items-center justify-center rounded-lg glass-surface-sm text-ink-300 hover:text-ink-50">
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <span className="min-w-[170px] text-center text-[14px] font-medium text-ink-50">
            {diaCorto(desde, locale)} - {diaCorto(hasta, locale)}
          </span>
          <button type="button" aria-label={t("disp.next")} onClick={() => mover(1)} className="flex h-9 w-9 items-center justify-center rounded-lg glass-surface-sm text-ink-300 hover:text-ink-50">
            <ChevronRightIcon className="h-4 w-4" />
          </button>
          <Button variant="ghost" className="sm:w-auto sm:px-3" onClick={() => setDesde(todayRome())}>
            {t("disp.today")}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl options={RANGOS.map((n) => ({ value: n, label: t("disp.range", { n }) }))} value={rango} onChange={setRango} />
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("disp.client.search")}
              aria-label={t("disp.search")}
              className="glass-input w-[210px] rounded-lg py-2 pl-9 pr-3 text-[13px] text-ink-50"
            />
          </div>
        </div>
      </div>

      <Alert>{error}</Alert>
      {!data && !error && <PageLoader />}

      {data && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-300">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-success-500/20" />
              {t("disp.estado.LIBRE")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-danger-500/30" />
              {t("disp.client.busy")}
            </span>
          </div>

          <div className="glass-surface overflow-x-auto rounded-2xl p-3">
            <table className="border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-background" />
                  {data.dias.map((day) => (
                    <th key={day} className="p-0.5">
                      <span
                        className={clsx(
                          "flex w-full min-w-[26px] flex-col items-center rounded-md px-0.5 py-1 text-[10.5px] font-medium leading-tight",
                          day === hoy ? "bg-accent-500/25 text-accent-300" : esFinDeSemana(day) ? "text-ink-400" : "text-ink-300"
                        )}
                      >
                        <span>{diaSemana(day, locale)}</span>
                        <span className="text-[13px] font-semibold text-ink-50">{Number(day.slice(8, 10))}</span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" className="sticky left-0 z-10 max-w-[170px] bg-background py-1.5 pl-1 pr-3 text-left text-[12px] font-semibold text-ink-50">
                    {t("disp.client.driversFree", { n: data.choferes.total })}
                  </th>
                  {data.dias.map((day) => {
                    const libres = data.choferes.libres[day] ?? 0;
                    return (
                      <td key={day} className="p-0.5">
                        <span
                          className={clsx(
                            "flex h-8 w-full min-w-[26px] items-center justify-center rounded-md text-[12px] font-semibold",
                            libres > 0 ? "bg-success-500/20 text-success-500" : "bg-danger-500/30 text-danger-500"
                          )}
                        >
                          {libres}
                        </span>
                      </td>
                    );
                  })}
                </tr>
                {choferes.length > 0 && <Separador texto={t("disp.view.choferes")} columnas={data.dias.length + 1} />}
                {choferes.map((c) => (
                  <Fila key={c.nombre} nombre={c.nombre} ocupados={c.ocupados} dias={data.dias} locale={locale} t={t} />
                ))}
                {vehiculos.length > 0 && <Separador texto={t("disp.view.vehiculos")} columnas={data.dias.length + 1} />}
                {vehiculos.map((v) => (
                  <Fila key={v.targa} nombre={v.targa} ocupados={v.ocupados} dias={data.dias} locale={locale} t={t} mono />
                ))}
              </tbody>
            </table>
            {choferes.length === 0 && vehiculos.length === 0 && (
              <p className="px-2 py-6 text-center text-[13px] text-ink-400">{data.vehiculos.length === 0 && data.choferes.lista.length === 0 ? t("disp.client.noVehicles") : t("disp.noResults")}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
