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
// - Clic en el numero de fila (a la izquierda): la fila se extiende hacia abajo y muestra Chofer, Targa y la foto de retiro (bolla).
// - Clic en una celda: la selecciona. Doble clic (si hay onOpen): abre el registro.
// Una celda sin dato (o incompleta, como SHIPMENT/ORDER con solo uno de los dos) se pinta de rojo apagado para que se vea que falta completarla
// (salvo en las filas con omitirFaltantes: rechazadas o anuladas).
// Cada fila: { id, punto, puntoTitulo, shipment, orderNumero, tipoPedido, cliente, ciudad, eta, km, milano: { texto, propuesto }, sinAsignar, chofer, targa }.
// Las columnas cortas (A, B, E, F y G) miden lo que mide su contenido o su titulo (el que sea mas ancho); CLIENTE y CIUDAD se reparten el resto.
const AJUSTADA = "w-[1%] whitespace-nowrap";
const COLUMNAS = [
  { letra: "A", titulo: "SHIPMENT/ORDER", ancho: AJUSTADA },
  { letra: "B", titulo: "TIPO", ancho: AJUSTADA },
  { letra: "C", titulo: "CLIENTE", ancho: "min-w-[140px]" },
  { letra: "D", titulo: "CIUDAD", ancho: "min-w-[140px]" },
  { letra: "E", titulo: "ETA", ancho: AJUSTADA },
  { letra: "F", titulo: "KM", ancho: AJUSTADA },
  { letra: "G", titulo: "MILANO", ancho: AJUSTADA },
];

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

// Que datos faltan en una fila (por columna). Vacio = completa.
const faltantes = (s, variante) => {
  if (s.omitirFaltantes) return {};
  const km = s.km;
  return {
    A: !(s.shipment && s.orderNumero),
    B: !s.tipoPedido,
    C: !s.cliente,
    D: !s.ciudad,
    E: !s.eta,
    F: km == null || km === "",
    ...(variante === "ab" ? {} : { G: !s.milano?.texto }),
  };
};

const AVISO_FALTA = {
  A: (s) => (!s.shipment && !s.orderNumero ? "Mancano Shipment e Order" : !s.shipment ? "Manca lo Shipment" : "Manca l'Order"),
  B: () => "Manca il tipo (ASAP o SCHEDULED)",
  C: () => "Manca il cliente",
  D: () => "Manca la città",
  E: () => "Manca l'ETA",
  F: () => "Mancano i km",
  G: (s, variante) => (variante === "roma" ? "Numero di Roma non ancora assegnato" : "Numero di Milano non ancora assegnato"),
};

const Panel = ({ row, detalle, verFotos }) => {
  if (row.sinAsignar) {
    return (
      <div className="flex flex-wrap items-start gap-x-10 gap-y-2">
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
  // AB Service no usa el numero de Milano: sin la columna G. En Roma la columna se llama ROMA.
  const columnas = variante === "ab" ? COLUMNAS.filter((c) => c.letra !== "G") : COLUMNAS.map((c) => (c.letra === "G" && variante === "roma" ? { ...c, titulo: "ROMA" } : c));
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
              {columnas.map((c) => (
                <th key={c.letra} className={clsx("border border-line/25 bg-line/10 px-2 py-0.5 text-center text-[11px] font-normal text-ink-300", c.ancho)}>
                  {c.letra}
                </th>
              ))}
            </tr>
            {/* Fila 1: los titulos */}
            <tr>
              <th className="sticky left-0 z-20 border border-line/25 bg-line/10 text-center text-[11px] font-normal text-ink-300">1</th>
              {columnas.map((c) => (
                <th key={c.letra} className="whitespace-nowrap border border-line/25 bg-line/[0.06] px-2 py-1.5 text-left text-[12px] font-bold text-ink-50">
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const extendida = abierta === s.id;
              const falta = faltantes(s, variante);
              const tip = (col) => (falta[col] ? AVISO_FALTA[col](s, variante) : undefined);
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
                    <td className={clsx(celda(s.id, "A", falta), "whitespace-nowrap")} title={tip("A")} onClick={() => setSeleccion(`${s.id}:A`)}>
                      <CeldaShipmentOrder s={s} />
                    </td>
                    <td className={clsx(celda(s.id, "B", falta), "whitespace-nowrap text-center font-semibold")} title={tip("B")} onClick={() => setSeleccion(`${s.id}:B`)}>
                      {s.tipoPedido ?? ""}
                    </td>
                    <td className={clsx(celda(s.id, "C", falta), "break-words")} title={tip("C")} onClick={() => setSeleccion(`${s.id}:C`)}>
                      {s.cliente}
                    </td>
                    <td className={clsx(celda(s.id, "D", falta), "break-words")} title={tip("D")} onClick={() => setSeleccion(`${s.id}:D`)}>
                      {s.ciudad}
                    </td>
                    <td className={clsx(celda(s.id, "E", falta), "whitespace-nowrap")} title={tip("E")} onClick={() => setSeleccion(`${s.id}:E`)}>
                      {formatFechaHora(s.eta)}
                    </td>
                    <td className={clsx(celda(s.id, "F", falta), "whitespace-nowrap text-right")} title={tip("F")} onClick={() => setSeleccion(`${s.id}:F`)}>
                      {s.km ?? ""}
                    </td>
                    {variante !== "ab" && (
                      <td
                        className={clsx(celda(s.id, "G", falta), "whitespace-nowrap text-center font-semibold", s.milano?.propuesto && "font-normal italic text-ink-300")}
                        title={s.milano?.propuesto ? "Numero proposto: l'ufficio non lo ha ancora assegnato" : tip("G")}
                        onClick={() => setSeleccion(`${s.id}:G`)}
                      >
                        {s.milano?.texto ?? ""}
                      </td>
                    )}
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
  tipoPedido: s.tipoPedido,
  cliente: s.cliente,
  ciudad: s.destinazione,
  eta: s.fechaHora,
  km: kmDeSolicitud(s),
  milano: numeroMilano(s),
  sinAsignar: s.estado !== "ACEPTADA",
  choferIndicado: s.choferIndicado,
  omitirFaltantes: s.estado === "RECHAZADA",
});

// Un servicio ya hecho (el historial) como fila de la hoja: de solo lectura, con el chofer y la targa que ya trae.
export const filaDeServicio = (s, puntoTitulo) => ({
  id: s.id,
  origen: "servicio",
  abrible: false,
  punto: PUNTO_ESTADO[s.estado] ?? "bg-accent-400",
  puntoTitulo,
  shipment: s.shipment,
  orderNumero: s.orderNumero,
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

// La hoja unica de cada servicio (DHL Milano, DHL Roma, AB Service): las solicitudes del cliente (Registro) y los servicios ya hechos (Historial) en la misma tabla. Una solicitud aceptada
// cuyo servicio ya esta en la lista no se repite (se ve el servicio); si el servicio quedo fuera (otro mes, otra empresa), se sigue viendo la solicitud.
export const HojaMixta = ({ solicitudes = [], servicios = [], onOpen, verFotos, estadoTexto, vacio, variante = "dhl" }) => {
  const idsServicios = new Set(servicios.map((r) => r.id));
  const rows = [
    ...solicitudes.filter((s) => !(s.recordId && idsServicios.has(s.recordId))).map(filaDeSolicitud),
    ...servicios.map((r) => filaDeServicio(r, estadoTexto ? estadoTexto(r) : r.estadoLabel)),
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
