import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { CopyButton } from "../../components/ui/CopyButton";
import { PageLoader } from "../../components/ui/PageLoader";
import { Spinner } from "../../components/ui/Spinner";
import { ChevronRightIcon, PlusIcon, ReceiptIcon } from "../../components/ui/icons";
import { useDataRefresh } from "../../context/DataRefreshContext";
import { parseApiError } from "../../lib/api";
import { formatCurrency, formatDateOnly } from "../../lib/format";
import { listMancatosRequest } from "../../lib/mancato.api";

const PAGE_SIZE = 15;

// "Mancato Pagamento" para el chofer: solo sube sus avisos. El pago, los plazos y los estados los
// maneja la empresa, asi que aca no se muestran: solo lo que el sube, la fecha del aviso y cuando lo subio.

// "13/10/2026 09:42" en hora de Roma.
const formatSubida = (value) =>
  new Date(value).toLocaleString("es-AR", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
export const MancatoChoferPage = () => {
  const location = useLocation();
  const { version } = useDataRefresh("mancato");
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback((page) => listMancatosRequest({ page, pageSize: PAGE_SIZE, orden: "recientes" }), []);

  useEffect(() => {
    let cancelled = false;
    load(1)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [load, version]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await load(Math.floor(items.length / PAGE_SIZE) + 1);
      setItems((prev) => [...prev, ...data.items]);
      setTotal(data.total);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="glass-surface rounded-3xl p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-md">
            <h2 className="text-[19px] font-semibold text-ink-50">Mis avisos de mancato pagamento</h2>
            <p className="mt-1 text-[13px] text-ink-300">
              Sube el aviso apenas lo recibas: tienes 24 horas desde la fecha del aviso. La empresa se encarga del
              pago y de asignarlo a tu servicio.
            </p>
          </div>
          <Link to="/finanzas/mancato/new" state={{ backgroundLocation: location }}>
            <span className="flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-[14px] font-semibold text-brand-foreground shadow-[0_8px_24px_-10px_var(--brand)] transition hover:brightness-105">
              <PlusIcon className="h-4 w-4" />
              Subir mancato pagamento
            </span>
          </Link>
        </div>
      </section>

      <Alert>{error}</Alert>
      {!items && !error && <PageLoader />}

      {items && items.length === 0 && (
        <div className="glass-surface-sm rounded-2xl px-4 py-8 text-center text-[14px] text-ink-300">
          Todavia no subiste ningun aviso.
        </div>
      )}

      {items && items.length > 0 && (
        <section className="glass-surface rounded-3xl p-3 sm:p-4">
          <ul className="flex flex-col divide-y divide-line/10">
            {items.map((m) => (
              <li key={m.id}>
                <Link
                  to={`/finanzas/mancato/${m.id}`}
                  state={{ backgroundLocation: location }}
                  className="flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-line/[0.06]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-accent-400">
                    <ReceiptIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-ink-50">
                      Aviso del {formatDateOnly(m.fecha)}
                      {m.horaTransito ? ` · ${m.horaTransito}` : ""}
                    </span>
                    <span className="block text-[12px] text-ink-300">
                      Subido el {formatSubida(m.registradoAt)}
                      {m.subidoTarde && (
                        <span className="font-medium text-danger-500">
                          {" "}
                          · {Math.floor(m.horasHastaSubida / 24)} dias despues
                        </span>
                      )}
                    </span>
                    <span className="flex min-w-0 items-center gap-1 text-[12px] text-ink-400">
                      <span className="truncate">
                        #{m.numero} · {m.targa} · {formatCurrency(m.costo)}
                        {m.sitioWeb ? ` · ${m.sitioWeb}` : ""}
                      </span>
                      <CopyButton value={m.numero} label="Copiar numero" />
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-success-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-success-500">
                    Enviado
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-400" />
                </Link>
              </li>
            ))}
          </ul>
          {items.length < total && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-medium text-accent-400 hover:bg-line/[0.06]"
            >
              {loadingMore && <Spinner className="h-4 w-4" />}
              Ver mas ({total - items.length})
            </button>
          )}
        </section>
      )}
    </div>
  );
};
