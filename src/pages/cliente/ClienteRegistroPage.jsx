import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { MonthSelector } from "../../components/finanzas/MonthSelector";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { PageLoader } from "../../components/ui/PageLoader";
import { CloseIcon, PlusIcon } from "../../components/ui/icons";
import { EstadoPill, SolicitudDetalle } from "../../components/solicitudes/SolicitudDetalle";
import { SolicitudForm } from "../../components/solicitudes/SolicitudForm";
import { SolicitudWhatsappButton } from "../../components/solicitudes/SolicitudWhatsappButton";
import { useAuth } from "../../context/AuthContext";
import { useT } from "../../i18n/index.jsx";
import { parseApiError } from "../../lib/api";
import { startVisibleInterval } from "../../lib/polling";
import { currentMonth } from "../../lib/finanzas";
import { formatCurrency } from "../../lib/format";
import { formatFechaHora, kmDeSolicitud, SOLICITUD_SERVICIOS } from "../../lib/solicitudes";
import { deleteSolicitudRequest, listSolicitudesClienteRequest } from "../../lib/solicitudes.api";

const REFRESH_MS = 60 * 1000;

const Modal = ({ title, onClose, children }) => {
  const t = useT();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label={t("common.close")} className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-popover p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-[17px] font-semibold text-ink-50">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="rounded-lg p-1.5 text-ink-300 hover:bg-line/10 hover:text-ink-50">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// Vista rapida de un registro: todos sus datos, "Copiar para WhatsApp" y, mientras este pendiente, editar y borrar.
const VistaRapida = ({ solicitud, onClose, onEdit, onDeleted }) => {
  const t = useT();
  const [confirmando, setConfirmando] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await deleteSolicitudRequest(solicitud.id);
      onDeleted();
    } catch (err) {
      setError(parseApiError(err).message);
      setDeleting(false);
    }
  };

  return (
    <Modal title={`${solicitud.cliente}`} onClose={onClose}>
      <div className="mb-3 flex items-center gap-2">
        <EstadoPill estado={solicitud.estado} />
        {solicitud.estado === "ACEPTADA" && <span className="text-[12px] text-ink-300">{t("reg.inRecord")}</span>}
      </div>
      <Alert>{error}</Alert>
      <SolicitudDetalle solicitud={solicitud} />
      <div className="mt-5 flex flex-wrap items-start gap-2">
        <SolicitudWhatsappButton solicitud={solicitud} />
        {solicitud.estado === "PENDIENTE" && (
          <Button variant="ghost" className="!w-auto px-4 py-2 text-[13px]" onClick={onEdit}>
            {t("common.edit")}
          </Button>
        )}
        {solicitud.estado !== "ACEPTADA" &&
          (confirmando ? (
            <Button variant="danger" className="!w-auto px-4 py-2 text-[13px]" loading={deleting} onClick={handleDelete}>
              {t("reg.yesDelete")}
            </Button>
          ) : (
            <Button variant="ghost" className="!w-auto px-4 py-2 text-[13px] text-danger-500" onClick={() => setConfirmando(true)}>
              {t("common.delete")}
            </Button>
          ))}
      </div>
    </Modal>
  );
};

// Columnas de cada hoja del Excel mensual: DHL Milano / Extra Piazza, DHL Roma (+ Pagato al 50%) y AB Service (+ Aut. ritiro, y el Totale en km).
const col = (key, label, render, { align = "left", total } = {}) => ({ key, label, render, align, total });
const COL_CLIENTE = col("cliente", "Cliente", (s) => s.cliente);
const COL_DESTINO = col("destinazione", "Destinazione", (s) => s.destinazione);
const COL_FECHA = col("fecha", "Data", (s) => formatFechaHora(s.fechaHora));
const COL_FORNITORE = col("fornitore", "Fornitore", (s) => s.fornitore);
const COL_PAGATO = col("pagato", "Pagato", (s) => (s.pagato != null ? formatCurrency(s.pagato) : ""), { align: "right", total: (s) => s.pagato ?? 0 });
const COL_VARIE = col("varie", "Varie", (s) => s.varie ?? "");
const COL_VARIE2 = col("varie2", "Varie 2", (s) => (s.varie2 != null ? formatCurrency(s.varie2) : ""), { align: "right", total: (s) => s.varie2 ?? 0 });

const COLUMNAS = {
  DHL_MILANO: [COL_CLIENTE, COL_DESTINO, COL_FECHA, COL_FORNITORE, col("km", "KM destino", (s) => kmDeSolicitud(s) ?? "", { align: "right" }), COL_PAGATO, COL_VARIE, COL_VARIE2],
  DHL_ROMA: [
    COL_CLIENTE,
    COL_DESTINO,
    COL_FECHA,
    COL_FORNITORE,
    col("km", "KM destino", (s) => kmDeSolicitud(s) ?? "", { align: "right" }),
    COL_PAGATO,
    col("pagato50", "Pagato al 50%", (s) => (s.pagato50 ? "SI" : "")),
    COL_VARIE,
    COL_VARIE2,
  ],
  AB_SERVICE: [COL_CLIENTE, COL_DESTINO, COL_FECHA, col("autRitiro", "Aut. ritiro", (s) => s.autRitiro ?? ""), COL_FORNITORE, col("km", "Totale", (s) => kmDeSolicitud(s) ?? "", { align: "right" }), COL_PAGATO, COL_VARIE, COL_VARIE2],
};
COLUMNAS.EXTRA_PIAZZA = COLUMNAS.DHL_MILANO;

// Los registros del mes por servicio, con las columnas del Excel y los totales de abajo (pagato y varie 2), como en cada hoja.
const TablaRegistros = ({ items, servicio, onSelect }) => {
  const t = useT();
  const columnas = COLUMNAS[servicio];
  const totales = columnas.filter((c) => c.total).map((c) => ({ key: c.key, label: c.label, value: items.reduce((sum, s) => sum + c.total(s), 0) }));
  return (
    <div className="glass-surface overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[720px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line/15 text-[11px] uppercase tracking-wide text-ink-400">
            {columnas.map((c) => (
              <th key={c.key} className={clsx("whitespace-nowrap px-3 py-2.5 font-semibold", c.align === "right" ? "text-right" : "text-left")}>
                {c.label}
              </th>
            ))}
            <th className="px-3 py-2.5 text-left font-semibold">{t("hist.status")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id} onClick={() => onSelect(s.id)} className="cursor-pointer border-b border-line/10 text-ink-100 transition-colors last:border-0 hover:bg-line/[0.07]">
              {columnas.map((c) => (
                <td key={c.key} className={clsx("px-3 py-2.5", c.align === "right" ? "whitespace-nowrap text-right" : "text-left", c.key === "cliente" && "font-semibold text-ink-50")}>
                  {c.render(s)}
                </td>
              ))}
              <td className="px-3 py-2.5">
                <EstadoPill estado={s.estado} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-ink-300">{t("reg.none")}</p>}
      {items.length > 0 && (
        <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-line/15 px-4 py-2.5 text-[13px] text-ink-300">
          {totales.map((tot) => (
            <span key={tot.key}>
              {t("reg.totalOf", { label: tot.label })} <strong className="text-ink-50">{formatCurrency(tot.value)}</strong>
            </span>
          ))}
          <span>
            {t("reg.total")} <strong className="text-ink-50">{formatCurrency(totales.reduce((sum, tot) => sum + tot.value, 0))}</strong>
          </span>
        </div>
      )}
    </div>
  );
};

// Registro limitado de Piazza: pide servicios a la oficina con pocos datos y los ve por mes, ordenados como las hojas del Excel (DHL Milano, DHL Roma,
// AB Service). La oficina los completa y los acepta; aqui se ve en que estado esta cada uno.
export const ClienteRegistroPage = () => {
  const t = useT();
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth);
  const [servicio, setServicio] = useState("DHL_MILANO");
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null); // null | { solicitud?: Solicitud }
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(
    () =>
      listSolicitudesClienteRequest(month)
        .then((list) => {
          setItems(list);
          setError("");
        })
        .catch((err) => setError(parseApiError(err).message)),
    [month]
  );

  useEffect(() => {
    setItems(null);
    load();
    return startVisibleInterval(load, REFRESH_MS);
  }, [load]);

  const porServicio = useMemo(() => Object.fromEntries(SOLICITUD_SERVICIOS.map((t) => [t.value, (items ?? []).filter((s) => s.servicio === t.value)])), [items]);

  if (!user?.clienteModulos?.includes("REGISTRO")) return <Navigate to="/cliente" replace />;

  const selected = items?.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-50">{t("reg.title")}</h1>
          <p className="text-[13px] text-ink-300">{t("reg.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthSelector month={month} onChange={setMonth} allowFuture />
          <Button className="!w-auto px-5 py-2.5" onClick={() => setForm({})}>
            <PlusIcon className="h-4 w-4" />
            {t("reg.new")}
          </Button>
        </div>
      </div>

      <div role="tablist" aria-label={t("reg.services")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {SOLICITUD_SERVICIOS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={servicio === t.value}
            onClick={() => setServicio(t.value)}
            className={clsx(
              "shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
              servicio === t.value ? "bg-brand text-brand-foreground" : "bg-line/10 text-ink-300 hover:text-ink-50"
            )}
          >
            {t.label}
            {items && <span className="ml-1.5 opacity-70">{porServicio[t.value].length}</span>}
          </button>
        ))}
      </div>

      <Alert>{error}</Alert>
      {!items && !error && <PageLoader />}
      {items && <TablaRegistros items={porServicio[servicio]} servicio={servicio} onSelect={setSelectedId} />}

      {selected && !form && (
        <VistaRapida
          solicitud={selected}
          onClose={() => setSelectedId(null)}
          onEdit={() => setForm({ solicitud: selected })}
          onDeleted={() => {
            setSelectedId(null);
            load();
          }}
        />
      )}

      {form && (
        <Modal title={form.solicitud ? t("reg.editTitle") : t("reg.new")} onClose={() => setForm(null)}>
          <SolicitudForm
            solicitud={form.solicitud}
            onCancel={() => setForm(null)}
            onSaved={(saved) => {
              setForm(null);
              setSelectedId(saved.id);
              setServicio(saved.servicio);
              // Un registro con fecha de otro mes se ve en ese mes.
              const savedMonth = new Date(saved.fechaHora).toLocaleDateString("en-CA", { timeZone: "Europe/Rome" }).slice(0, 7);
              if (savedMonth !== month) setMonth(savedMonth);
              else load();
            }}
          />
        </Modal>
      )}
    </div>
  );
};
