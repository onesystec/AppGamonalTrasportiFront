// Aspecto de un vehiculo en el mapa segun su GPS, igual que en el Mapa de la oficina (MapPage): verde en movimiento (flecha hacia donde va), naranja
// parado con el motor encendido y rojo parado y apagado. Lo usa el mapa "En Vivo" de los usuarios cliente.
const MOVING_SPEED_THRESHOLD = 1;

export const VEHICLE_STATUS_COLOR = { moving: "#22e093", idlingOn: "#ff8a1a", idlingOff: "#ff3b57" };

// "label" es la clave del texto (i18n): quien lo muestra lo traduce.
export const VEHICLE_STATUS_META = {
  moving: { label: "vehicle.moving", color: VEHICLE_STATUS_COLOR.moving },
  idlingOn: { label: "vehicle.idlingOn", color: VEHICLE_STATUS_COLOR.idlingOn },
  idlingOff: { label: "vehicle.idlingOff", color: VEHICLE_STATUS_COLOR.idlingOff },
};

export const vehicleStatus = (gps) => {
  if (gps.speed != null && gps.speed > MOVING_SPEED_THRESHOLD) return "moving";
  return gps.ignition ? "idlingOn" : "idlingOff";
};

export const vehicleMarkerIcon = (gps) => {
  const status = vehicleStatus(gps);
  if (status === "moving" && gps.direction != null) {
    return {
      path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 5,
      rotation: gps.direction,
      fillColor: VEHICLE_STATUS_COLOR.moving,
      fillOpacity: 0.9,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    };
  }
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: VEHICLE_STATUS_COLOR[status],
    fillOpacity: 0.9,
    strokeColor: "#ffffff",
    strokeWeight: 2,
  };
};
