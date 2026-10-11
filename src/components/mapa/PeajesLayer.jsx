import { Marker } from "@react-google-maps/api";
import { useEffect, useMemo, useState } from "react";
import { PEAJE_COLOR_CERCA, peajeTitulo } from "../../lib/peajes";
import { listPeajesRequest } from "../../lib/peajes.api";

const MAX_MARKERS = 300;
const MIN_ZOOM = 9;

// Los peajes de Italia en el mapa (puntos naranjas). Solo se dibujan los que caen en la zona visible y desde cierto zoom, para no
// llenar el mapa; `omitir` = ids que ya se pintan aparte (los de la ruta, en otro color). Va dentro de <GoogleMap>.
export const PeajesLayer = ({ map, visible = true, omitir }) => {
  const [peajes, setPeajes] = useState([]);
  const [view, setView] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listPeajesRequest()
      .then((list) => !cancelled && setPeajes(list))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!map) return undefined;
    const update = () => {
      const b = map.getBounds();
      if (!b) return;
      const ne = b.getNorthEast();
      const sw = b.getSouthWest();
      setView({ n: ne.lat(), e: ne.lng(), s: sw.lat(), w: sw.lng(), zoom: map.getZoom() });
    };
    update();
    const listener = map.addListener("idle", update);
    return () => listener.remove();
  }, [map]);

  const shown = useMemo(() => {
    if (!visible || !view || view.zoom < MIN_ZOOM) return [];
    return peajes
      .filter((p) => p.lat <= view.n && p.lat >= view.s && p.lng <= view.e && p.lng >= view.w && !omitir?.has(p.id))
      .slice(0, MAX_MARKERS);
  }, [peajes, view, visible, omitir]);

  if (!window.google) return null;
  return shown.map((p) => (
    <Marker
      key={p.id}
      position={{ lat: p.lat, lng: p.lng }}
      title={peajeTitulo(p)}
      zIndex={2}
      icon={{
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 5,
        fillColor: PEAJE_COLOR_CERCA,
        fillOpacity: 0.95,
        strokeColor: "#ffffff",
        strokeWeight: 1.5,
      }}
    />
  ));
};
