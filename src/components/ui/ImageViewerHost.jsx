import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../i18n/index.jsx";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "./icons";
import { Spinner } from "./Spinner";

// Visor de imagenes dentro de la app: en vez de abrir la foto en otra pestaña, se muestra encima de la pantalla actual, ajustada al ancho y alto del
// dispositivo (celular, tablet o computadora), con zoom de pellizco en el celular. Se monta UNA vez (main.jsx) y atrapa el clic en cualquier enlace
// a una imagen (tickets, fotos de entrega, comprobantes, multas...), sin tocar cada pantalla. Los PDF y los demas enlaces siguen como siempre.
const IMAGE_RE = /\.(avif|gif|heic|jpe?g|png|webp)$/i;
const isImageHref = (href) => {
  try {
    return IMAGE_RE.test(new URL(href, window.location.href).pathname);
  } catch {
    return false;
  }
};

const navButton = "absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75";

const Viewer = ({ urls, start, onClose }) => {
  const { t } = useLanguage();
  const [index, setIndex] = useState(start);
  const [status, setStatus] = useState("loading");
  const touchStartX = useRef(null);
  const url = urls[index];
  const many = urls.length > 1;

  const go = (delta) => {
    setStatus("loading");
    setIndex((i) => (i + delta + urls.length) % urls.length);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (many && e.key === "ArrowLeft") go(-1);
      else if (many && e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    // La pantalla de atras no se desplaza mientras se mira la foto.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [many, urls.length]);

  // Deslizar el dedo a los lados pasa a la foto anterior o siguiente.
  const onTouchEnd = (e) => {
    if (!many || touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 70) go(dx < 0 ? 1 : -1);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
      style={{ padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)" }}
      onClick={onClose}
    >
      <button
        type="button"
        aria-label={t("viewer.close")}
        onClick={onClose}
        className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
        style={{ marginTop: "env(safe-area-inset-top)" }}
      >
        <CloseIcon className="h-5 w-5" />
      </button>

      {many && (
        <>
          <button type="button" aria-label={t("viewer.prev")} onClick={(e) => { e.stopPropagation(); go(-1); }} className={`${navButton} left-3`}>
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <button type="button" aria-label={t("viewer.next")} onClick={(e) => { e.stopPropagation(); go(1); }} className={`${navButton} right-3`}>
            <ChevronRightIcon className="h-5 w-5" />
          </button>
          <span className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-[12px] text-white" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
            {index + 1} / {urls.length}
          </span>
        </>
      )}

      {status === "loading" && <Spinner className="absolute h-6 w-6 border-white/30 border-t-white" />}
      {status === "error" ? (
        <p className="px-6 text-center text-[14px] text-white" onClick={(e) => e.stopPropagation()}>
          {t("viewer.error")}
        </p>
      ) : (
        <img
          key={url}
          src={url}
          alt=""
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={onTouchEnd}
          draggable={false}
          className="max-h-full max-w-full select-none object-contain"
          style={{ touchAction: "pinch-zoom", opacity: status === "ready" ? 1 : 0 }}
        />
      )}
    </div>,
    document.body
  );
};

export const ImageViewerHost = () => {
  const [open, setOpen] = useState(null); // { urls, start }

  useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!link || link.hasAttribute("download") || !isImageHref(link.href)) return;
      e.preventDefault();
      // Las demas fotos de la misma pantalla (o del mismo cuadro abierto) forman la galeria, para pasar de una a otra.
      const scope = link.closest('[role="dialog"], main') ?? document.body;
      const urls = [...new Set([...scope.querySelectorAll("a[href]")].filter((a) => !a.hasAttribute("download") && isImageHref(a.href)).map((a) => a.href))];
      setOpen({ urls, start: Math.max(0, urls.indexOf(link.href)) });
    };
    // Fase de captura: antes de que el navegador abra la pestaña nueva, sin impedir los clics propios de cada pantalla.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!open) return null;
  return <Viewer urls={open.urls} start={open.start} onClose={() => setOpen(null)} />;
};
