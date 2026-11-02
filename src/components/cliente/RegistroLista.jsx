import clsx from "clsx";
import { useMemo, useState } from "react";
import { AreaBadge } from "../records/AreaBadge";
import { PanelShell } from "../ui/PanelShell";
import { TextField } from "../ui/TextField";
import { BarsIcon, ClipboardListIcon, ClockIcon, DownloadIcon, ImageIcon, SearchIcon } from "../ui/icons";
import { EstadoPill } from "../solicitudes/SolicitudDetalle";
import { aplicativoTexto, ESTADO_PILL, estadoTexto } from "./TablaServicios";
import { useLanguage, useT } from "../../i18n/index.jsx";
import { buildFullCsv, downloadCsv } from "../../lib/csv";
import { AREA_ALL, RECORD_AREAS } from "../../lib/recordAreas";
import { horaRoma, minutosTexto, RETRASO_AVISO_MIN } from "../../lib/seguimiento";
import { kmDeSolicitud } from "../../lib/solicitudes";

// Vista del Registro del cliente (Piazza) igual que la de la oficina: areas arriba, los servicios del mes agrupados por dia, el resumen del mes y los pendientes de hoy.
// Junta las solicitudes (lo que pidio) y los servicios ya creados por la oficina, con los datos que tenia la hoja tipo Excel. La unica alerta es la de la ETA: el chofer
// no llego a tiempo (en rojo).

const AREAS = RECORD_AREAS.filter((a) => a.key !== "otros");
const FINALES = new Set(["CONSEGNATO", "ANNULLATO", "RISCHEDULATO"]);
// Pasadas estas horas sin llegar, un servicio se da por olvidado y no se marca (igual que el seguimiento del cliente).
const OLVIDADO_MIN = 12 * 60;

const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);
const diaRoma = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });

const areaDeServicio = (r) =>
  r.spedizzione === "DHL" ? (r.zona === "ROMA" ? "dhl-roma" : "dhl-milano") : r.spedizzione === "AB_SERVICE" ? "ab-service" : r.zona === "ROMA" ? "piazza-roma" : "piazza-milano";

const areaDeSolicitud = (s) =>
  s.servicio === "DHL_MILANO" ? "dhl-milano" : s.servicio === "DHL_ROMA" ? "dhl-roma" : s.servicio === "AB_SERVICE" ? "ab-service" : s.zona === "ROMA" ? "piazza-roma" : "piazza-milano";

// Retraso respecto a la ETA (minutos) o null: llego tarde, o todavia no llego y ya paso la ETA (o el GPS ya lo da por retrasado).
const retrasoEta = (r, enCamino, ahora) => {
  if (r.llegoAt) return r.puntualidadMin != null && r.puntualidadMin > RETRASO_AVISO_MIN ? r.puntualidadMin : null;
  if (FINALES.has(r.estado)) return null;
  const vencido = Math.round((ahora - new Date(r.etaPlan).getTime()) / 60000);
  if (vencido > OLVIDADO_MIN) return null;
  const gps = enCamino.get(r.id);
  if (gps?.estado === "CON_RETRASO") return Math.max(gps.retrasoMin, vencido > RETRASO_AVISO_MIN ? vencido : 0);
  return vencido > RETRASO_AVISO_MIN ? vencido : null;
};

export const filasRegistro = ({ solicitudes, servicios, seguimiento, ahora }) => {
  const enCamino = new Map((seguimiento?.enCamino ?? []).map((s) => [s.id, s]));
  const hechos = new Set(servicios.map((r) => r.id));
  const porRecord = new Map(solicitudes.filter((s) => s.recordId).map((s) => [s.recordId, s]));
  const deSolicitud = solicitudes
    .filter((s) => !(s.recordId && hechos.has(s.recordId)))
    .map((s) => ({
      key: `s-${s.id}`,
      origen: "solicitud",
      id: s.id,
      area: areaDeSolicitud(s),
      codigo: s.shipment || s.orderNumero || "",
      orden: s.shipment ? s.orderNumero : null,
      cliente: s.cliente,
      ritiro: s.ritiro,
      destino: s.destinazione,
      tipo: s.tipoPedido,
      km: kmDeSolicitud(s),
      numero: aplicativoTexto(s.asignado?.aplicativo ?? s.aplicativo),
      chofer: s.asignado?.chofer ?? null,
      targa: s.asignado?.targa ?? null,
      eta: s.etaPendiente ? null : s.fechaHora,
      dia: diaRoma(s.fechaHora),
      fotos: 0,
      retraso: null,
      pendiente: s.estado === "PENDIENTE",
      solicitud: s,
    }));
  const deServicio = servicios.map((r) => {
    const sol = porRecord.get(r.id);
    return {
      key: `r-${r.id}`,
      origen: "servicio",
      id: r.id,
      area: areaDeServicio(r),
      codigo: r.shipment ?? sol?.shipment ?? r.orderNumero ?? sol?.orderNumero ?? r.codigo,
      orden: (r.shipment ?? sol?.shipment) ? (r.orderNumero ?? sol?.orderNumero ?? null) : null,
      cliente: r.cliente ?? "",
      ritiro: sol?.ritiro ?? null,
      destino: r.ciudad || r.destino,
      tipo: r.tipoPedido,
      km: r.km != null ? String(Math.round(r.km * 10) / 10).replace(".", ",") : null,
      numero: aplicativoTexto(r.aplicativo),
      chofer: r.chofer,
      targa: r.targa,
      eta: r.etaPlan,
      llegoAt: r.llegoAt,
      dia: diaRoma(r.fecha),
      fotos: r.fotos ?? 0,
      retraso: retrasoEta(r, enCamino, ahora),
      pendiente: !FINALES.has(r.estado) && !r.llegoAt,
      servicio: r,
    };
  });
  return [...deSolicitud, ...deServicio];
};

// CSV de lo que se ve (mes, area y busqueda activas): una fila por servicio o solicitud, con la puntualidad para cuadrar la facturacion. El portal es en italiano.
const fechaHoraCsv = (iso) => (iso ? `${new Date(iso).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" })} ${horaRoma(iso)}` : "");
const COLUMNAS_CSV = ["Shipment / Codice", "Order / Secondo codice", "Servizio", "Cliente", "Ritiro", "Destinazione", "Tipo", "Data e ora previste", "Arrivo", "Puntualità (min)", "Stato", "Targa", "Autista", "N°", "KM"];
export const filasACsv = (filas, area) =>
  filas.map((f) => [
    f.codigo,
    f.orden ?? "",
    area(f.area),
    f.cliente,
    f.ritiro ?? "",
    f.destino,
    f.tipo ?? "",
    fechaHoraCsv(f.eta),
    fechaHoraCsv(f.llegoAt),
    f.servicio?.puntualidadMin ?? "",
    f.origen === "solicitud" ? f.solicitud.estado : f.servicio.estadoLabel,
    f.targa ?? "",
    f.chofer ?? "",
    f.numero ?? "",
    f.km ?? "",
  ]);

const GRID =
  "grid min-w-[780px] grid-cols-[minmax(130px,1.1fr)_minmax(120px,1.3fr)_minmax(80px,0.8fr)_minmax(90px,0.9fr)_96px_minmax(100px,0.9fr)_44px] items-center gap-3 px-4";

const ChevronIcon = ({ open }) => (
  <svg className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 7.5L10 12.5L15 7.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RetrasoPill = ({ min, className }) => {
  const t = useT();
  return (
    <span className={clsx("inline-block rounded-full bg-danger-500/15 px-2 py-0.5 text-[11px] font-semibold text-danger-500", className)}>
      {t("reg.late", { min: minutosTexto(min) })}
    </span>
  );
};

const Cabecera = () => {
  const t = useT();
  return (
    <div className={`${GRID} py-2 text-[11px] font-medium uppercase tracking-wide text-ink-500`}>
      <span>{t("reg.colService")}</span>
      <span>{t("reg.colDestination")}</span>
      <span>{t("hist.plate")}</span>
      <span>{t("hist.driver")}</span>
      <span>{t("hist.status")}</span>
      <span>{t("reg.colEta")}</span>
      <span className="text-center">{t("reg.colPhotos")}</span>
    </div>
  );
};

// Icono de la galeria de fotos del servicio (retiro y entrega): abre el visor con las dos partes.
export const BotonGaleria = ({ servicio, onFotos, className }) => {
  const t = useT();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onFotos(servicio);
      }}
      aria-label={t("reg.gallery")}
      title={t("reg.gallery")}
      className={clsx("relative rounded-lg p-1.5 text-ink-300 hover:bg-line/10 hover:text-ink-50", className)}
    >
      <ImageIcon className="h-5 w-5" />
      {servicio.fotos > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold leading-none text-white">{servicio.fotos}</span>
      )}
    </button>
  );
};

const Fila = ({ fila, verFotos, onOpenSolicitud, onOpenServicio, onFotos }) => {
  const t = useT();
  const { language } = useLanguage();
  const area = RECORD_AREAS.find((a) => a.key === fila.area);
  // Todas las filas abren su vista rapida (la solicitud o el servicio). Es un div y no un boton porque lleva botones de fotos dentro.
  const abrir = () => (fila.origen === "solicitud" ? onOpenSolicitud(fila.id) : onOpenServicio(fila));
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={abrir}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          abrir();
        }
      }}
      className={clsx(
        GRID,
        "w-full cursor-pointer rounded-xl py-2.5 text-left text-[12px] text-ink-200 transition-colors",
        fila.retraso != null ? "border-l-4 border-danger-500 bg-danger-500/[0.09] hover:bg-danger-500/[0.15]" : "hover:bg-line/[0.06]"
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <AreaBadge areaKey={fila.area} size={32} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-ink-50" title={fila.codigo}>
            {fila.codigo || "—"}
          </span>
          <span className="block truncate text-[11px] text-ink-400">{area?.label}</span>
        </span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] text-ink-50" title={fila.destino}>
          {fila.destino || "—"}
        </span>
        <span className="block truncate text-[11px] text-ink-400">
          {[fila.orden && `Order ${fila.orden}`, fila.cliente, fila.ritiro && `${t("reg.pickup")}: ${fila.ritiro}`, fila.tipo, fila.km && `${fila.km} km`].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-ink-100">{fila.targa ?? "—"}</span>
        {fila.numero && <span className="block truncate text-[11px] text-ink-400">{fila.numero}</span>}
      </span>
      <span className="truncate" title={fila.chofer ?? ""}>
        {fila.chofer ?? "—"}
      </span>
      <span>
        {fila.origen === "solicitud" ? (
          <EstadoPill estado={fila.solicitud.estado} />
        ) : (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ESTADO_PILL[fila.servicio.estado] ?? "bg-line/15 text-ink-300"}`}>
            {estadoTexto(fila.servicio, t, language)}
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="min-w-0">
          <span className="block truncate text-ink-100">{fila.eta ? horaRoma(fila.eta) : <span className="text-danger-500">—</span>}</span>
          {fila.llegoAt && <span className="block truncate text-[11px] text-ink-400">{t("reg.arrived", { time: horaRoma(fila.llegoAt) })}</span>}
          {fila.retraso != null && <RetrasoPill min={fila.retraso} className="mt-1" />}
        </span>
      </span>
      <span className="flex justify-center">{verFotos && fila.fotos > 0 && <BotonGaleria servicio={fila.servicio} onFotos={onFotos} />}</span>
    </div>
  );
};

export const RegistroLista = ({ solicitudes, servicios, seguimiento, month, verFotos, onOpenSolicitud, onOpenServicio, onFotos }) => {
  const t = useT();
  const { language } = useLanguage();
  const [areaKey, setAreaKey] = useState(AREA_ALL);
  const [busqueda, setBusqueda] = useState("");
  // El dia de hoy empieza abierto.
  const [abiertos, setAbiertos] = useState(() => new Set([diaRoma(new Date().toISOString())]));

  const filas = useMemo(() => filasRegistro({ solicitudes, servicios, seguimiento, ahora: Date.now() }), [solicitudes, servicios, seguimiento]);

  const stats = useMemo(() => {
    const out = Object.fromEntries(AREAS.map((a) => [a.key, { count: 0, km: 0 }]));
    for (const f of filas) {
      out[f.area].count += 1;
      out[f.area].km += parseFloat(String(f.km ?? "").replace(",", ".")) || 0;
    }
    return out;
  }, [filas]);
  const total = filas.length;
  const totalKm = Object.values(stats).reduce((sum, s) => sum + s.km, 0);

  const q = busqueda.trim().toLowerCase();
  const visibles = useMemo(
    () =>
      filas.filter(
        (f) =>
          (areaKey === AREA_ALL || f.area === areaKey) &&
          (!q || [f.codigo, f.orden, f.cliente, f.destino, f.ritiro, f.chofer, f.targa].some((v) => v && String(v).toLowerCase().includes(q)))
      ),
    [filas, areaKey, q]
  );

  const dias = useMemo(() => {
    const porDia = new Map();
    for (const f of visibles) porDia.set(f.dia, [...(porDia.get(f.dia) ?? []), f]);
    return [...porDia.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([dia, items]) => ({
        dia,
        items: items.sort((a, b) => new Date(a.eta ?? 0) - new Date(b.eta ?? 0)),
        retrasos: items.filter((f) => f.retraso != null).length,
      }));
  }, [visibles]);

  const hoy = diaRoma(new Date().toISOString());
  const pendientesHoy = useMemo(
    () => filas.filter((f) => f.dia === hoy && f.pendiente && (areaKey === AREA_ALL || f.area === areaKey)).sort((a, b) => new Date(a.eta ?? 0) - new Date(b.eta ?? 0)),
    [filas, hoy, areaKey]
  );

  const etiquetaDia = (dia) => mayuscula(new Date(`${dia}T12:00:00Z`).toLocaleDateString(language === "it" ? "it-IT" : "es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }));
  const nombreMes = mayuscula(new Date(`${month}-15T12:00:00Z`).toLocaleDateString(language === "it" ? "it-IT" : "es-AR", { month: "long", year: "numeric", timeZone: "UTC" }));
  const toggle = (dia) =>
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(dia)) next.delete(dia);
      else next.add(dia);
      return next;
    });
  const cuenta = (count) => t("reg.serviceCount", { count });

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={t("reg.services")} className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
        {[{ key: AREA_ALL, label: t("reg.all") }, ...AREAS].map((a) => {
          const activa = areaKey === a.key;
          const count = a.key === AREA_ALL ? total : stats[a.key].count;
          return (
            <button
              key={a.key}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => setAreaKey(a.key)}
              className={`flex shrink-0 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                activa ? "border-accent-500/60 bg-accent-500/10 shadow-[0_0_0_1px_var(--accent-500)_inset]" : "glass-surface hover:bg-line/[0.05]"
              }`}
            >
              {a.key === AREA_ALL ? (
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-accent-400">
                  <ClipboardListIcon className="h-[18px] w-[18px]" />
                </span>
              ) : (
                <AreaBadge areaKey={a.key} size={30} />
              )}
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-ink-50">{a.label}</span>
                <span className="block text-[12px] text-ink-400">{cuenta(count)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="glass-surface rounded-2xl p-3">
        <TextField
          id="registro-busqueda"
          icon={SearchIcon}
          type="search"
          placeholder={t("reg.search")}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
        <section className="glass-surface min-w-0 rounded-2xl">
          <header className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <h2 className="text-[15px] font-semibold text-ink-50">
              {t("reg.servicesOf")} · {nombreMes}
            </h2>
            <span className="flex items-center gap-3">
              <span className="text-[12px] text-ink-400">{areaKey === AREA_ALL ? t("reg.allAreas") : AREAS.find((a) => a.key === areaKey)?.label}</span>
              <button
                type="button"
                disabled={visibles.length === 0}
                onClick={() =>
                  downloadCsv(`Servizi_${month}.csv`, buildFullCsv({ columnas: COLUMNAS_CSV, filas: filasACsv(visibles, (key) => RECORD_AREAS.find((a) => a.key === key)?.label ?? key) }))
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-line/25 px-3 py-1.5 text-[12px] font-semibold text-ink-100 transition hover:bg-line/10 disabled:pointer-events-none disabled:opacity-40"
              >
                <DownloadIcon className="h-3.5 w-3.5" />
                {t("reg.exportCsv")}
              </button>
            </span>
          </header>

          <div className="flex flex-col gap-2.5 border-t border-line/10 p-4">
            {dias.length === 0 && <p className="py-6 text-center text-[14px] text-ink-300">{t("reg.noneMonth")}</p>}
            {dias.map(({ dia, items, retrasos }) => {
              const abierto = abiertos.has(dia);
              return (
                <div key={dia} className="rounded-2xl border border-line/[0.08] bg-line/[0.02]">
                  <button type="button" onClick={() => toggle(dia)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-[14px] text-ink-100">
                    <span className="flex flex-wrap items-center gap-2.5">
                      <span className="font-semibold text-ink-50">{etiquetaDia(dia)}</span>
                      <span className="rounded-full bg-accent-500/15 px-2.5 py-0.5 text-[11px] font-medium text-accent-400">{cuenta(items.length)}</span>
                      {retrasos > 0 && (
                        <span className="rounded-full bg-danger-500/15 px-2.5 py-0.5 text-[11px] font-medium text-danger-500">{t("reg.lateCount", { count: retrasos })}</span>
                      )}
                    </span>
                    <ChevronIcon open={abierto} />
                  </button>
                  {abierto && (
                    <div className="overflow-x-auto border-t border-line/10 pb-2">
                      <Cabecera />
                      <div className="flex min-w-[780px] flex-col gap-0.5 px-2">
                        {items.map((f) => (
                          <Fila key={f.key} fila={f} verFotos={verFotos} onOpenSolicitud={onOpenSolicitud} onOpenServicio={onOpenServicio} onFotos={onFotos} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="flex flex-col gap-5 xl:sticky xl:top-6">
          <PanelShell icon={BarsIcon} title={t("reg.monthSummary")}>
            <div className="grid grid-cols-2 gap-2.5">
              {AREAS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setAreaKey(a.key)}
                  className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors hover:bg-line/[0.05] ${areaKey === a.key ? "border-accent-500/50 bg-accent-500/10" : "border-line/10"}`}
                >
                  <AreaBadge areaKey={a.key} size={30} />
                  <span className="min-w-0">
                    <span className="block text-[18px] font-semibold leading-none text-ink-50">{stats[a.key].count}</span>
                    <span className="mt-1 block truncate text-[11px] text-ink-400">{a.shortLabel ?? a.label}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 flex items-center justify-between border-t border-line/10 pt-3 text-[12px] text-ink-300">
              <span>{t("reg.monthTotal")}</span>
              <span className="font-medium text-ink-100">
                {cuenta(total)} · {Math.round(totalKm).toLocaleString(language === "it" ? "it-IT" : "es-AR")} km
              </span>
            </p>
          </PanelShell>

          <PanelShell icon={ClockIcon} title={t("reg.pendingToday")}>
            <p className="mb-3 text-[12px] text-ink-400">{t("reg.pendingHint")}</p>
            {pendientesHoy.length === 0 ? (
              <p className="py-2 text-center text-[13px] text-ink-300">{t("reg.noPendingToday")}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {pendientesHoy.map((f) => (
                  <li
                    key={f.key}
                    className={clsx("rounded-xl border border-line/10 px-3 py-2", f.retraso != null && "border-l-4 border-l-danger-500 bg-danger-500/[0.09]")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <AreaBadge areaKey={f.area} size={22} />
                        <span className="truncate text-[13px] font-semibold text-ink-50">{f.codigo || "—"}</span>
                      </span>
                      <span className="shrink-0 text-[12px] text-ink-200">{f.eta ? horaRoma(f.eta) : "—"}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-ink-300">{f.destino}</p>
                    {f.retraso != null && <RetrasoPill min={f.retraso} className="mt-1" />}
                  </li>
                ))}
              </ul>
            )}
          </PanelShell>
        </aside>
      </div>
    </div>
  );
};
