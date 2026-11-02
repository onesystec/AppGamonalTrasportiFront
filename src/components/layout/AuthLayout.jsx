import logo from "../../assets/logo.webp";
import heroImage from "../../assets/login-hero.webp";
import { GlassCard } from "../ui/GlassCard";

const FEATURES = [
  {
    title: "Seguimiento GPS en tiempo real",
    text: "Ubicación de cada vehículo y chofer en un mismo mapa.",
    icon: (
      <path d="M12 21s7-5.686 7-11a7 7 0 1 0-14 0c0 5.314 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
    ),
  },
  {
    title: "Servicios y rutas planificadas",
    text: "Kilómetros, paradas y horarios siempre bajo control.",
    icon: <path d="M4 6h10a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h12M4 6a1.5 1.5 0 1 0 0-.01M20 18a1.5 1.5 0 1 0 0-.01" />,
  },
  {
    title: "Alertas al instante",
    text: "Área C, exceso de velocidad y novedades en tu celular.",
    icon: <path d="M15 17H9m9-1V11a6 6 0 1 0-12 0v5l-1.5 2h15L18 16Zm-4.5 4a1.5 1.5 0 0 1-3 0" />,
  },
];

const FeatureIcon = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const Wordmark = ({ className }) => (
  <span className={className}>
    ONE DRIVER <span className="text-sidebar-active">Express</span>
  </span>
);

// Sombra de texto para que el texto sobre la foto se lea sin depender de cajas.
const SHADOW = "[text-shadow:0_2px_14px_rgba(3,10,25,0.85)]";

export const AuthLayout = ({ children, title, subtitle, footer }) => (
  <div className="min-h-dvh w-full lg:grid lg:grid-cols-[1.3fr_1fr] xl:grid-cols-[1.5fr_1fr]">
    {/* Panel de marca: solo en pantallas grandes */}
    <aside className="relative hidden overflow-hidden bg-[#050d1b] text-white lg:block">
      <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#050d1b]/90 via-[#050d1b]/60 to-[#050d1b]/25" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050d1b]/85 via-transparent to-[#0a2a63]/25" />

      <div className="relative z-10 flex h-full min-h-dvh flex-col justify-between p-10 xl:p-14">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-12 w-12 rounded-full shadow-lg" />
          <Wordmark className={`text-2xl font-semibold tracking-tight ${SHADOW}`} />
        </div>

        <div className="max-w-xl">
          <h2
            className={`text-[40px] font-semibold leading-[1.15] tracking-tight xl:text-5xl ${SHADOW}`}
          >
            Control total de tu flota,
            <span className="block text-sidebar-active">en un solo lugar.</span>
          </h2>
          <p className={`mt-5 max-w-md text-[16px] leading-relaxed text-white/85 ${SHADOW}`}>
            Tecnología y seguimiento en tiempo real para que cada entrega salga bien.
          </p>

          <ul className="mt-10 space-y-6">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex items-start gap-4">
                <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-[#050d1b]/60 text-sidebar-active backdrop-blur-sm">
                  <FeatureIcon>{feature.icon}</FeatureIcon>
                </span>
                <div className={SHADOW}>
                  <p className="text-[15px] font-semibold">{feature.title}</p>
                  <p className="text-[14px] text-white/75">{feature.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className={`text-[12px] text-white/60 ${SHADOW}`}>
          &copy; {new Date().getFullYear()} ONE DRIVER Express. Todos los derechos reservados.
        </p>
      </div>
    </aside>

    {/* Formulario */}
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-background">
        <div className="hidden dark:block absolute -top-1/3 right-[-10%] h-[70vh] w-[70vh] rounded-full bg-accent-600/15 blur-[150px]" />
        <div className="hidden dark:block absolute bottom-[-25%] left-[-15%] h-[55vh] w-[55vh] rounded-full bg-[#0a3a8f]/25 blur-[150px]" />
      </div>

      {/* Banda con la imagen: solo en celular, el panel grande no entra */}
      <div className="relative z-10 h-44 shrink-0 lg:hidden">
        <div className="absolute inset-0 overflow-hidden">
          <img src={heroImage} alt="" className="h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050d1b]/30 to-[#050d1b]/75" />
        </div>
        <img
          src={logo}
          alt="ONE DRIVER Express"
          className="absolute bottom-0 left-1/2 h-20 w-20 -translate-x-1/2 translate-y-1/2 rounded-full shadow-lg ring-4 ring-white dark:ring-[#050d1b]"
        />
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-6 pt-14 sm:px-6 lg:py-10">
        <GlassCard className="w-full max-w-md">
          <div className="mb-7">
            <h1 className="text-[30px] font-semibold tracking-tight text-ink-50 sm:text-[34px]">
              {title}
            </h1>
            {subtitle && <p className="mt-2 text-[15px] text-ink-300">{subtitle}</p>}
          </div>

          {children}

          {footer && (
            <div className="mt-7 border-t border-line/10 pt-5 text-center text-[14px] text-ink-300">
              {footer}
            </div>
          )}
        </GlassCard>
      </div>

      <p className="relative z-10 pb-6 text-center text-[12px] text-ink-500 lg:hidden">
        &copy; {new Date().getFullYear()} ONE DRIVER Express
      </p>
    </main>
  </div>
);
