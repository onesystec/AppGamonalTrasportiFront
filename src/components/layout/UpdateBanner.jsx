import { useState } from "react";
import { Link } from "react-router-dom";
import { useAppUpdate } from "../../context/AppUpdateContext";
import { DownloadIcon } from "../ui/icons";

const dismissedKey = (versionCode) => `gt-update-dismissed-${versionCode}`;

// Aviso de "hay una version nueva" arriba de cada pantalla; "Despues" lo oculta hasta que salga otra version.
export const UpdateBanner = () => {
  const { hasUpdate, latest } = useAppUpdate();
  const [, rerender] = useState(0);
  if (!hasUpdate) return null;

  let dismissed = false;
  try {
    dismissed = sessionStorage.getItem(dismissedKey(latest.versionCode)) === "1";
  } catch {
    // sessionStorage puede no estar disponible; el aviso simplemente se muestra.
  }
  if (dismissed) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(dismissedKey(latest.versionCode), "1");
    } catch {
      // idem
    }
    rerender((n) => n + 1);
  };

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/40 bg-brand/10 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <DownloadIcon className="h-5 w-5 shrink-0 text-brand" />
        <p className="text-[13px] text-ink-50">
          <strong className="font-semibold">Hay una versión nueva</strong> de Gamonal Driver ({latest.versionName}).
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={dismiss} className="rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-300 hover:text-ink-50">
          Después
        </button>
        <Link to="/ajustes#actualizar" className="rounded-full bg-brand px-4 py-1.5 text-[13px] font-semibold text-brand-foreground hover:bg-brand-light">
          Actualizar
        </Link>
      </div>
    </div>
  );
};
