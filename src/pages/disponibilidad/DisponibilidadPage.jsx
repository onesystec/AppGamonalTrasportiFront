import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { PageLoader } from "../../components/ui/PageLoader";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "../../components/ui/icons";
import { parseApiError } from "../../lib/api";
import { getDisponibilidadRequest } from "../../lib/disponibilidad.api";
import {
  diaCorto,
  diaSemana,
  ESTADOS,
  esFinDeSemana,
  estadoDelDia,
  estadoLabel,
  estadoLetra,
  itemTexto,
  LEYENDA_CHOFERES,
  LEYENDA_VEHICULOS,
  sumarDias,
} from "../../lib/disponibilidad";
import { useLanguage } from "../../i18n/index.jsx";

const RANGOS = [7, 14, 30];

const todayRome = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });

const Leyenda = ({ claves }) => {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-300">
      {claves.map((key) => (
        <span key={key} className="flex items-center gap-1.5">
          <span className={clsx("h-3 w-3 rounded", ESTADOS[key].cell.split(" ")[0])} />
          {estadoLabel(t, key)}
          {estadoLetra(t, key) && <span className="text-ink-400">({estadoLetra(t, key)})</span>}
        </span>
      ))}
    </div>
  );
};

// Una fila de la matriz: un chofer o un vehiculo, una celda por dia.
const Fila = ({ entry, dias, seleccionado, onSelect }) => {
  const { t, locale } = useLanguage();
  return (
  <tr>
    <th scope="row" className="sticky left-0 z-10 max-w-[150px] truncate bg-background py-1 pl-1 pr-3 text-left text-[13px] font-medium text-ink-50">
      {entry.nombre}
      {entry.modelo && <span className="ml-1.5 text-[11px] font-normal text-ink-400">{entry.modelo}</span>}
    </th>
    {dias.map((day) => {
      const est = estadoDelDia(entry.dias[day]);
      const info = ESTADOS[est.key];
      const servicios = (entry.dias[day] ?? []).filter((i) => i.tipo === "SERVICIO").length;
      return (
        <td key={day} className="p-0.5">
          <button
            type="button"
            onClick={() => onSelect(day)}
            title={est.items.length ? `${diaCorto(day, locale)} - ${est.items.map((i) => itemTexto(t, i)).join("; ")}` : `${diaCorto(day, locale)} - ${t("disp.cellFree")}`}
            className={clsx(
              "flex h-8 w-full min-w-[26px] items-center justify-center rounded-md text-[11px] font-semibold transition-opacity hover:opacity-80",
              info.cell,
              est.pendiente && "border border-dashed border-warning-500",
              est.choque && "ring-1 ring-accent-400",
              day === seleccionado && "brightness-125"
            )}
          >
            {est.key === "SERVICIO" && servicios > 1 ? servicios : estadoLetra(t, est.key)}
          </button>
        </td>
      );
    })}
  </tr>
  );
};

// Los libres y los no disponibles de un dia, escritos (para elegir chofer y vehiculo al asignar un servicio).
const Lista = ({ titulo, entries, day }) => {
  const { t } = useLanguage();
  const libres = [];
  const ocupados = [];
  for (const entry of entries) {
    const est = estadoDelDia(entry.dias[day]);
    (est.key === "LIBRE" || (est.pendiente && est.items.every((i) => i.pendiente)) ? libres : ocupados).push({ entry, est });
  }
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[13px] font-semibold text-ink-50">{titulo}</p>
      <p className="mb-1 text-[12px] text-ink-300">{t("disp.free", { n: libres.length })}</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {libres.length === 0 && <span className="text-[12px] text-ink-400">{t("disp.none")}</span>}
        {libres.map(({ entry, est }) => (
          <span key={entry.id} className={clsx("rounded-full px-2.5 py-1 text-[12px]", ESTADOS.LIBRE.chip, est.pendiente && "border border-dashed border-warning-500")} title={est.items.map((i) => itemTexto(t, i)).join("; ")}>
            {entry.nombre}
            {est.pendiente && ` - ${t("disp.pendingTag")}`}
          </span>
        ))}
      </div>
      <p className="mb-1 text-[12px] text-ink-300">{t("disp.busy", { n: ocupados.length })}</p>
      <ul className="flex flex-col gap-1">
        {ocupados.length === 0 && <li className="text-[12px] text-ink-400">{t("disp.none")}</li>}
        {ocupados.map(({ entry, est }) => (
          <li key={entry.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
            <span className={clsx("rounded-full px-2.5 py-1", ESTADOS[est.key].chip)}>{entry.nombre}</span>
            <span className="text-ink-300">{est.items.map((i) => itemTexto(t, i)).join(" - ")}</span>
            {est.choque && <span className="font-medium text-warning-500">{t("disp.conflict")}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

export const DisponibilidadPage = () => {
  const { t, locale } = useLanguage();
  const VISTAS = [
    { value: "choferes", label: t("disp.view.choferes") },
    { value: "vehiculos", label: t("disp.view.vehiculos") },
  ];
  const [vista, setVista] = useState("choferes");
  const [rango, setRango] = useState(14);
  const [desde, setDesde] = useState(todayRome);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [dia, setDia] = useState(todayRome);
  const [q, setQ] = useState("");

  const hasta = sumarDias(desde, rango - 1);
  useEffect(() => {
    let cancelled = false;
    setError("");
    getDisponibilidadRequest({ desde, hasta })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [desde, hasta]);

  // El dia que se mira siempre cae dentro del rango mostrado.
  const diaActivo = data && data.dias.includes(dia) ? dia : data?.dias[0];
  const hoy = data?.hoy ?? todayRome();

  const filtro = q.trim().toLowerCase();
  const entries = useMemo(() => {
    const all = vista === "choferes" ? data?.choferes : data?.vehiculos;
    return (all ?? []).filter((e) => !filtro || `${e.nombre} ${e.modelo ?? ""}`.toLowerCase().includes(filtro));
  }, [data, vista, filtro]);

  const mover = (n) => setDesde((d) => sumarDias(d, n * rango));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink-50">{t("disp.title")}</h1>
          <p className="mt-1 max-w-xl text-[14px] text-ink-300">{t("disp.subtitle")}</p>
        </div>
        <SegmentedControl options={VISTAS} value={vista} onChange={setVista} />
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
          <Button variant="ghost" className="sm:w-auto sm:px-3" onClick={() => { setDesde(todayRome()); setDia(todayRome()); }}>
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
              placeholder={vista === "choferes" ? t("disp.searchChofer") : t("disp.searchVehiculo")}
              aria-label={t("disp.search")}
              className="glass-input w-[190px] rounded-lg py-2 pl-9 pr-3 text-[13px] text-ink-50"
            />
          </div>
        </div>
      </div>

      <Alert>{error}</Alert>
      {!data && !error && <PageLoader />}

      {data && (
        <>
          <Leyenda claves={vista === "choferes" ? LEYENDA_CHOFERES : LEYENDA_VEHICULOS} />

          {/* Computadora: matriz con un renglon por chofer o vehiculo. Un recuadro punteado es un permiso todavia sin aprobar. */}
          <div className="glass-surface hidden overflow-x-auto rounded-2xl p-3 sm:block">
            <table className="border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-background" />
                  {data.dias.map((day) => (
                    <th key={day} className="p-0.5">
                      <button
                        type="button"
                        onClick={() => setDia(day)}
                        className={clsx(
                          "flex w-full min-w-[26px] flex-col items-center rounded-md px-0.5 py-1 text-[10.5px] font-medium leading-tight",
                          day === hoy ? "bg-accent-500/25 text-accent-300" : esFinDeSemana(day) ? "text-ink-400" : "text-ink-300",
                          day === diaActivo && "outline outline-2 outline-offset-1 outline-ink-50"
                        )}
                      >
                        <span>{diaSemana(day, locale)}</span>
                        <span className="text-[13px] font-semibold text-ink-50">{Number(day.slice(8, 10))}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <Fila key={entry.id} entry={entry} dias={data.dias} seleccionado={diaActivo} onSelect={setDia} />
                ))}
              </tbody>
            </table>
            {entries.length === 0 && <p className="px-2 py-6 text-center text-[13px] text-ink-400">{t("disp.noResults")}</p>}
          </div>

          {/* Celular: una tarjeta por dia con los libres y los no disponibles escritos. */}
          <div className="flex flex-col gap-3 sm:hidden">
            {data.dias.map((day) => (
              <section key={day} className={clsx("glass-surface rounded-2xl p-3.5", day === hoy && "ring-2 ring-accent-400")}>
                <p className="mb-2 text-[14px] font-semibold text-ink-50">
                  {diaCorto(day, locale)}
                  {day === hoy && <span className="ml-2 text-[12px] font-medium text-accent-300">{t("disp.todayTag")}</span>}
                </p>
                <Lista titulo={vista === "choferes" ? t("disp.view.choferes") : t("disp.view.vehiculos")} entries={entries} day={day} />
              </section>
            ))}
          </div>

          {/* Detalle del dia elegido: choferes y vehiculos libres a la vez, para asignar un servicio. */}
          {diaActivo && (
            <section className="glass-surface hidden rounded-2xl p-4 sm:block">
              <p className="mb-3 text-[15px] font-semibold text-ink-50">
                {diaCorto(diaActivo, locale)}
                {diaActivo === hoy && <span className="ml-2 text-[12px] font-medium text-accent-300">{t("disp.todayTag")}</span>}
              </p>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Lista titulo={t("disp.view.choferes")} entries={data.choferes.filter((e) => !filtro || vista !== "choferes" || e.nombre.toLowerCase().includes(filtro))} day={diaActivo} />
                <Lista titulo={t("disp.view.vehiculos")} entries={data.vehiculos.filter((e) => !filtro || vista !== "vehiculos" || `${e.nombre} ${e.modelo ?? ""}`.toLowerCase().includes(filtro))} day={diaActivo} />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};
