import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { PageLoader } from "../../components/ui/PageLoader";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { DownloadIcon, SearchIcon } from "../../components/ui/icons";
import { parseApiError } from "../../lib/api";
import { GRUPO_LABELS, TIPO_DOCUMENTO_LABELS } from "../../lib/constants";
import { downloadCsv } from "../../lib/csv";
import { getVencimientosRequest } from "../../lib/vencimientos.api";

const ESTADOS = [
  { key: "VENCIDO", label: "Vencidos", color: "text-danger-500", chip: "bg-danger-500/15 text-danger-500" },
  { key: "PRONTO", label: "Vencen pronto", color: "text-warning-500", chip: "bg-warning-500/15 text-warning-500" },
  { key: "SIN_FECHA", label: "Sin fecha cargada", color: "text-ink-50", chip: "text-ink-400" },
  { key: "VIGENTE", label: "Al dia", color: "text-success-500", chip: "bg-success-500/15 text-success-500" },
];
const ESTADO_BY_KEY = Object.fromEntries(ESTADOS.map((e) => [e.key, e]));

const TABS = [
  { value: "choferes", label: "Choferes" },
  { value: "vehiculos", label: "Vehiculos" },
];

// Etiqueta corta de cada documento para la cabecera de la tabla.
const DOC_SHORT = {
  UNILAV: "UNILAV",
  SOGGIORNO: "Soggiorno",
  PATENTE: "Patente",
  TRADUZIONE_PATENTE: "Trad. patente",
  CODICE_FISCALE: "C. fiscale",
  CARTA_IDENTITA: "Carta id.",
  PASSAPORTO: "Pasaporte",
  PERMESSO_TRASPORTO: "Permiso transp.",
};

const ZONE_ORDER = ["MILANO_NORD", "MILANO_SUD", "ROMA", "SOCIEDAD", "FARMACIA"];
const zoneLabel = (grupo) => (grupo ? GRUPO_LABELS[grupo] ?? grupo : "Sin zona");

// "2026-10-19" -> "19/10/26"
const shortDate = (day) => (day ? `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(2, 4)}` : "");
const longDate = (day) => (day ? `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}` : "");

const daysText = (dias) => {
  if (dias == null) return "";
  if (dias === 0) return "Vence hoy";
  if (dias > 0) return `Vence en ${dias} ${dias === 1 ? "dia" : "dias"}`;
  return `Vencio hace ${-dias} ${dias === -1 ? "dia" : "dias"}`;
};

const nf = (value) => Number(value).toLocaleString("es-AR");

// Cumpleanos: dias que faltan para el proximo (0 = hoy). Se avisa dentro de las proximas dos semanas.
const BIRTHDAY_DAYS = 14;
const daysToBirthday = (nacimiento, hoy) => {
  if (!nacimiento) return null;
  const year = Number(hoy.slice(0, 4));
  const day = (y) => Date.UTC(y, Number(nacimiento.slice(5, 7)) - 1, Number(nacimiento.slice(8, 10)));
  const today = Date.UTC(year, Number(hoy.slice(5, 7)) - 1, Number(hoy.slice(8, 10)));
  let next = day(year);
  if (next < today) next = day(year + 1);
  return Math.round((next - today) / 86400000);
};

const DateChip = ({ cell, title }) => {
  const estado = ESTADO_BY_KEY[cell.estado];
  if (cell.estado === "SIN_FECHA") return <span className="text-ink-400">—</span>;
  return (
    <span
      title={title ?? daysText(cell.dias)}
      className={clsx("inline-block whitespace-nowrap rounded-md px-1.5 py-0.5 text-[12px] font-medium", estado.chip)}
    >
      {shortDate(cell.fecha)}
    </span>
  );
};

const TagliandoChip = ({ cell }) => {
  if (cell.estado === "SIN_FECHA") return <span className="text-ink-400">—</span>;
  const estado = ESTADO_BY_KEY[cell.estado];
  const text = cell.restante >= 0 ? `${nf(cell.restante)} km` : `${nf(-cell.restante)} km pasado`;
  return (
    <span
      title={`${nf(cell.usado)} km desde el ultimo mantenimiento`}
      className={clsx("inline-block whitespace-nowrap rounded-md px-1.5 py-0.5 text-[12px] font-medium", estado.chip)}
    >
      {text}
    </span>
  );
};

const choferCells = (chofer, documentos) => documentos.map((tipo) => chofer.documentos[tipo]);
const vehiculoCells = (vehiculo) => [vehiculo.seguro, vehiculo.revision, vehiculo.tagliando];

const groupByZone = (items) => {
  const groups = new Map();
  for (const item of items) {
    const key = item.grupo ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const ia = ZONE_ORDER.indexOf(a);
      const ib = ZONE_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map(([grupo, rows]) => ({ grupo: grupo || null, rows }));
};

const Th = ({ children, className }) => (
  <th className={clsx("px-2 py-2.5 text-center text-[11px] font-medium uppercase tracking-wide text-ink-400", className)}>
    {children}
  </th>
);

const ZoneRow = ({ grupo, count, colSpan }) => (
  <tr>
    <td colSpan={colSpan} className="bg-line/[0.06] px-4 py-1.5 text-[12px] font-semibold text-ink-300">
      {zoneLabel(grupo)} <span className="ml-1 font-normal text-ink-400">{count}</span>
    </td>
  </tr>
);

export const VencimientosPage = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("choferes");
  const [zona, setZona] = useState("");
  const [estado, setEstado] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    getVencimientosRequest()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isChoferes = tab === "choferes";
  const items = useMemo(() => (data ? (isChoferes ? data.choferes : data.vehiculos) : []), [data, isChoferes]);
  const cellsOf = (item) => (isChoferes ? choferCells(item, data.documentos) : vehiculoCells(item));

  const zonas = useMemo(() => [...new Set(items.map((i) => i.grupo ?? ""))], [items]);

  const text = query.trim().toLowerCase();
  const scoped = items.filter((item) => {
    if (zona !== "" && (item.grupo ?? "") !== zona) return false;
    if (!text) return true;
    const haystack = isChoferes ? item.nombre : `${item.targa} ${item.modelo} ${item.choferes.join(" ")}`;
    return haystack.toLowerCase().includes(text);
  });

  // Contadores: fechas (no personas) de lo que se ve segun zona y busqueda, antes de filtrar por estado.
  const counts = { VENCIDO: 0, PRONTO: 0, SIN_FECHA: 0, VIGENTE: 0 };
  if (data) for (const item of scoped) for (const cell of cellsOf(item)) counts[cell.estado] += 1;

  const rows = estado ? scoped.filter((item) => cellsOf(item).some((cell) => cell.estado === estado)) : scoped;
  const groups = groupByZone(rows);

  const exportCsv = () => {
    const today = data.hoy;
    if (isChoferes) {
      const header = ["Zona", "Chofer", "Nacimiento", ...data.documentos.map((t) => TIPO_DOCUMENTO_LABELS[t] ?? t)];
      const lines = rows.map((c) => [
        zoneLabel(c.grupo),
        c.nombre,
        longDate(c.fechaNacimiento),
        ...data.documentos.map((t) => longDate(c.documentos[t].fecha)),
      ]);
      downloadCsv(`Vencimientos_choferes_${today}.csv`, toCsv([header, ...lines]));
    } else {
      const header = ["Zona", "Targa", "Modelo", "Chofer", "Seguro", "Revision tecnica", "Tagliando (km restantes)"];
      const lines = rows.map((v) => [
        zoneLabel(v.grupo),
        v.targa,
        v.modelo,
        v.choferes.join(", "),
        longDate(v.seguro.fecha),
        longDate(v.revision.fecha),
        v.tagliando.restante ?? "",
      ]);
      downloadCsv(`Vencimientos_vehiculos_${today}.csv`, toCsv([header, ...lines]));
    }
  };

  const colSpan = isChoferes ? 2 + data?.documentos.length : 6;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[24px] font-semibold text-ink-50">Vencimientos</h1>
        <p className="mt-1 text-[14px] text-ink-300">
          Que documentos de los choferes y de los vehiculos estan vencidos o por vencer.
        </p>
      </div>

      <Alert>{error}</Alert>
      {!data && !error && <PageLoader />}

      {data?.sinZona && (
        <Alert>Tu usuario no tiene una zona asignada, asi que no hay nada que mostrar. Pidele al Admin que te la asigne.</Alert>
      )}

      {data && !data.sinZona && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {ESTADOS.map((e) => (
              <button
                key={e.key}
                type="button"
                onClick={() => setEstado((prev) => (prev === e.key ? null : e.key))}
                aria-pressed={estado === e.key}
                className={clsx(
                  "glass-surface rounded-2xl px-4 py-3 text-left transition-colors hover:bg-line/[0.06]",
                  estado === e.key && "ring-2 ring-accent-500/60"
                )}
              >
                <span className={clsx("block text-[24px] font-semibold leading-tight", e.color)}>{counts[e.key]}</span>
                <span className="text-[12px] text-ink-300">{e.label}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              options={TABS}
              value={tab}
              onChange={(value) => {
                setTab(value);
                setZona("");
                setEstado(null);
              }}
            />
            <label className="glass-input flex min-w-[180px] flex-1 items-center gap-2 rounded-xl px-3 py-2 sm:max-w-xs">
              <SearchIcon className="h-4 w-4 shrink-0 text-ink-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isChoferes ? "Buscar chofer" : "Buscar targa, modelo o chofer"}
                className="w-full bg-transparent text-[14px] text-ink-50 outline-none placeholder:text-ink-400"
              />
            </label>
            {zonas.length > 1 && (
              <select
                value={zona}
                onChange={(e) => setZona(e.target.value)}
                aria-label="Zona"
                className="glass-input rounded-xl px-3 py-2 text-[14px] text-ink-50"
              >
                <option value="" className="bg-popover text-ink-50">
                  Todas las zonas
                </option>
                {zonas.map((z) => (
                  <option key={z || "none"} value={z} className="bg-popover text-ink-50">
                    {zoneLabel(z || null)}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={exportCsv}
              disabled={rows.length === 0}
              className="glass-surface-sm ml-auto inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium text-ink-50 transition-colors hover:bg-line/10 disabled:opacity-50"
            >
              <DownloadIcon className="h-4 w-4" />
              Descargar Excel
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-300">
            <span>
              <span className={clsx("mr-1 rounded-md px-1.5 py-0.5 font-medium", ESTADO_BY_KEY.VIGENTE.chip)}>vigente</span>
            </span>
            <span>
              <span className={clsx("mr-1 rounded-md px-1.5 py-0.5 font-medium", ESTADO_BY_KEY.PRONTO.chip)}>vence pronto</span>
              {isChoferes ? "(30 dias; Patente y Trad. 60; Soggiorno 90)" : `(${data.avisoDiasVehiculo} dias; tagliando: <= 3.500 km)`}
            </span>
            <span>
              <span className={clsx("mr-1 rounded-md px-1.5 py-0.5 font-medium", ESTADO_BY_KEY.VENCIDO.chip)}>vencido</span>
            </span>
            <span>
              <span className="mr-1 text-ink-400">—</span>sin fecha cargada
            </span>
          </div>

          {rows.length === 0 ? (
            <p className="px-1 py-6 text-[14px] text-ink-400">
              {items.length === 0 ? "No hay datos para mostrar." : "Nada coincide con los filtros."}
            </p>
          ) : (
            <div className="glass-surface overflow-x-auto rounded-2xl">
              {isChoferes ? (
                <table className="w-full min-w-[820px] border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-line/10">
                      <Th className="!text-left pl-4">Chofer</Th>
                      {data.documentos.map((tipo) => (
                        <Th key={tipo}>{DOC_SHORT[tipo] ?? tipo}</Th>
                      ))}
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
                      <GroupRows key={group.grupo ?? "none"} group={group} colSpan={colSpan}>
                        {(c) => {
                          const cumple = daysToBirthday(c.fechaNacimiento, data.hoy);
                          return (
                            <tr key={c.id} className="border-b border-line/[0.07] last:border-b-0 hover:bg-line/[0.04]">
                              <td className="py-2 pl-4 pr-2">
                                <Link to={`/choferes/${c.id}`} className="flex items-center gap-2.5">
                                  <Avatar user={{ nombre: c.nombre.split(" ")[0], apellido: c.nombre.split(" ").slice(1).join(" "), imagenUrl: c.imagenUrl }} className="h-8 w-8 text-[11px]" />
                                  <span className="min-w-0">
                                    <span className="block truncate font-medium text-ink-50">{c.nombre}</span>
                                    <span className="block text-[11px] text-ink-400">{longDate(c.fechaNacimiento)}</span>
                                  </span>
                                </Link>
                              </td>
                              {data.documentos.map((tipo) => (
                                <td key={tipo} className="px-1 py-2 text-center">
                                  <DateChip cell={c.documentos[tipo]} />
                                </td>
                              ))}
                              <td className="px-2 py-2 text-center">
                                {cumple != null && cumple <= BIRTHDAY_DAYS && (
                                  <span className="whitespace-nowrap rounded-md bg-accent-500/15 px-1.5 py-0.5 text-[11px] font-medium text-accent-300">
                                    {cumple === 0 ? "Cumple hoy" : `Cumple ${longDate(c.fechaNacimiento).slice(0, 5)}`}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        }}
                      </GroupRows>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[640px] border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-line/10">
                      <Th className="!text-left pl-4">Targa</Th>
                      <Th className="!text-left">Modelo</Th>
                      <Th className="!text-left">Chofer</Th>
                      <Th>Seguro</Th>
                      <Th>Revision</Th>
                      <Th>Tagliando</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
                      <GroupRows key={group.grupo ?? "none"} group={group} colSpan={colSpan}>
                        {(v) => (
                          <tr key={v.id} className="border-b border-line/[0.07] last:border-b-0 hover:bg-line/[0.04]">
                            <td className="py-2 pl-4 pr-2">
                              <Link to={`/vehiculos/${v.id}`} className="font-semibold text-ink-50 hover:underline">
                                {v.targa}
                              </Link>
                            </td>
                            <td className="px-2 py-2 text-ink-300">{v.modelo}</td>
                            <td className="px-2 py-2 text-ink-300">{v.choferes.join(", ") || "—"}</td>
                            <td className="px-1 py-2 text-center">
                              <DateChip cell={v.seguro} />
                            </td>
                            <td className="px-1 py-2 text-center">
                              <DateChip cell={v.revision} />
                            </td>
                            <td className="px-1 py-2 text-center">
                              <TagliandoChip cell={v.tagliando} />
                            </td>
                          </tr>
                        )}
                      </GroupRows>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Fila de zona y las filas de esa zona.
const GroupRows = ({ group, colSpan, children }) => (
  <>
    <ZoneRow grupo={group.grupo} count={group.rows.length} colSpan={colSpan} />
    {group.rows.map((item) => children(item))}
  </>
);

// CSV con ";" y BOM (como el resto de las exportaciones: Excel en espanol/italiano lo abre directo).
const toCsv = (matrix) =>
  `﻿${matrix.map((row) => row.map((v) => (/[";\r\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ""))).join(";")).join("\r\n")}`;
