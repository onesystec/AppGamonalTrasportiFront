import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { PageLoader } from "../../components/ui/PageLoader";
import { CloseIcon, PlusIcon } from "../../components/ui/icons";
import { EstadoPill, SolicitudDetalle } from "../../components/solicitudes/SolicitudDetalle";
import { SolicitudForm } from "../../components/solicitudes/SolicitudForm";
import { SolicitudWhatsappButton } from "../../components/solicitudes/SolicitudWhatsappButton";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { startVisibleInterval } from "../../lib/polling";
import { formatFechaHora } from "../../lib/solicitudes";
import { deleteSolicitudRequest, listSolicitudesClienteRequest } from "../../lib/solicitudes.api";

const REFRESH_MS = 60 * 1000;

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
    <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/60" onClick={onClose} />
    <div className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-popover p-5 shadow-xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-ink-50">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-ink-300 hover:bg-line/10 hover:text-ink-50">
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

// Vista rapida de un registro: todos sus datos, "Copiar para WhatsApp" y, mientras este pendiente, editar y borrar.
const VistaRapida = ({ solicitud, onClose, onEdit, onDeleted }) => {
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
        {solicitud.estado === "ACEPTADA" && <span className="text-[12px] text-ink-300">Ya esta en el registro de Gamonal Trasporti</span>}
      </div>
      <Alert>{error}</Alert>
      <SolicitudDetalle solicitud={solicitud} />
      <div className="mt-5 flex flex-wrap items-start gap-2">
        <SolicitudWhatsappButton solicitud={solicitud} />
        {solicitud.estado === "PENDIENTE" && (
          <Button variant="ghost" className="!w-auto px-4 py-2 text-[13px]" onClick={onEdit}>
            Editar
          </Button>
        )}
        {solicitud.estado !== "ACEPTADA" &&
          (confirmando ? (
            <Button variant="danger" className="!w-auto px-4 py-2 text-[13px]" loading={deleting} onClick={handleDelete}>
              Si, eliminar
            </Button>
          ) : (
            <Button variant="ghost" className="!w-auto px-4 py-2 text-[13px] text-danger-500" onClick={() => setConfirmando(true)}>
              Eliminar
            </Button>
          ))}
      </div>
    </Modal>
  );
};

// Registro limitado de Piazza: pide servicios a la oficina con pocos datos. La oficina los completa y acepta; aqui se ve en que estado esta cada uno.
export const ClienteRegistroPage = () => {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null); // null | { solicitud?: Solicitud }
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(
    () =>
      listSolicitudesClienteRequest()
        .then((list) => {
          setItems(list);
          setError("");
        })
        .catch((err) => setError(parseApiError(err).message)),
    []
  );

  useEffect(() => {
    load();
    return startVisibleInterval(load, REFRESH_MS);
  }, [load]);

  if (!user?.clienteModulos?.includes("REGISTRO")) return <Navigate to="/cliente" replace />;

  const selected = items?.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-50">Registro</h1>
          <p className="text-[13px] text-ink-300">Tus servicios pedidos a Gamonal Trasporti. La oficina los completa y los acepta.</p>
        </div>
        <Button className="!w-auto px-5 py-2.5" onClick={() => setForm({})}>
          <PlusIcon className="h-4 w-4" />
          Nuevo registro
        </Button>
      </div>

      <Alert>{error}</Alert>
      {!items && !error && <PageLoader />}
      {items?.length === 0 && <p className="py-10 text-center text-[14px] text-ink-300">Todavia no cargaste ningun registro.</p>}

      <ul className="flex flex-col gap-2">
        {(items ?? []).map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setSelectedId(s.id)}
              className="glass-surface-sm flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-line/10"
            >
              <span className="min-w-0 flex-1 basis-48">
                <span className="block truncate text-[15px] font-semibold text-ink-50">{s.cliente}</span>
                <span className="block truncate text-[13px] text-ink-300">{s.destinazione}</span>
              </span>
              <span className="text-[13px] text-ink-300">{formatFechaHora(s.fechaHora)}</span>
              <span className="rounded-md bg-line/15 px-1.5 py-0.5 text-[11px] font-medium text-ink-100">{s.servicioLabel}</span>
              {s.km != null && <span className="text-[13px] text-ink-300">{s.km} km</span>}
              <EstadoPill estado={s.estado} />
            </button>
          </li>
        ))}
      </ul>

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
        <Modal title={form.solicitud ? "Editar registro" : "Nuevo registro"} onClose={() => setForm(null)}>
          <SolicitudForm
            solicitud={form.solicitud}
            onCancel={() => setForm(null)}
            onSaved={(saved) => {
              setForm(null);
              setSelectedId(saved.id);
              load();
            }}
          />
        </Modal>
      )}
    </div>
  );
};
