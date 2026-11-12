import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { MonthSelector } from "../../components/finanzas/MonthSelector";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { PageLoader } from "../../components/ui/PageLoader";
import { CloseIcon, PlusIcon } from "../../components/ui/icons";
import { Select } from "../../components/ui/Select";
import { TextField } from "../../components/ui/TextField";
import { BotonGaleria, RegistroLista, Segui } from "../../components/cliente/RegistroLista";
import { estadoTexto, FotosModal, TablaServicios } from "../../components/cliente/TablaServicios";
import { HojaMixta } from "../../components/solicitudes/HojaDhlMilano";
import { EstadoPill, SolicitudDetalle } from "../../components/solicitudes/SolicitudDetalle";
import { RegistroDesdeTexto } from "../../components/solicitudes/RegistroDesdeTexto";
import { SolicitudForm } from "../../components/solicitudes/SolicitudForm";
import { SolicitudWhatsappButton } from "../../components/solicitudes/SolicitudWhatsappButton";
import { useAuth } from "../../context/AuthContext";
import { useLanguage, useT } from "../../i18n/index.jsx";
import { parseApiError } from "../../lib/api";
import { editarCeldaRequest, getClienteCambiosRequest, getClienteMeRequest, getClienteSeguimientoRequest, getClienteServiciosRequest } from "../../lib/cliente.api";
import { startVisibleInterval } from "../../lib/polling";
import { horaRoma, minutosTexto } from "../../lib/seguimiento";
import { currentMonth } from "../../lib/finanzas";
import { formatCurrency } from "../../lib/format";
import { formatFechaHora, kmDeSolicitud, SOLICITUD_SERVICIOS, toRomeInput } from "../../lib/solicitudes";
import { deleteSolicitudRequest, listSolicitudesClienteRequest } from "../../lib/solicitudes.api";

const REFRESH_MS = 60 * 1000;

// La vista del Registro es la lista por dias (como la de la oficina). La hoja tipo Excel sigue en el codigo, oculta: se vuelve a mostrar poniendo esto en true.
const MOSTRAR_HOJA_EXCEL = false;

// Los tipos que van en la hoja tipo Google Sheets (el valor es su variante: DHL Roma llama ROMA a la ultima columna, AB Service no usa ese numero y Extra Piazza
// lleva CODICE, RITIRO y CONSEGNA).
const HOJAS = { DHL_MILANO: "dhl", DHL_ROMA: "roma", AB_SERVICE: "ab", EXTRA_PIAZZA: "extra" };

// En que pestana va un servicio ya hecho (Historial): DHL Milano / DHL Roma, AB Service y el resto como Extra Piazza.
const tipoDeServicio = (r) => (r.spedizzione === "DHL" ? (r.zona === "ROMA" ? "DHL_ROMA" : "DHL_MILANO") : r.spedizzione === "AB_SERVICE" ? "AB_SERVICE" : "EXTRA_PIAZZA");

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

// Escribir a la oficina por WhatsApp (solo si el servidor tiene el numero configurado); con "texto" el mensaje ya sale con el servicio de que se trata.
const ContactarUfficio = ({ numero, texto, className }) => {
  const t = useT();
  if (!numero) return null;
  return (
    <a
      href={`https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`}
      target="_blank"
      rel="noreferrer"
      className={className ?? "inline-flex items-center gap-1.5 rounded-xl border border-line/20 px-3.5 py-2 text-[13px] font-medium text-ink-100 transition hover:bg-line/10"}
    >
      {t("reg.contactOffice")}
    </a>
  );
};

// Vista rapida de un registro: todos sus datos, "Copiar para WhatsApp" y, mientras este pendiente, editar y borrar.
const VistaRapida = ({ solicitud, contacto, onClose, onEdit, onDeleted }) => {
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
        <ContactarUfficio numero={contacto} texto={`Ciao, ho una domanda sulla richiesta ${solicitud.shipment || solicitud.cliente} (${solicitud.destinazione}).`} />
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

// Vista rapida de un servicio ya creado por la oficina: sus datos, las fotos del retiro y de la entrega y, para quien lo pidio, modificar los pocos datos
// que puede cambiar (Shipment / Order o codigos, Tipo, Ciudad y ETA). El resto (cliente, km, numero, chofer...) lo decide la oficina. Cada cambio queda en el
// historial y, si el servicio ya esta entregado, la oficina recibe un aviso.
const VistaServicio = ({ fila, contacto, verFotos, verSeguimiento, onClose, onFotos, onSaved }) => {
  const t = useT();
  const { language } = useLanguage();
  const r = fila.servicio;
  const extra = fila.area === "piazza-milano" || fila.area === "piazza-roma";
  const inicial = useMemo(
    () => ({ shipment: r.shipment ?? "", orderNumero: r.orderNumero ?? "", tipoPedido: r.tipoPedido ?? "", ciudad: r.ciudad || r.destino || "", eta: toRomeInput(r.etaPlan) }),
    [r]
  );
  const [editando, setEditando] = useState(false);
  const [cambios, setCambios] = useState(null); // historial: lo que cambio la oficina y la propia empresa
  const [valores, setValores] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const setCampo = (campo, valor) => setValores((prev) => ({ ...prev, [campo]: valor }));

  useEffect(() => {
    let cancelled = false;
    getClienteCambiosRequest(r.id)
      .then((list) => !cancelled && setCambios(list))
      .catch(() => !cancelled && setCambios([]));
    return () => {
      cancelled = true;
    };
  }, [r.id]);

  const etiquetaCampo = (campo) => (extra && campo === "shipment" ? "Codice" : extra && campo === "orderNumero" ? "Secondo codice" : extra && campo === "ciudad" ? "Consegna" : t(`reg.campo.${campo}`));

  const guardar = async () => {
    const cambiosHechos = {};
    for (const campo of Object.keys(inicial)) if (String(valores[campo]).trim() !== String(inicial[campo]).trim()) cambiosHechos[campo] = valores[campo];
    if (Object.keys(cambiosHechos).length === 0) {
      setError(t("reg.noChanges"));
      return;
    }
    setGuardando(true);
    setError("");
    try {
      await editarCeldaRequest({ origen: "servicio", id: r.id, cambios: cambiosHechos });
      onSaved();
    } catch (err) {
      setError(parseApiError(err).message);
      setGuardando(false);
    }
  };

  const filas = [
    [extra ? "Codice" : "Shipment", fila.codigo],
    [extra ? "Secondo codice" : "Order", fila.orden],
    ["Cliente", fila.cliente],
    [t("reg.pickup"), fila.ritiro],
    [extra ? "Consegna" : "Città", fila.destino],
    ["Tipo", fila.tipo],
    ["ETA", formatFechaHora(r.etaPlan)],
    [t("hist.arrival"), r.llegoAt ? formatFechaHora(r.llegoAt) : null],
    [t("reg.estimatedLabel"), fila.enVivo?.llegadaEstimada ? horaRoma(fila.enVivo.llegadaEstimada) : null],
    ["KM", fila.km ? `${fila.km} km` : null],
    ["N°", fila.numero],
    [t("hist.plate"), fila.targa],
    [t("hist.driver"), fila.chofer],
    [t("hist.status"), estadoTexto(r, t, language)],
  ].filter(([, valor]) => valor);

  return (
    <Modal title={t("reg.serviceTitle", { code: fila.codigo || r.codigo })} onClose={onClose}>
      <Alert>{error}</Alert>
      {fila.retraso != null && (
        <p className="mb-3 rounded-xl bg-danger-500/10 px-3 py-2 text-[13px] font-medium text-danger-500">{t("reg.late", { min: minutosTexto(fila.retraso) })}</p>
      )}
      {!editando ? (
        <>
          <dl className="flex flex-col gap-2.5">
            {filas.map(([label, valor]) => (
              <div key={label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="w-32 shrink-0 text-[12px] uppercase tracking-wide text-ink-400">{label}</dt>
                <dd className="min-w-0 break-words text-[14px] text-ink-50">{valor}</dd>
              </div>
            ))}
          </dl>
          {cambios && (
            <div className="mt-5 border-t border-line/10 pt-4">
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-400">{t("reg.history")}</h3>
              {cambios.length === 0 ? (
                <p className="text-[13px] text-ink-400">{t("reg.historyNone")}</p>
              ) : (
                <ul className="flex max-h-44 flex-col gap-1.5 overflow-y-auto pr-1">
                  {cambios.map((c) => (
                    <li key={c.id} className="text-[13px] text-ink-200">
                      <span className="text-ink-400">
                        {formatFechaHora(c.fecha)} · {c.editor}
                      </span>
                      <br />
                      <span className="font-medium text-ink-100">{etiquetaCampo(c.campo)}:</span> {c.anterior ?? "—"} → {c.nuevo ?? "—"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {verFotos && (
              <span className={`inline-flex items-center gap-1 rounded-xl border border-line/20 pr-3 text-[13px] text-ink-100 ${r.fotos > 0 ? "" : "opacity-40"}`}>
                <BotonGaleria servicio={r} onFotos={r.fotos > 0 ? onFotos : () => {}} />
                {t("reg.gallery")}
              </span>
            )}
            {fila.enVivo && verSeguimiento && <Segui id={fila.id} className="!px-4 !py-2 !text-[13px]" />}
            <ContactarUfficio numero={contacto} texto={`Ciao, ho una domanda sul servizio ${fila.codigo || r.codigo} (${fila.destino}, ${formatFechaHora(r.etaPlan)}).`} />
            <Button variant="ghost" className="!w-auto px-4 py-2 text-[13px]" onClick={() => setEditando(true)}>
              {t("reg.editData")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-ink-300">{t("reg.editHint")}</p>
          {r.estado === "CONSEGNATO" && <p className="mb-3 rounded-xl bg-warning-500/10 px-3 py-2 text-[13px] text-warning-500">{t("reg.deliveredWarn")}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField id="vs-shipment" label={extra ? "Codice" : "Shipment"} value={valores.shipment} onChange={(e) => setCampo("shipment", e.target.value)} />
            <TextField id="vs-order" label={extra ? "Secondo codice" : "Order"} value={valores.orderNumero} onChange={(e) => setCampo("orderNumero", e.target.value)} />
            {!extra && (
              <Select
                id="vs-tipo"
                label="Tipo"
                value={valores.tipoPedido}
                onChange={(e) => setCampo("tipoPedido", e.target.value)}
                options={[
                  { value: "", label: "—" },
                  { value: "ASAP", label: "ASAP" },
                  { value: "SCHEDULED", label: "SCHEDULED" },
                ]}
              />
            )}
            <TextField id="vs-ciudad" label={extra ? "Consegna" : "Città"} value={valores.ciudad} onChange={(e) => setCampo("ciudad", e.target.value)} />
            <TextField id="vs-eta" label="ETA" type="datetime-local" value={valores.eta} onChange={(e) => setCampo("eta", e.target.value)} />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button className="!w-auto px-5 py-2 text-[13px]" loading={guardando} onClick={guardar}>
              {t("reg.saveChanges")}
            </Button>
            <Button
              variant="ghost"
              className="!w-auto px-4 py-2 text-[13px]"
              disabled={guardando}
              onClick={() => {
                setEditando(false);
                setValores(inicial);
                setError("");
              }}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </>
      )}
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
COLUMNAS.EXTRA_PIAZZA = [
  col("codigo", "Codice", (s) => [s.shipment, s.orderNumero].filter(Boolean).join(" / ")),
  COL_CLIENTE,
  col("ritiro", "Ritiro", (s) => s.ritiro ?? ""),
  col("destinazione", "Consegna", (s) => s.destinazione),
  COL_FECHA,
  col("km", "KM", (s) => kmDeSolicitud(s) ?? "", { align: "right" }),
];

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
  const { language } = useLanguage();
  const { user } = useAuth();
  // Registro e Historial son una sola vista: con el modulo HISTORIAL, a las solicitudes se suman los servicios ya hechos (la misma hoja).
  const verHistorial = Boolean(user?.clienteModulos?.includes("HISTORIAL"));
  const verFotos = Boolean(user?.clienteModulos?.includes("FOTOS"));
  // La alerta de ETA usa el GPS en vivo (mismo seguimiento del cliente); sin ese modulo se juzga solo por la hora.
  const verSeguimiento = Boolean(user?.clienteModulos?.some((m) => m === "MAPA" || m === "LISTA"));
  const [month, setMonth] = useState(currentMonth);
  const [servicio, setServicio] = useState("DHL_MILANO");
  const [items, setItems] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [seguimiento, setSeguimiento] = useState(null);
  const [fotosDe, setFotosDe] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null); // null | { solicitud?: Solicitud }
  const [selectedId, setSelectedId] = useState(null);
  const [servicioSel, setServicioSel] = useState(null);
  const [contacto, setContacto] = useState(null);
  // Desde Disponibilita ("Richiedi" en un dia libre): abre el registro nuevo ya con ese dia.
  const location = useLocation();
  const navigate = useNavigate();
  const nuevaPara = location.state?.nuevaPara ?? null;
  useEffect(() => {
    if (!nuevaPara) return;
    setMonth(nuevaPara.slice(0, 7));
    setForm({ dia: nuevaPara });
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nuevaPara]);

  const load = useCallback(
    () =>
      Promise.all([
        listSolicitudesClienteRequest(month),
        // Si el historial falla, las solicitudes se siguen viendo.
        verHistorial ? getClienteServiciosRequest(month).then((r) => r.servicios).catch(() => []) : Promise.resolve([]),
        verSeguimiento ? getClienteSeguimientoRequest().catch(() => null) : Promise.resolve(null),
      ])
        .then(([list, hechos, seg]) => {
          setItems(list);
          setServicios(hechos);
          setSeguimiento(seg);
          setError("");
        })
        .catch((err) => setError(parseApiError(err).message)),
    [month, verHistorial, verSeguimiento]
  );

  // Numero de WhatsApp de la oficina (si esta configurado en el servidor).
  useEffect(() => {
    getClienteMeRequest()
      .then((me) => setContacto(me?.contactoWhatsapp ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setItems(null);
    load();
    return startVisibleInterval(load, REFRESH_MS);
  }, [load]);

  const porServicio = useMemo(() => Object.fromEntries(SOLICITUD_SERVICIOS.map((t) => [t.value, (items ?? []).filter((s) => s.servicio === t.value)])), [items]);
  const serviciosPorTipo = useMemo(
    () => Object.fromEntries(SOLICITUD_SERVICIOS.map((t) => [t.value, servicios.filter((r) => tipoDeServicio(r) === t.value)])),
    [servicios]
  );
  // Una solicitud aceptada cuyo servicio ya esta en la lista no se repite: se ve el servicio.
  const visibles = useMemo(() => {
    const ids = new Set(servicios.map((r) => r.id));
    return Object.fromEntries(SOLICITUD_SERVICIOS.map((t) => [t.value, porServicio[t.value].filter((s) => !(s.recordId && ids.has(s.recordId)))]));
  }, [porServicio, servicios]);

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
          <ContactarUfficio numero={contacto} />
          <Button className="!w-auto px-5 py-2.5" onClick={() => setForm({})}>
            <PlusIcon className="h-4 w-4" />
            {t("reg.new")}
          </Button>
        </div>
      </div>

      {MOSTRAR_HOJA_EXCEL && (
      <div role="tablist" aria-label={t("reg.services")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
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
            {items && <span className="ml-1.5 opacity-70">{visibles[t.value].length + serviciosPorTipo[t.value].length}</span>}
          </button>
        ))}
      </div>
      )}

      <Alert>{error}</Alert>
      {!items && !error && <PageLoader />}
      {items && !MOSTRAR_HOJA_EXCEL && (
        <RegistroLista
          solicitudes={items}
          servicios={servicios}
          seguimiento={seguimiento}
          month={month}
          areaInicial={location.state?.area ?? undefined}
          verFotos={verFotos}
          verSeguimiento={verSeguimiento}
          onOpenSolicitud={setSelectedId}
          onOpenServicio={setServicioSel}
          onFotos={setFotosDe}
        />
      )}
      {items && MOSTRAR_HOJA_EXCEL && HOJAS[servicio] && (
        <>
          {/* Escritorio: la hoja tipo Google Sheets con las solicitudes y los servicios. En el celular, las tablas de siempre. */}
          <div className="hidden lg:block">
            <HojaMixta
              solicitudes={porServicio[servicio]}
              servicios={serviciosPorTipo[servicio]}
              onOpen={setSelectedId}
              verFotos={verFotos}
              estadoTexto={(r) => estadoTexto(r, t, language)}
              variante={HOJAS[servicio]}
              editable
              onCambio={load}
              vacio="Nessuna richiesta o servizio per questo mese."
            />
          </div>
          <div className="flex flex-col gap-4 lg:hidden">
            <TablaRegistros items={visibles[servicio]} servicio={servicio} onSelect={setSelectedId} />
            {serviciosPorTipo[servicio].length > 0 && <TablaServicios servicios={serviciosPorTipo[servicio]} verFotos={verFotos} onFotos={setFotosDe} />}
          </div>
        </>
      )}
      {items && MOSTRAR_HOJA_EXCEL && !HOJAS[servicio] && (
        <div className="flex flex-col gap-4">
          <TablaRegistros items={visibles[servicio]} servicio={servicio} onSelect={setSelectedId} />
          {serviciosPorTipo[servicio].length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-[14px] font-semibold text-ink-100">Servizi</h2>
              <TablaServicios servicios={serviciosPorTipo[servicio]} verFotos={verFotos} onFotos={setFotosDe} />
            </div>
          )}
        </div>
      )}

      {/* Pestanas de hoja, como en Excel / Google Sheets: abajo, siempre a la vista, una por tipo de servicio. */}
      {MOSTRAR_HOJA_EXCEL && (
      <div
        role="tablist"
        aria-label={t("reg.services")}
        className="sticky bottom-0 z-20 -mx-4 hidden items-end gap-0.5 border-t border-line/30 bg-popover px-4 lg:-mx-6 lg:flex lg:px-6"
      >
        {SOLICITUD_SERVICIOS.map((tab) => {
          const activa = servicio === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => setServicio(tab.value)}
              className={clsx(
                "-mt-px rounded-b-md border border-t-0 px-5 py-2 text-[13px] transition-colors",
                activa
                  ? "border-line/40 bg-line/15 font-semibold text-ink-50 shadow-[inset_0_-3px_0_0_#1a73e8]"
                  : "border-transparent font-medium text-ink-300 hover:bg-line/10 hover:text-ink-50"
              )}
            >
              {tab.label}
              {items && <span className="ml-1.5 opacity-60">{visibles[tab.value].length + serviciosPorTipo[tab.value].length}</span>}
            </button>
          );
        })}
      </div>
      )}

      {selected && !form && (
        <VistaRapida
          solicitud={selected}
          contacto={contacto}
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
          {form.solicitud ? (
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
          ) : (
            // Registrar nuevo: solo el texto. La fila aparece en la hoja (lo que falte, en rojo) y se completa y edita ahi.
            <RegistroDesdeTexto
              servicioInicial={servicio}
              dia={form.dia}
              onCancel={() => setForm(null)}
              onRegistered={(saved) => {
                setForm(null);
                setServicio(saved.servicio);
                const savedMonth = new Date(saved.fechaHora).toLocaleDateString("en-CA", { timeZone: "Europe/Rome" }).slice(0, 7);
                if (savedMonth !== month) setMonth(savedMonth);
                else load();
              }}
            />
          )}
        </Modal>
      )}

      {servicioSel && (
        <VistaServicio
          fila={servicioSel}
          contacto={contacto}
          verFotos={verFotos}
          verSeguimiento={verSeguimiento}
          onClose={() => setServicioSel(null)}
          onFotos={setFotosDe}
          onSaved={() => {
            setServicioSel(null);
            load();
          }}
        />
      )}

      {fotosDe && <FotosModal servicio={fotosDe} onClose={() => setFotosDe(null)} />}
    </div>
  );
};
