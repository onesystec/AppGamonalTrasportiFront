import clsx from "clsx";
import { Fragment, useEffect, useState } from "react";
import { parseApiError } from "../../lib/api";
import { getClienteFotosRequest } from "../../lib/cliente.api";
import { PUNTO_ESTADO } from "../cliente/TablaServicios";
import { formatFechaHora, kmDeSolicitud } from "../../lib/solicitudes";
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
  titulo: "SHIPMENT/ORDER",
  ancho: AJUSTADA,
  clase: "whitespace-nowrap",
  render: (s) => <CeldaShipmentOrder s={s} />,
  falta: (s) => !(s.shipment && s.orderNumero),
  aviso: (s) => (!s.shipment && !s.orderNumero ? "Mancano Shipment e Order" : !s.shipment ? "Manca lo Shipment" : "Manca l'Order"),
};
const COL_TIPO = { id: "B", titulo: "TIPO", ancho: AJUSTADA, clase: "whitespace-nowrap text-center font-semibold", render: (s) => s.tipoPedido ?? "", falta: (s) => !s.tipoPedido, aviso: () => "Manca il tipo (ASAP o SCHEDULED)" };
const COL_CLIENTE = { id: "C", titulo: "CLIENTE", ancho: "min-w-[140px]", clase: "break-words", render: (s) => s.cliente, falta: (s) => !s.cliente, aviso: () => "Manca il cliente" };
const COL_CIUDAD = { id: "D", titulo: "CIUDAD", ancho: "min-w-[140px]", clase: "break-words", render: (s) => s.ciudad, falta: (s) => !s.ciudad, aviso: () => "Manca la città" };
const COL_ETA = { id: "E", titulo: "ETA", ancho: AJUSTADA, clase: "whitespace-nowrap", render: (s) => formatFechaHora(s.eta), falta: (s) => !s.eta, aviso: () => "Manca l'ETA" };
const COL_KM = { id: "F", titulo: "KM", ancho: AJUSTADA, clase: "whitespace-nowrap text-right", render: (s) => s.km ?? "", falta: (s) => s.km == null || s.km === "", aviso: () => "Mancano i km" };
const colNumero = (zona) => ({
  id: "G",
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
const COL_CODIGO = { id: "A", titulo: "CODICE", ancho: AJUSTADA, clase: "whitespace-nowrap", render: (s) => <CeldaCodigos s={s} />, falta: (s) => !s.shipment, aviso: () => "Manca il codice" };
const COL_RITIRO = { id: "R", titulo: "RITIRO", ancho: "min-w-[160px]", clase: "break-words", render: (s) => s.ritiro ?? "", falta: (s) => !s.ritiro, aviso: () => "Manca il luogo di ritiro" };
const COL_CONSEGNA = { id: "D", titulo: "CONSEGNA", ancho: "min-w-[160px]", clase: "break-words", render: (s) => s.ciudad, falta: (s) => !s.ciudad, aviso: () => "Manca il luogo di consegna" };

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

export const HojaServicios = ({ rows, onOpen, verFotos, loadDetalle, variante = "dhl", vacio = "Nessun servizio per questo mese." }) => {
  // Cada servicio tiene sus columnas: AB Service no usa el numero de Milano; en Roma la ultima columna es ROMA; Extra Piazza lleva CODICE, RITIRO y CONSEGNA.
  const columnas = columnasDe(variante);
  const [seleccion, setSeleccion] = useState(null); // `${id}:${columna}`
  const [abierta, setAbierta] = useState(null); // id de la fila extendida
  const [detalles, setDetalles] = useState({}); // id -> { loading, data, error }

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
      <div className="overflow-auto rounded-md border border-line/30 bg-popover">
        <table className="w-full border-collapse select-none text-left">
          <thead>
            {/* Letras de columna, como en Sheets */}
            <tr>
              <th className="sticky left-0 z-20 w-12 border border-line/25 bg-line/10" />
              {columnas.map((c, i) => (
                <th key={c.id} className={clsx("border border-line/25 bg-line/10 px-2 py-0.5 text-center text-[11px] font-normal text-ink-300", c.ancho)}>
                  {String.fromCharCode(65 + i)}
                </th>
              ))}
            </tr>
            {/* Fila 1: los titulos */}
            <tr>
              <th className="sticky left-0 z-20 border border-line/25 bg-line/10 text-center text-[11px] font-normal text-ink-300">1</th>
              {columnas.map((c) => (
                <th key={c.id} className="whitespace-nowrap border border-line/25 bg-line/[0.06] px-2 py-1.5 text-left text-[12px] font-bold text-ink-50">
                  {c.titulo}
                </th>
              ))}
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
                    {columnas.map((c) => (
                      <td
                        key={c.id}
                        className={clsx(celda(s.id, c.id, falta), c.clase, c.claseFila?.(s))}
                        title={falta[c.id] ? c.aviso(s) : c.titulo_fila?.(s)}
                        onClick={() => setSeleccion(`${s.id}:${c.id}`)}
                      >
                        {c.render(s)}
                      </td>
                    ))}
                  </tr>
                  {extendida && (
                    <tr>
                      <th className="sticky left-0 z-10 border border-line/25 bg-accent-500/25" />
                      <td colSpan={columnas.length} className="border border-line/25 bg-line/[0.04] px-4 py-3">
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
                <td colSpan={columnas.length} className="border border-line/25 px-3 py-6 text-center text-[13px] text-ink-300">
                  {vacio}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-ink-400">
        Clicca sul numero di riga per vedere chofer, targa e bolla{onOpen ? " · doppio clic su una cella per aprire o modificare la richiesta" : ""}. Le celle in rosso hanno dati mancanti.
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
});

// La hoja unica de cada servicio (DHL Milano, DHL Roma, AB Service, Extra Piazza): las solicitudes del cliente (Registro) y los servicios ya hechos (Historial) en la misma tabla. Una solicitud aceptada
// cuyo servicio ya esta en la lista no se repite (se ve el servicio); si el servicio quedo fuera (otro mes, otra empresa), se sigue viendo la solicitud.
export const HojaMixta = ({ solicitudes = [], servicios = [], onOpen, verFotos, estadoTexto, vacio, variante = "dhl" }) => {
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
  return <HojaServicios rows={rows} onOpen={onOpen} verFotos={verFotos} loadDetalle={loadDetalle} variante={variante} vacio={vacio} />;
};

// Solo solicitudes (el usuario sin acceso al historial).
export const HojaDhlMilano = ({ items, onOpen, verFotos }) => (
  <HojaMixta solicitudes={items} onOpen={onOpen} verFotos={verFotos} vacio="Nessuna richiesta per questo mese." />
);
