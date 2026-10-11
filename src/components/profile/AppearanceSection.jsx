import clsx from "clsx";
import { useTheme } from "../../context/ThemeContext";
import { PALETTES } from "../../lib/themes";
import { CheckCircleIcon, MoonIcon, SunIcon } from "../ui/icons";

const PhoneIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </svg>
);

const MODES = [
  { id: "light", label: "Claro", icon: SunIcon },
  { id: "dark", label: "Oscuro", icon: MoonIcon },
  { id: "system", label: "Automático", icon: PhoneIcon },
];

// Circulo de la paleta: un gajo por color, en el orden de la lista (sentido horario desde arriba).
const PaletteDisc = ({ colors }) => {
  const step = 360 / colors.length;
  const gradient = colors.map((color, i) => `${color} ${i * step}deg ${(i + 1) * step}deg`).join(", ");
  return (
    <span
      aria-hidden="true"
      className="block h-[46px] w-[46px] shrink-0 rounded-full ring-1 ring-black/10 sm:h-[72px] sm:w-[72px]"
      style={{ backgroundImage: `conic-gradient(${gradient})` }}
    />
  );
};

// Selector de apariencia: modo (claro/oscuro) + paleta de color. Son ejes
// independientes: cualquier paleta existe en modo claro y en modo oscuro. Se
// guarda en este dispositivo (localStorage), no en la cuenta.
export const AppearanceSection = () => {
  const { preference, setThemePreference, palette, setPalette } = useTheme();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-ink-400">Modo</p>
        <div role="radiogroup" aria-label="Modo" className="grid grid-cols-3 gap-2.5">
          {MODES.map(({ id, label, icon: Icon }) => {
            const selected = preference === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setThemePreference(id)}
                className={clsx(
                  "flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 sm:flex-row sm:gap-2 sm:px-3 text-[14px] font-medium transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-500/30",
                  selected
                    ? "border-accent-500/60 bg-accent-500/15 text-accent-400"
                    : "border-line/10 text-ink-200 hover:bg-line/10"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-ink-400">Paleta de color</p>
        <div role="radiogroup" aria-label="Paleta de color" className="grid grid-cols-2 gap-2.5">
          {PALETTES.map((item) => {
            const selected = palette === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPalette(item.id)}
                className={clsx(
                  "flex items-center justify-between gap-2 rounded-xl border p-3 text-left sm:gap-3 sm:p-3.5 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-500/30",
                  selected ? "border-accent-500/60 bg-accent-500/10" : "border-line/10 hover:bg-line/5"
                )}
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold leading-tight text-ink-50 sm:text-[15px]">{item.label}</p>
                  <p className="mt-1 text-[12px] text-ink-300">{item.description}</p>
                </div>
                <div className="relative shrink-0">
                  <PaletteDisc colors={item.swatches} />
                  {selected && (
                    <CheckCircleIcon className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-popover text-accent-400" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[12px] text-ink-400">«Automático» sigue el modo claro u oscuro de tu celular. Se guarda en este dispositivo.</p>
    </div>
  );
};
