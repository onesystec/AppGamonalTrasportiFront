import { Switch } from "../ui/Switch";

// Debajo de la descripcion del servicio: el interruptor AORTIC (Medtronic critico) y lo que se detecto escrito en el texto. El interruptor se
// pone solo al escribir AORTIC en la descripcion; se puede corregir a mano (y entonces ya no se toca solo).
export const AorticField = ({ checked, onChange, detectado, disabled }) => {
  const encontrados = [
    detectado?.shipment && `Shipment ${detectado.shipment}`,
    detectado?.orderNumero && `Order ${detectado.orderNumero}`,
    detectado?.tipoPedido,
    detectado?.aplicativo && detectado.aplicativo.replace("_", " "),
  ].filter(Boolean);
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl bg-line/[0.05] px-4 py-3">
      <Switch
        id="aortic"
        label="AORTIC (servicio critico de Medtronic)"
        description="Se detecta solo si la descripcion dice AORTIC. Los Medtronic scheduled no son necesariamente criticos. El cliente ve una alerta roja en su mapa solo en los AORTIC."
        checked={Boolean(checked)}
        onChange={onChange}
        disabled={disabled}
      />
      {detectado?.avisos?.map((aviso) => (
        <p key={aviso} className="rounded-lg bg-warning-500/10 px-3 py-1.5 text-[12px] text-warning-500">
          {aviso}
        </p>
      ))}
      {encontrados.length > 0 && (
        <p className="text-[12px] text-ink-300">
          Detectado en la descripcion: <b className="text-ink-100">{encontrados.join(" · ")}</b> (se completa en los campos del formulario).
        </p>
      )}
    </div>
  );
};
