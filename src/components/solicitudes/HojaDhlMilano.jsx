import clsx from "clsx";
import { Fragment, useEffect, useState } from "react";
import { parseApiError } from "../../lib/api";
import { formatFechaHora, kmDeSolicitud } from "../../lib/solicitudes";
import { getDetalleSolicitudRequest } from "../../lib/solicitudes.api";

// DHL Milano del registro de Piazza, con el aspecto de una hoja de Google Sheets: letras de columna, numeros de fila, rejilla y celda seleccionada.
// Columnas: SHIPMENT/ORDER (una sola celda, uno encima del otro), TIPO, CLIENTE, CIUDAD, ETA, KM y MILANO (el numero de Milano asignado).
// - Clic en el numero de fila (a la izquierda): la fila se extiende hacia abajo y muestra Chofer, Targa y la foto de retiro (bolla).
// - Clic en una celda: la selecciona. Doble clic: abre el registro (ver, editar, borrar).
const COLUMNAS = [
  { letra: "A", titulo: "SHIPMENT/ORDER", ancho: "min-w-[150px]" },
  { letra: "B", titulo: "TIPO", ancho: "min-w-[110px]" },
  { letra: "C", titulo: "CLIENTE", ancho: "min-w-[170px]" },
  { letra: "D", titulo: "CIUDAD", ancho: "min-w-[150px]" },
  { letra: "E", titulo: "ETA", ancho: "min-w-[140px]" },
  { letra: "F", titulo: "KM", ancho: "min-w-[70px]" },
  { letra: "G", titulo: "MILANO", ancho: "min-w-[90px]" },
];

const ESTADO_PUNTO = { PENDIENTE: "bg-warning-500", ACEPTADA: "bg-success-500", RECHAZADA: "bg-danger-500" };
const ESTADO_TITULO = { PENDIENTE: "In attesa", ACEPTADA: "Accettata", RECHAZADA: "Rifiutata" };

// "MILANO_12" -> "12". Lo asignado por la oficina manda; si todavia no hay servicio, el numero que propuso el cliente (en tono suave).
const numeroMilano = (s) => {
  const asignado = s.asignado?.aplicativo;
  if (asignado) return { texto: asignado.replace("MILANO_", ""), propuesto: false };
  if (s.aplicativo) return { texto: s.aplicativo.replace("MILANO_", ""), propuesto: true };
  return { texto: "", propuesto: false };
};

// Shipment y Order en una sola celda: uno encima del otro, separados por "/".
const CeldaShipmentOrder = ({ s }) => {
  if (s.shipment && s.orderNumero) {
    return (
      <span className="flex flex-col leading-tight">
        <span>{s.shipment} /</span>
        <span>{s.orderNumero}</span>
      </span>
    );
  }
  return <span>{s.shipment || s.orderNumero || ""}</span>;
};

const Panel = ({ s, detalle, verFotos }) => {
  if (s.estado !== "ACEPTADA") {
    return <p className="text-[13px] text-ink-300">Non ancora assegnato: chofer, targa e bolla compaiono quando l'ufficio accetta la richiesta.</p>;
  }
  if (!detalle || detalle.loading) return <p className="text-[13px] text-ink-300">Caricamento…</p>;
  if (detalle.error) return <p className="text-[13px] text-danger-500">{detalle.error}</p>;
  const { asignado, bollas } = detalle.data;
  return (
    <div className="flex flex-wrap items-start gap-x-10 gap-y-3">
      <Dato titulo="Chofer">{asignado?.chofer ?? "—"}</Dato>
      <Dato titulo="Targa">{asignado?.targa ?? "—"}</Dato>
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

export const HojaDhlMilano = ({ items, onOpen, verFotos }) => {
  const [seleccion, setSeleccion] = useState(null); // `${id}:${columna}`
  const [abierta, setAbierta] = useState(null); // id de la fila extendida
  const [detalles, setDetalles] = useState({}); // id -> { loading, data, error }

  // Al extender una fila ya aceptada se pide su detalle (chofer, targa, fotos de la bolla) una sola vez.
  useEffect(() => {
    const s = items.find((x) => x.id === abierta);
    if (!s || s.estado !== "ACEPTADA" || detalles[s.id]) return;
    setDetalles((prev) => ({ ...prev, [s.id]: { loading: true } }));
    getDetalleSolicitudRequest(s.id)
      .then((data) => setDetalles((prev) => ({ ...prev, [s.id]: { data } })))
      .catch((err) => setDetalles((prev) => ({ ...prev, [s.id]: { error: parseApiError(err).message } })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, items]);

  const celda = (id, col) =>
    clsx(
      "border border-line/25 px-2 py-1.5 align-middle text-[13px] text-ink-50",
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
              {COLUMNAS.map((c) => (
                <th key={c.letra} className={clsx("border border-line/25 bg-line/10 px-2 py-0.5 text-center text-[11px] font-normal text-ink-300", c.ancho)}>
                  {c.letra}
                </th>
              ))}
            </tr>
            {/* Fila 1: los titulos */}
            <tr>
              <th className="sticky left-0 z-20 border border-line/25 bg-line/10 text-center text-[11px] font-normal text-ink-300">1</th>
              {COLUMNAS.map((c) => (
                <th key={c.letra} className="border border-line/25 bg-line/[0.06] px-2 py-1.5 text-left text-[12px] font-bold text-ink-50">
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((s, i) => {
              const milano = numeroMilano(s);
              const extendida = abierta === s.id;
              return (
                <Fragment key={s.id}>
                  <tr className="hover:bg-line/[0.04]" onDoubleClick={() => onOpen(s.id)}>
                    <th
                      scope="row"
                      onClick={() => setAbierta(extendida ? null : s.id)}
                      title={`${ESTADO_TITULO[s.estado] ?? s.estado} · clic para ver chofer, targa y bolla`}
                      className={clsx(
                        "sticky left-0 z-10 w-12 cursor-pointer border border-line/25 text-center text-[11px] font-normal transition-colors",
                        extendida ? "bg-accent-500/25 text-ink-50" : "bg-line/10 text-ink-300 hover:bg-line/20"
                      )}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        <span className={clsx("h-1.5 w-1.5 rounded-full", ESTADO_PUNTO[s.estado] ?? "bg-line")} />
                        {i + 2}
                        <span className={clsx("text-[9px] transition-transform", extendida && "rotate-90")}>▶</span>
                      </span>
                    </th>
                    <td className={celda(s.id, "A")} onClick={() => setSeleccion(`${s.id}:A`)}>
                      <CeldaShipmentOrder s={s} />
                    </td>
                    <td className={clsx(celda(s.id, "B"), "text-center font-semibold")} onClick={() => setSeleccion(`${s.id}:B`)}>
                      {s.tipoPedido ?? ""}
                    </td>
                    <td className={celda(s.id, "C")} onClick={() => setSeleccion(`${s.id}:C`)}>
                      {s.cliente}
                    </td>
                    <td className={celda(s.id, "D")} onClick={() => setSeleccion(`${s.id}:D`)}>
                      {s.destinazione}
                    </td>
                    <td className={clsx(celda(s.id, "E"), "whitespace-nowrap")} onClick={() => setSeleccion(`${s.id}:E`)}>
                      {formatFechaHora(s.fechaHora)}
                    </td>
                    <td className={clsx(celda(s.id, "F"), "text-right")} onClick={() => setSeleccion(`${s.id}:F`)}>
                      {kmDeSolicitud(s) ?? ""}
                    </td>
                    <td
                      className={clsx(celda(s.id, "G"), "text-center font-semibold", milano.propuesto && "font-normal italic text-ink-300")}
                      title={milano.propuesto ? "Numero proposto: l'ufficio non lo ha ancora assegnato" : undefined}
                      onClick={() => setSeleccion(`${s.id}:G`)}
                    >
                      {milano.texto}
                    </td>
                  </tr>
                  {extendida && (
                    <tr>
                      <th className="sticky left-0 z-10 border border-line/25 bg-accent-500/25" />
                      <td colSpan={COLUMNAS.length} className="border border-line/25 bg-line/[0.04] px-4 py-3">
                        <Panel s={s} detalle={detalles[s.id]} verFotos={verFotos} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {items.length === 0 && (
              <tr>
                <th className="sticky left-0 z-10 border border-line/25 bg-line/10 text-center text-[11px] font-normal text-ink-300">2</th>
                <td colSpan={COLUMNAS.length} className="border border-line/25 px-3 py-6 text-center text-[13px] text-ink-300">
                  Nessuna richiesta per questo mese.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-ink-400">Clicca sul numero di riga per vedere chofer, targa e bolla · doppio clic su una cella per aprire o modificare la richiesta.</p>
    </div>
  );
};
