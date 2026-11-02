import clsx from "clsx";
import { Fragment, useEffect, useRef, useState } from "react";
import { parseApiError } from "../../lib/api";
import { editarCeldaRequest, getClienteFotosRequest, getHojaAnchosRequest, saveHojaAnchosRequest } from "../../lib/cliente.api";
import { PUNTO_ESTADO } from "../cliente/TablaServicios";
import { formatFechaHora, kmDeSolicitud, toRomeInput } from "../../lib/solicitudes";
import { getDetalleSolicitudRequest } from "../../lib/solicitudes.api";

// Hoja con el aspecto de Google Sheets (letras de columna, numeros de fila, rejilla y celda seleccionada) para los servicios de DHL Milano y DHL Roma. Se usa en el
// Registro de Piazza (las solicitudes: HojaDhlMilano) y en el Historial de servicios (los servicios ya hechos: HojaServicios con sus propias filas).
// Columnas: SHIPMENT/ORDER (una sola celda, uno encima del otro), TIPO, CLIENTE, CIUDAD, ETA, KM y MILANO / ROMA (el numero asignado de la zona; AB no lo usa).
// Extra Piazza: CODICE, CLIENTE, RITIRO, CONSEGNA, ETA y KM.
// - Clic en el numero de fila (a la izquierda): la fila se extiende hacia abajo y muestra Chofer, Targa y la foto de retiro (bolla).
// - Clic en una celda: la selecciona. Doble clic (si hay onOpen): abre el registro.
// Una celda sin dato (o incompleta, como SHIPMENT/ORDER con solo uno de los dos) se pinta de rojo apagado para que se vea que falta completarla
// (salvo en las filas con omitirFaltantes: rechazadas o anuladas).
// Cada fila: { id, punto, puntoTitulo, shipment, orderNumero, tipoPedido, cliente, ciudad, eta, km, milano: { texto, propuesto }, sinAsignar, chofer, targa }.
// Las columnas cortas (A, B, E, F y G) miden lo que mide su contenido o su titulo (el que sea mas ancho); CLIENTE y CIUDAD se reparten el resto.
const AJUSTADA = "w-[1%] whitespace-nowrap";

const ESTADO_PUNTO = { PENDIENTE: "bg-warning-500", ACEPTADA: "bg-success-500", RECHAZADA: "bg-danger-500" };
const ESTADO_TITULO = { PENDIENTE: "In attesa", ACEPTADA: "Accettata", RECHAZADA: "Rifiutata" };

// "MILANO_12" -> "12", "ROMA_2" -> "2". Lo asignado por la oficina manda; si todavia no hay servicio, el numero que propuso el cliente (en tono suave).
const sinZona = (aplicativo) => aplicativo.replace(/^(?:MILANO|ROMA)_/, "");
const numeroMilano = (s) => {
  const asignado = s.asignado?.aplicativo;
  if (asignado) return { texto: sinZona(asignado), propuesto: false };
  if (s.aplicativo) return { texto: sinZona(s.aplicativo), propuesto: true };
  return { texto: "", propuesto: false };
};

// Shipment y Order en una sola celda: uno encima del otro, separados por "/".
const CeldaShipmentOrder = ({ s }) => {
  if (s.shipment || s.orderNumero) {
    return (
      <span className="flex flex-col leading-tight">
        <span>{s.shipment || "—"} /</span>
        <span>{s.orderNumero || "—"}</span>
      </span>
    );
  }
  return null;
};

// Extra Piazza: el codigo del servicio (o los dos, "S20602375 / S20602381"), uno encima del otro.
const CeldaCodigos = ({ s }) => {
  const codigos = [s.shipment, s.orderNumero].filter(Boolean);
  if (!codigos.length) return null;
  return (
    <span className="flex flex-col leading-tight">
      {codigos.map((c, i) => (
        <span key={c}>
          {c}
          {i < codigos.length - 1 ? " /" : ""}
        </span>
      ))}
    </span>
  );
};

// Las columnas: id (para la celda seleccionada), titulo, ancho, clase de la celda, que se dibuja, cuando "falta" el dato (celda roja) y su aviso.
const COL_SHIPMENT = {
  id: "A",
  campos: ["shipment", "orderNumero"],
  titulo: "SHIPMENT/ORDER",
  ancho: AJUSTADA,
  clase: "whitespace-nowrap",
  render: (s) => <CeldaShipmentOrder s={s} />,
  falta: (s) => !(s.shipment && s.orderNumero),
  aviso: (s) => (!s.shipment && !s.orderNumero ? "Mancano Shipment e Order" : !s.shipment ? "Manca lo Shipment" : "Manca l'Order"),
};
const COL_TIPO = { id: "B", campos: ["tipoPedido"], titulo: "TIPO", ancho: AJUSTADA, clase: "whitespace-nowrap text-center font-semibold", render: (s) => s.tipoPedido ?? "", falta: (s) => !s.tipoPedido, aviso: () => "Manca il tipo (ASAP o SCHEDULED)" };
const COL_CLIENTE = { id: "C", campos: ["cliente"], titulo: "CLIENTE", ancho: "min-w-[140px]", clase: "break-words", render: (s) => s.cliente, falta: (s) => !s.cliente, aviso: () => "Manca il cliente" };
const COL_CIUDAD = { id: "D", campos: ["ciudad"], titulo: "CIUDAD", ancho: "min-w-[140px]", clase: "break-words", render: (s) => s.ciudad, falta: (s) => !s.ciudad, aviso: () => "Manca la città" };
const COL_ETA = { id: "E", campos: ["eta"], titulo: "ETA", ancho: AJUSTADA, clase: "whitespace-nowrap", render: (s) => formatFechaHora(s.eta), falta: (s) => !s.eta, aviso: () => "Manca l'ETA" };
const COL_KM = { id: "F", campos: ["km"], titulo: "KM", ancho: AJUSTADA, clase: "whitespace-nowrap text-right", render: (s) => s.km ?? "", falta: (s) => s.km == null || s.km === "", aviso: () => "Mancano i km" };
const colNumero = (zona) => ({
  id: "G",
  campos: ["aplicativo"],
  titulo: zona.toUpperCase(),
  ancho: AJUSTADA,
  clase: "whitespace-nowrap text-center font-semibold",
  claseFila: (s) => s.milano?.propuesto && "font-normal italic text-ink-300",
  render: (s) => s.milano?.texto ?? "",
  falta: (s) => !s.milano?.texto,
  aviso: () => `Numero di ${zona} non ancora assegnato`,
  titulo_fila: (s) => (s.milano?.propuesto ? "Numero proposto: l'ufficio non lo ha ancora assegnato" : undefined),
});

// Extra Piazza: CODICE | CLIENTE | RITIRO | CONSEGNA | ETA | KM (el KM lo escribe una persona).
const COL_CODIGO = { id: "A", campos: ["shipment", "orderNumero"], titulo: "CODICE", ancho: AJUSTADA, clase: "whitespace-nowrap", render: (s) => <CeldaCodigos s={s} />, falta: (s) => !s.shipment, aviso: () => "Manca il codice" };
const COL_RITIRO = { id: "R", campos: ["ritiro"], titulo: "RITIRO", ancho: "min-w-[160px]", clase: "break-words", render: (s) => s.ritiro ?? "", falta: (s) => !s.ritiro, aviso: () => "Manca il luogo di ritiro" };
const COL_CONSEGNA = { id: "D", campos: ["ciudad"], titulo: "CONSEGNA", ancho: "min-w-[160px]", clase: "break-words", render: (s) => s.ciudad, falta: (s) => !s.ciudad, aviso: () => "Manca il luogo di consegna" };

const columnasDe = (variante) =>
  variante === "ab"
    ? [COL_SHIPMENT, COL_TIPO, COL_CLIENTE, COL_CIUDAD, COL_ETA, COL_KM]
    : variante === "extra"
      ? [COL_CODIGO, COL_CLIENTE, COL_RITIRO, COL_CONSEGNA, COL_ETA, COL_KM]
      : [COL_SHIPMENT, COL_TIPO, COL_CLIENTE, COL_CIUDAD, COL_ETA, COL_KM, colNumero(variante === "roma" ? "Roma" : "Milano")];

// Quien subio la solicitud y cuando (si la fila viene de una solicitud): una persona de la empresa del cliente o de la oficina.
const DatosCarga = ({ row }) =>
  row.creadoPor ? (
    <>
      <Dato titulo="Caricato da">
        {row.creadoPor}
        {row.creadoPorRol ? ` · ${row.creadoPorRol}` : ""}
      </Dato>
      {row.creadoAt && <Dato titulo="Caricato il">{formatFechaHora(row.creadoAt)}</Dato>}
    </>
  ) : null;

const Panel = ({ row, detalle, verFotos }) => {
  if (row.sinAsignar) {
    return (
      <div className="flex flex-wrap items-start gap-x-10 gap-y-2">
        <DatosCarga row={row} />
        {row.choferIndicado && <Dato titulo="Chofer (indicato)">{row.choferIndicado}</Dato>}
        <p className="text-[13px] text-ink-300">Non ancora assegnato: chofer, targa e bolla compaiono quando l'ufficio accetta la richiesta.</p>
      </div>
    );
  }
  if (!detalle || detalle.loading) return <p className="text-[13px] text-ink-300">Caricamento…</p>;
  if (detalle.error) return <p className="text-[13px] text-danger-500">{detalle.error}</p>;
  const { chofer, targa, bollas } = detalle.data;
  return (
    <div className="flex flex-wrap items-start gap-x-10 gap-y-3">
      <DatosCarga row={row} />
      <Dato titulo="Chofer">{chofer ?? "—"}</Dato>
      <Dato titulo="Targa">{targa ?? "—"}</Dato>
      {verFotos && (
        <Dato titulo="Foto de retiro (bolla)">
          {bollas.length === 0 ? (
            <span className="text-ink-300">Nessuna foto della bolla</span>
          ) : (
            <span className="flex flex-wrap gap-2">
              {bollas.map((b) => (
                <a key={b.id} href={b.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded border border-line/30 hover:border-accent-400">
                  {b.esPdf ? (
                    <span className="flex h-20 w-20 items-center justify-center bg-line/10 text-[12px] font-semibold text-ink-100">PDF</span>
                  ) : (
                    <img src={b.url} alt="Foto de retiro (bolla)" loading="lazy" className="h-20 w-20 object-cover" />
                  )}
                </a>
              ))}
            </span>
          )}
        </Dato>
      )}
    </div>
  );
};

const Dato = ({ titulo, children }) => (
  <div>
    <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-400">{titulo}</span>
    <span className="mt-0.5 block text-[14px] text-ink-50">{children}</span>
  </div>
);

// --- Edicion de celdas, como en Excel ---
// Seleccionar una celda y escribir la edita al instante: Enter guarda y baja, Tab guarda y pasa a la derecha, Esc cancela. Una solicitud pendiente se
// edita entera; un servicio ya creado, solo Shipment/Order, Tipo, Ciudad y ETA (lo demas es de la oficina; el servidor lo vuelve a comprobar).
const CAMPOS_SERVICIO = ["shipment", "orderNumero", "tipoPedido", "ciudad", "eta"];
const OPCIONES_TIPO = [
  { value: "", label: "—" },
  { value: "ASAP", label: "ASAP" },
  { value: "SCHEDULED", label: "SCHEDULED" },
];
const valorInicial = (s, campo) =>
  ({
    shipment: s.shipment,
    orderNumero: s.orderNumero,
    tipoPedido: s.tipoPedido,
    cliente: s.cliente,
    ciudad: s.ciudad,
    eta: toRomeInput(s.eta),
    km: s.km,
    aplicativo: s.milano?.texto,
    ritiro: s.ritiro,
  })[campo] ?? "";
const ETIQUETA_EDITOR = { shipment: "Shipment", orderNumero: "Order", ritiro: "Ritiro" };

const clasesEditor = "w-full min-w-0 bg-popover px-2 py-1.5 text-[13px] text-ink-50 outline-none disabled:opacity-60";

const EditorCelda = ({ columna, variante, inicial, guardando, onGuardar, onCancelar }) => {
  const [valores, setValores] = useState(inicial);
  const hecho = useRef(false);
  const primero = useRef(null);
  const campos = columna.campos;

  useEffect(() => {
    const el = primero.current;
    if (!el) return;
    el.focus();
    // El cursor al final del texto (como al editar en Excel).
    try {
      const n = el.value.length;
      el.setSelectionRange(n, n);
    } catch {
      // datetime-local y select no tienen seleccion de texto
    }
  }, []);

  const guardar = (mover, nuevos = valores) => {
    if (hecho.current) return;
    hecho.current = true;
    onGuardar(nuevos, mover);
  };
  const cancelar = () => {
    if (hecho.current) return;
    hecho.current = true;
    onCancelar();
  };
  const teclas = (e, ultimo = true) => {
    if (e.key === "Enter") {
      e.preventDefault();
      guardar("abajo");
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelar();
    } else if (e.key === "Tab" && ultimo) {
      e.preventDefault();
      guardar(e.shiftKey ? "izquierda" : "derecha");
    }
  };
  const cambiar = (campo) => (e) => setValores((prev) => ({ ...prev, [campo]: e.target.value }));

  // Listas (tipo y numero de zona): al elegir una opcion se guarda.
  const lista = (campo, opciones) => (
    <select
      ref={primero}
      value={valores[campo]}
      disabled={guardando}
      className={clasesEditor}
      onChange={(e) => guardar(null, { ...valores, [campo]: e.target.value })}
      onKeyDown={(e) => e.key === "Escape" && (e.preventDefault(), cancelar())}
      onBlur={() => guardar(null)}
    >
      {opciones.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );

  if (campos[0] === "tipoPedido") return lista("tipoPedido", OPCIONES_TIPO);
  if (campos[0] === "aplicativo") {
    const max = variante === "roma" ? 10 : 18;
    return lista("aplicativo", [{ value: "", label: "—" }, ...Array.from({ length: max }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))]);
  }
  return (
    <div className="flex flex-col" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && guardar(null)}>
      {campos.map((campo, i) => (
        <input
          key={campo}
          ref={i === 0 ? primero : undefined}
          type={campo === "eta" ? "datetime-local" : "text"}
          value={valores[campo]}
          disabled={guardando}
          placeholder={campos.length > 1 ? ETIQUETA_EDITOR[campo] : undefined}
          aria-label={ETIQUETA_EDITOR[campo] ?? columna.titulo}
          className={clsx(clasesEditor, i > 0 && "border-t border-line/25")}
          onChange={cambiar(campo)}
          onKeyDown={(e) => teclas(e, i === campos.length - 1)}
        />
      ))}
    </div>
  );
};

// Ancho de las columnas que ajusta quien usa la hoja (arrastrando el borde del titulo): se guarda en el servidor y lo ven todos los de la empresa.
// Con anchos guardados la tabla pasa a diseño fijo (como Excel: cada columna mide lo que dice y sobra espacio a la derecha); sin ellos, se ajusta sola.
const MIN_ANCHO = 30;
const MAX_ANCHO = 800;
const ANCHO_BASE = { A: 150, B: 100, C: 200, D: 200, E: 150, F: 70, G: 90, R: 200 };
const ANCHO_NUMERO_FILA = 48;
// Con anchos ajustados, si a la derecha de la tabla queda al menos este espacio libre, el detalle de una fila (chofer, targa, bolla) se abre alli.
const ANCHO_DETALLE_LATERAL = 320;
const useAnchosHoja = (variante) => {
  const [anchos, setAnchos] = useState({});
  const [aviso, setAviso] = useState(null); // { ok, texto } del ultimo guardado
  const ultimos = useRef({});
  ultimos.current = anchos;

  useEffect(() => {
    let cancelado = false;
    setAnchos({});
    getHojaAnchosRequest()
      .then((todos) => !cancelado && setAnchos(todos[variante] ?? {}))
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [variante]);

  const guardar = (nuevos) =>
    saveHojaAnchosRequest(variante, nuevos)
      .then(() => setAviso({ ok: true, texto: "Larghezza salvata per tutti." }))
      .catch((err) => setAviso({ ok: false, texto: parseApiError(err).message }));

  // Arrastrar el borde derecho del titulo: se ve el cambio mientras se mueve y se guarda al soltar. El primer arrastre fija el ancho que tiene
  // cada columna en ese momento (las demas no se mueven).
  const empezarArrastre = (e, id, columnas) => {
    e.preventDefault();
    e.stopPropagation();
    const celdas = [...e.currentTarget.parentElement.parentElement.children].slice(1);
    const actuales = Object.fromEntries(columnas.map((c, i) => [c.id, Math.round(celdas[i]?.getBoundingClientRect().width ?? ANCHO_BASE[c.id] ?? 120)]));
    const base = Object.fromEntries(Object.entries({ ...actuales, ...ultimos.current }).map(([k, v]) => [k, Math.min(MAX_ANCHO, Math.max(MIN_ANCHO, v))]));
    const inicio = base[id];
    const x0 = e.clientX;
    let ancho = inicio;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const mover = (ev) => {
      ancho = Math.min(MAX_ANCHO, Math.max(MIN_ANCHO, Math.round(inicio + ev.clientX - x0)));
      setAnchos({ ...base, [id]: ancho });
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      if (ancho !== inicio || Object.keys(ultimos.current).length === 0) guardar({ ...base, [id]: ancho });
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
  };

  // Doble clic en un borde: todas las columnas vuelven al ancho automatico.
  const restablecer = () => {
    setAnchos({});
    guardar({});
  };

  return { anchos, aviso, empezarArrastre, restablecer };
};

export const HojaServicios = ({ rows, onOpen, verFotos, loadDetalle, onEditar, variante = "dhl", vacio = "Nessun servizio per questo mese." }) => {
  // Cada servicio tiene sus columnas: AB Service no usa el numero de Milano; en Roma la ultima columna es ROMA; Extra Piazza lleva CODICE, RITIRO y CONSEGNA.
  const columnas = columnasDe(variante);
  const { anchos, aviso, empezarArrastre, restablecer } = useAnchosHoja(variante);
  const fija = Object.keys(anchos).length > 0;
  const anchoDe = (c) => anchos[c.id] ?? ANCHO_BASE[c.id] ?? 120;
  const anchoTabla = ANCHO_NUMERO_FILA + columnas.reduce((suma, c) => suma + anchoDe(c), 0);
  // Espacio libre a la derecha de la tabla (cuando las columnas se achicaron): ahi se muestra el detalle de la fila abierta, aprovechando el hueco.
  const contenedor = useRef(null);
  const [libre, setLibre] = useState(0);
  useEffect(() => {
    const el = contenedor.current;
    if (!el || !fija) {
      setLibre(0);
      return undefined;
    }
    const medir = () => setLibre(Math.max(0, el.clientWidth - anchoTabla));
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fija, anchoTabla]);
  const lateral = fija && libre >= ANCHO_DETALLE_LATERAL;
  const [seleccion, setSeleccion] = useState(null); // `${id}:${columna}`
  const [abierta, setAbierta] = useState(null); // id de la fila extendida
  const [detalles, setDetalles] = useState({}); // id -> { loading, data, error }
  const [editando, setEditando] = useState(null); // { rowId, colId, inicial, guardando }
  const [errorEdicion, setErrorEdicion] = useState("");

  // Una celda se puede editar si hay con que guardar (onEditar) y la fila lo permite: solicitud pendiente (todo) o servicio ya creado (solo algunos datos).
  const puedeEditar = (s, c) => Boolean(onEditar && s.editable && c.campos && (s.editable === "todo" || c.campos.every((f) => CAMPOS_SERVICIO.includes(f))));
  const enfocar = () => contenedor.current?.focus({ preventScroll: true });
  const seleccionar = (s, c) => {
    setSeleccion(`${s.id}:${c.id}`);
    enfocar();
  };
  // Despues de guardar, la seleccion se mueve como en Excel (abajo con Enter, a los lados con Tab).
  const moverSeleccion = (s, c, mover) => {
    const iFila = rows.findIndex((r) => r.id === s.id);
    const iCol = columnas.findIndex((x) => x.id === c.id);
    const fila = mover === "abajo" ? Math.min(rows.length - 1, iFila + 1) : iFila;
    const col = mover === "derecha" ? Math.min(columnas.length - 1, iCol + 1) : mover === "izquierda" ? Math.max(0, iCol - 1) : iCol;
    setSeleccion(`${rows[fila].id}:${columnas[col].id}`);
  };
  const empezarEdicion = (s, c, tecla = null) => {
    if (!puedeEditar(s, c)) return;
    const inicial = Object.fromEntries(c.campos.map((f) => [f, String(valorInicial(s, f) ?? "")]));
    // Escribir sobre una celda de texto reemplaza lo que tenia (como en Excel); Enter / F2 / doble clic conservan el texto.
    if (tecla != null && !["tipoPedido", "aplicativo", "eta"].includes(c.campos[0])) inicial[c.campos[0]] = tecla;
    setErrorEdicion("");
    setEditando({ rowId: s.id, colId: c.id, inicial, guardando: false });
  };
  const guardarEdicion = async (s, c, valores, mover) => {
    const cambios = {};
    for (const f of c.campos) if (String(valores[f] ?? "").trim() !== String(valorInicial(s, f) ?? "").trim()) cambios[f] = valores[f];
    if (Object.keys(cambios).length === 0) {
      setEditando(null);
      if (mover) moverSeleccion(s, c, mover);
      enfocar();
      return;
    }
    setEditando((prev) => ({ ...prev, guardando: true }));
    try {
      await onEditar(s, cambios);
      setEditando(null);
      if (mover) moverSeleccion(s, c, mover);
    } catch (err) {
      setEditando(null);
      setErrorEdicion(parseApiError(err).message);
    }
    enfocar();
  };
  // Teclado sobre la hoja (con una celda seleccionada y sin editar): flechas y Tab para moverse, Enter / F2 para editar, escribir para reemplazar, Supr para borrar.
  const teclado = (e) => {
    if (editando || !seleccion) return;
    const [rowId, colId] = seleccion.split(":");
    const iFila = rows.findIndex((r) => r.id === rowId);
    const iCol = columnas.findIndex((x) => x.id === colId);
    if (iFila < 0 || iCol < 0) return;
    const s = rows[iFila];
    const c = columnas[iCol];
    const ir = (f, k) => {
      e.preventDefault();
      setSeleccion(`${rows[f].id}:${columnas[k].id}`);
    };
    if (e.key === "ArrowDown" && iFila < rows.length - 1) ir(iFila + 1, iCol);
    else if (e.key === "ArrowUp" && iFila > 0) ir(iFila - 1, iCol);
    else if (e.key === "ArrowRight" && iCol < columnas.length - 1) ir(iFila, iCol + 1);
    else if (e.key === "ArrowLeft" && iCol > 0) ir(iFila, iCol - 1);
    else if (e.key === "Tab" && !e.shiftKey && iCol < columnas.length - 1) ir(iFila, iCol + 1);
    else if (e.key === "Tab" && e.shiftKey && iCol > 0) ir(iFila, iCol - 1);
    else if ((e.key === "Enter" || e.key === "F2") && puedeEditar(s, c)) {
      e.preventDefault();
      empezarEdicion(s, c);
    } else if ((e.key === "Delete" || e.key === "Backspace") && puedeEditar(s, c) && c.campos.length === 1) {
      e.preventDefault();
      guardarEdicion(s, c, { [c.campos[0]]: "" }, null);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && puedeEditar(s, c)) {
      e.preventDefault();
      empezarEdicion(s, c, e.key);
    }
  };

  // Al extender una fila se pide su detalle (chofer, targa, fotos de la bolla) una sola vez.
  useEffect(() => {
    const row = rows.find((x) => x.id === abierta);
    if (!row || row.sinAsignar || detalles[row.id]) return;
    setDetalles((prev) => ({ ...prev, [row.id]: { loading: true } }));
    loadDetalle(row)
      .then((data) => setDetalles((prev) => ({ ...prev, [row.id]: { data } })))
      .catch((err) => setDetalles((prev) => ({ ...prev, [row.id]: { error: parseApiError(err).message } })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, rows]);

  const celda = (id, col, falta) =>
    clsx(
      "border border-line/25 px-2 py-1.5 align-middle text-[13px] text-ink-50",
      falta?.[col] && "bg-danger-500/20",
      seleccion === `${id}:${col}` && "outline outline-2 -outline-offset-1 outline-[#1a73e8]"
    );

  return (
    <div>
      <div ref={contenedor} tabIndex={0} onKeyDown={teclado} className="overflow-auto rounded-md border border-line/30 bg-popover outline-none">
        <table
          className={clsx("border-collapse select-none text-left", !fija && "w-full")}
          style={fija ? { tableLayout: "fixed", width: "100%", minWidth: anchoTabla } : undefined}
        >
          {fija && (
            <colgroup>
              <col style={{ width: ANCHO_NUMERO_FILA }} />
              {columnas.map((c) => (
                <col key={c.id} style={{ width: anchoDe(c) }} />
              ))}
              {/* Columna de relleno: se queda con el espacio que sobra a la derecha */}
              <col />
            </colgroup>
          )}
          <thead>
            {/* Letras de columna, como en Sheets */}
            <tr>
              <th className="sticky left-0 z-20 w-12 border border-line/25 bg-line/10" />
              {columnas.map((c, i) => (
                <th key={c.id} className={clsx("border border-line/25 bg-line/10 px-2 py-0.5 text-center text-[11px] font-normal text-ink-300", c.ancho)}>
                  {String.fromCharCode(65 + i)}
                </th>
              ))}
              {fija && <th className="border-0 p-0" />}
            </tr>
            {/* Fila 1: los titulos */}
            <tr>
              <th className="sticky left-0 z-20 border border-line/25 bg-line/10 text-center text-[11px] font-normal text-ink-300">1</th>
              {columnas.map((c) => (
                <th key={c.id} className={clsx("relative whitespace-nowrap border border-line/25 bg-line/[0.06] px-2 py-1.5 text-left text-[12px] font-bold text-ink-50", fija && "overflow-hidden text-ellipsis")}>
                  {c.titulo}
                  {/* Borde para cambiar el ancho: arrastrar; doble clic = ancho automatico */}
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    title="Trascina per cambiare la larghezza · doppio clic: ripristina tutte"
                    onPointerDown={(e) => empezarArrastre(e, c.id, columnas)}
                    onDoubleClick={restablecer}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none hover:bg-[#1a73e8]/60"
                  />
                </th>
              ))}
              {fija && <th className="border-0 p-0" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const extendida = abierta === s.id;
              // Que celdas se pintan de rojo (faltan datos); en las filas rechazadas o anuladas no se avisa.
              const falta = Object.fromEntries(columnas.map((c) => [c.id, !s.omitirFaltantes && c.falta(s)]));
              return (
                <Fragment key={s.id}>
                  <tr className="hover:bg-line/[0.04]" onDoubleClick={onOpen && s.abrible !== false ? () => onOpen(s.id) : undefined}>
                    <th
                      scope="row"
                      onClick={() => setAbierta(extendida ? null : s.id)}
                      title={`${s.puntoTitulo ?? ""} · clic para ver chofer, targa y bolla`}
                      className={clsx(
                        "sticky left-0 z-10 w-12 cursor-pointer border border-line/25 text-center text-[11px] font-normal transition-colors",
                        extendida ? "bg-accent-500/25 text-ink-50" : "bg-line/10 text-ink-300 hover:bg-line/20"
                      )}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        <span className={clsx("h-1.5 w-1.5 rounded-full", s.punto ?? "bg-line")} />
                        {i + 2}
                        <span className={clsx("text-[9px] transition-transform", extendida && "rotate-90")}>▶</span>
                      </span>
                    </th>
                    {columnas.map((c) => {
                      const enEdicion = editando?.rowId === s.id && editando.colId === c.id;
                      return (
                        <td
                          key={c.id}
                          className={clsx(celda(s.id, c.id, falta), c.clase, c.claseFila?.(s), fija && "!whitespace-normal break-words", enEdicion && "!p-0")}
                          title={falta[c.id] ? c.aviso(s) : c.titulo_fila?.(s)}
                          onClick={() => seleccionar(s, c)}
                          onDoubleClick={(e) => {
                            // Una celda editable se edita con doble clic; las demas siguen abriendo la solicitud (doble clic en la fila).
                            if (puedeEditar(s, c)) {
                              e.stopPropagation();
                              empezarEdicion(s, c);
                            }
                          }}
                        >
                          {enEdicion ? (
                            <EditorCelda
                              columna={c}
                              variante={variante}
                              inicial={editando.inicial}
                              guardando={editando.guardando}
                              onGuardar={(valores, mover) => guardarEdicion(s, c, valores, mover)}
                              onCancelar={() => {
                                setEditando(null);
                                enfocar();
                              }}
                            />
                          ) : (
                            c.render(s)
                          )}
                        </td>
                      );
                    })}
                    {/* Con espacio libre a la derecha, el detalle de la fila abierta se muestra aqui (sobre el hueco, sin mover las demas filas). */}
                    {fija && (
                      <td className="relative border-0 p-0 align-top">
                        {extendida && lateral && (
                          <div className="absolute left-2 top-1 z-10 w-[calc(100%-1rem)] rounded-md border border-line/30 bg-popover p-3 shadow-lg">
                            <Panel row={s} detalle={detalles[s.id]} verFotos={verFotos} />
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                  {extendida && !lateral && (
                    <tr>
                      <th className="sticky left-0 z-10 border border-line/25 bg-accent-500/25" />
                      <td colSpan={columnas.length + (fija ? 1 : 0)} className="border border-line/25 bg-line/[0.04] px-4 py-3">
                        <Panel row={s} detalle={detalles[s.id]} verFotos={verFotos} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <th className="sticky left-0 z-10 border border-line/25 bg-line/10 text-center text-[11px] font-normal text-ink-300">2</th>
                <td colSpan={columnas.length + (fija ? 1 : 0)} className="border border-line/25 px-3 py-6 text-center text-[13px] text-ink-300">
                  {vacio}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {errorEdicion && <p className="mt-2 text-[13px] text-danger-500">{errorEdicion}</p>}
      <p className="mt-2 text-[12px] text-ink-400">
        Clicca sul numero di riga per vedere chofer, targa e bolla.{" "}
        {onEditar
          ? "Seleziona una cella e scrivi per modificarla: Invio salva, Tab passa alla cella accanto, Esc annulla. Un servizio già creato permette di cambiare solo Shipment/Order, Tipo, Città ed ETA."
          : onOpen
            ? "Doppio clic su una cella per aprire o modificare la richiesta."
            : ""}{" "}
        Le celle in rosso hanno dati mancanti. Trascina il bordo di un titolo per cambiare la larghezza della colonna (vale per tutti).
        {aviso && <span className={aviso.ok ? "ml-2 text-success-500" : "ml-2 text-danger-500"}>{aviso.texto}</span>}
      </p>
    </div>
  );
};

// Una solicitud del cliente como fila de la hoja. El detalle (chofer, targa y bolla) existe solo cuando la oficina ya la acepto.
export const filaDeSolicitud = (s) => ({
  id: s.id,
  origen: "solicitud",
  abrible: true,
  punto: ESTADO_PUNTO[s.estado],
  puntoTitulo: ESTADO_TITULO[s.estado] ?? s.estado,
  shipment: s.shipment,
  orderNumero: s.orderNumero,
  ritiro: s.ritiro,
  tipoPedido: s.tipoPedido,
  cliente: s.cliente,
  ciudad: s.destinazione,
  eta: s.fechaHora,
  km: kmDeSolicitud(s),
  milano: numeroMilano(s),
  sinAsignar: s.estado !== "ACEPTADA",
  choferIndicado: s.choferIndicado,
  creadoPor: s.creadoPor,
  creadoPorRol: s.creadoPorRol,
  creadoAt: s.createdAt,
  omitirFaltantes: s.estado === "RECHAZADA",
  // Pendiente: se edita todo; aceptada: es ese servicio (solo algunos datos); rechazada: nada.
  editable: s.estado === "PENDIENTE" ? "todo" : s.estado === "ACEPTADA" ? "servicio" : false,
});

// Un servicio ya hecho (el historial) como fila de la hoja: de solo lectura, con el chofer y la targa que ya trae.
// "solicitud": la que lo origino (si esta en la lista): le presta el codigo y el ritiro que el servicio real no guarda.
export const filaDeServicio = (s, puntoTitulo, solicitud) => ({
  id: s.id,
  origen: "servicio",
  abrible: false,
  punto: PUNTO_ESTADO[s.estado] ?? "bg-accent-400",
  puntoTitulo,
  shipment: s.shipment ?? solicitud?.shipment,
  orderNumero: s.orderNumero ?? solicitud?.orderNumero,
  ritiro: solicitud?.ritiro ?? null,
  creadoPor: solicitud?.creadoPor,
  creadoPorRol: solicitud?.creadoPorRol,
  creadoAt: solicitud?.createdAt,
  tipoPedido: s.tipoPedido,
  cliente: s.cliente ?? "",
  ciudad: s.ciudad ?? "",
  eta: s.etaPlan,
  km: s.km != null ? String(Math.round(s.km * 10) / 10).replace(".", ",") : null,
  milano: { texto: s.aplicativo ? sinZona(s.aplicativo) : "", propuesto: false },
  sinAsignar: false,
  chofer: s.chofer,
  targa: s.targa,
  omitirFaltantes: s.estado === "ANNULLATO",
  editable: "servicio",
});

// La hoja unica de cada servicio (DHL Milano, DHL Roma, AB Service, Extra Piazza): las solicitudes del cliente (Registro) y los servicios ya hechos (Historial) en la misma tabla. Una solicitud aceptada
// cuyo servicio ya esta en la lista no se repite (se ve el servicio); si el servicio quedo fuera (otro mes, otra empresa), se sigue viendo la solicitud.
// editable + onCambio: la hoja se puede editar (Registro del cliente) y onCambio recarga los datos despues de guardar.
export const HojaMixta = ({ solicitudes = [], servicios = [], onOpen, verFotos, estadoTexto, vacio, variante = "dhl", editable = false, onCambio }) => {
  const idsServicios = new Set(servicios.map((r) => r.id));
  const porRecord = new Map(solicitudes.filter((s) => s.recordId).map((s) => [s.recordId, s]));
  const rows = [
    ...solicitudes.filter((s) => !(s.recordId && idsServicios.has(s.recordId))).map(filaDeSolicitud),
    ...servicios.map((r) => filaDeServicio(r, estadoTexto ? estadoTexto(r) : r.estadoLabel, porRecord.get(r.id))),
  ].sort((a, b) => new Date(b.eta) - new Date(a.eta));

  const loadDetalle = async (row) => {
    if (row.origen === "solicitud") {
      const { asignado, bollas } = await getDetalleSolicitudRequest(row.id);
      return { chofer: asignado?.chofer ?? null, targa: asignado?.targa ?? null, bollas };
    }
    const fotos = verFotos ? await getClienteFotosRequest(row.id) : [];
    return {
      chofer: row.chofer,
      targa: row.targa,
      bollas: fotos.filter((f) => f.codigo === "BOLLA").map((f) => ({ id: f.id, url: f.url, esPdf: f.esPdf })),
    };
  };
  const onEditar = editable
    ? async (row, cambios) => {
        await editarCeldaRequest({ origen: row.origen, id: row.id, cambios });
        await onCambio?.();
      }
    : undefined;
  return <HojaServicios rows={rows} onOpen={onOpen} verFotos={verFotos} loadDetalle={loadDetalle} onEditar={onEditar} variante={variante} vacio={vacio} />;
};

// Solo solicitudes (el usuario sin acceso al historial).
export const HojaDhlMilano = ({ items, onOpen, verFotos }) => (
  <HojaMixta solicitudes={items} onOpen={onOpen} verFotos={verFotos} vacio="Nessuna richiesta per questo mese." />
);
