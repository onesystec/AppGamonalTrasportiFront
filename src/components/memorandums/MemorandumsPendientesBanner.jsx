import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { listMemorandumsRecibidosRequest } from "../../lib/memorandums.api";
import { FileTextIcon } from "../ui/icons";

export const MEMORANDUMS_CHANGED = "memorandums:changed";

// Cuantos memorandums tiene pendientes de confirmar el usuario. Se actualiza al abrir la app, cada 5 minutos, al volver a la pestaña y cuando
// se confirma o se emite uno (evento MEMORANDUMS_CHANGED).
export const usePendingMemorandums = () => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const enabled = Boolean(user) && user.cargo !== "CLIENTE";

  const load = useCallback(() => {
    if (!enabled) return;
    listMemorandumsRecibidosRequest()
      .then((rows) => setCount(rows.filter((m) => !m.firmado).length))
      .catch(() => {});
  }, [enabled]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(MEMORANDUMS_CHANGED, load);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(MEMORANDUMS_CHANGED, load);
    };
  }, [load]);

  return count;
};

// Aviso arriba de cualquier pantalla (menos la de memorandums) mientras haya alguno sin confirmar.
export const MemorandumsPendientesBanner = ({ count }) => {
  const { pathname } = useLocation();
  if (count === 0 || pathname.startsWith("/memorandums")) return null;
  return (
    <Link
      to="/memorandums"
      className="mb-4 flex items-center gap-3 rounded-2xl border border-warning-500/40 bg-warning-500/10 px-4 py-3 text-[14px] text-ink-50 transition-colors hover:bg-warning-500/15"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-500/20 text-warning-500">
        <FileTextIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">
          {count === 1 ? "Tienes un memorándum pendiente" : `Tienes ${count} memorándums pendientes`}
        </span>
        <span className="block text-[12px] text-ink-300">Ábrelo para confirmarlo y leerlo.</span>
      </span>
      <span className="shrink-0 text-[13px] font-medium text-accent-400">Ver</span>
    </Link>
  );
};
