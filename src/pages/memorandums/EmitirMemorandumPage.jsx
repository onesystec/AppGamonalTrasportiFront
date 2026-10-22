import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.webp";
import { MEMORANDUMS_CHANGED } from "../../components/memorandums/MemorandumsPendientesBanner";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { GlassCard } from "../../components/ui/GlassCard";
import { PageLoader } from "../../components/ui/PageLoader";
import { Select } from "../../components/ui/Select";
import { TextField } from "../../components/ui/TextField";
import { Textarea } from "../../components/ui/Textarea";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { CARGO_LABELS } from "../../lib/constants";
import { MODO_LABELS, NIVEL_LABELS } from "../../lib/memorandums";
import { emitMemorandumRequest, getMemorandumOptionsRequest } from "../../lib/memorandums.api";

const PLAZO_OPTIONS = [
  { value: "", label: "Sin plazo" },
  { value: "1", label: "1 día" },
  { value: "3", label: "3 días" },
  { value: "7", label: "7 días" },
  { value: "14", label: "14 días" },
  { value: "30", label: "30 días" },
];

const EMISOR_ROL = { OWNER: "Administración", RRHH: "Recursos Humanos", ADMIN: "Responsable" };

// Parrafos separados por una linea en blanco; las lineas que empiezan con "- " son vinetas (igual que en el PDF).
const parseBody = (text) =>
  text
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .reduce((blocks, line) => {
      if (line.trim() === "") blocks.push({ type: "gap" });
      else if (/^\s*[-*•]\s+/.test(line)) blocks.push({ type: "bullet", text: line.replace(/^\s*[-*•]\s+/, "") });
      else blocks.push({ type: "p", text: line.trim() });
      return blocks;
    }, [])
    .filter((b, i, all) => !(b.type === "gap" && (i === 0 || all[i - 1].type === "gap")));

const Preview = ({ numero, tipoLabel, titulo, cuerpo, audiencia, emisor, rol, plazoDias, nivel }) => (
  <div className="overflow-hidden rounded-2xl border border-line/20 bg-white text-slate-800 shadow-lg">
    <div className="flex items-center gap-3 bg-[#0b1f33] px-5 py-4">
      <img src={logo} alt="" className="h-11 w-11 rounded-full bg-white" />
      <div>
        <p className="text-[15px] font-bold text-white">Gamonal Driver 2.0</p>
        <p className="text-[9px] uppercase tracking-[0.12em] text-slate-300">Gestión de flota · Gamonal Trasporti</p>
      </div>
    </div>
    <div className="px-5 pb-6 pt-4">
      <div className="flex items-end justify-between border-b-2 border-[#0b1f33] pb-2">
        <p className="text-[20px] font-extrabold tracking-tight text-[#0b1f33]">MEMORÁNDUM</p>
        <p className="text-[11px] font-bold text-slate-500">N.º {numero}</p>
      </div>
      <dl className="mt-2 text-[12px]">
        {[
          ["Fecha", new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })],
          ["De", `${emisor} (${rol})`],
          ["Para", audiencia || "—"],
          ["Tipo", tipoLabel || "—"],
          ...(plazoDias ? [["Confirmar antes de", `en ${plazoDias} ${plazoDias === "1" ? "día" : "días"}`]] : []),
        ].map(([k, v]) => (
          <div key={k} className="flex gap-3 border-b border-slate-200 py-1.5">
            <dt className="w-28 shrink-0 text-[10px] uppercase tracking-wide text-slate-500">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[9px] uppercase tracking-wide text-slate-500">Asunto</p>
      <p className="text-[15px] font-bold text-[#0b1f33]">{titulo || "—"}</p>
      <div className="mt-3 text-[12.5px] leading-relaxed">
        {parseBody(cuerpo).map((b, i) =>
          b.type === "gap" ? (
            <div key={i} className="h-2" />
          ) : b.type === "bullet" ? (
            <p key={i} className="flex gap-2 pl-2">
              <span>•</span>
              <span>{b.text}</span>
            </p>
          ) : (
            <p key={i}>{b.text}</p>
          )
        )}
      </div>
      <p className="mt-5 text-[12px] font-bold text-[#0b1f33]">{emisor}</p>
      <p className="text-[11px] text-slate-500">{rol}</p>
      <p className="mt-4 text-[9.5px] leading-snug text-slate-500">
        {nivel === "FIRMA"
          ? "Este documento se abre solo después de que cada destinatario lo firma en la app."
          : "Este documento se abre solo después de que cada destinatario confirma en la app que lo ha leído."}
      </p>
    </div>
  </div>
);

// Escribir y emitir un memorandum (Admin, Recursos Humanos y Responsables): tipo, texto, a quien va y como confirma. A la derecha se ve el
// documento tal como saldra, con el logo; al emitir se genera el PDF y a cada destinatario le llega un aviso al celular.
export const EmitirMemorandumPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEmit = user?.cargo === "OWNER" || user?.cargo === "RRHH" || user?.cargo === "ADMIN";

  const [options, setOptions] = useState(null);
  const [error, setError] = useState("");
  const [tipo, setTipo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [cuerpoTocado, setCuerpoTocado] = useState(false);
  const [nivel, setNivel] = useState("ENTENDIDO");
  const [plazoDias, setPlazoDias] = useState("");
  const [modo, setModo] = useState("CHOFERES");
  const [areas, setAreas] = useState([]);
  const [userIds, setUserIds] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!canEmit) return;
    getMemorandumOptionsRequest()
      .then(setOptions)
      .catch((err) => setError(parseApiError(err).message));
  }, [canEmit]);

  const tipoCfg = options?.tipos.find((t) => t.key === tipo);
  const rol = EMISOR_ROL[user?.cargo] ?? "";
  const emisor = user ? `${user.nombre} ${user.apellido}` : "";

  const pickTipo = (cfg) => {
    setTipo(cfg.key);
    setNivel(cfg.nivel);
    if (!cuerpoTocado) setCuerpo(cfg.plantilla);
  };

  const personasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (options?.personas ?? []).filter((p) => !q || `${p.nombre} ${p.apellido}`.toLowerCase().includes(q));
  }, [options, busqueda]);

  const audiencia = useMemo(() => {
    if (modo === "CHOFERES") return user?.cargo === "ADMIN" ? "Mis choferes" : "Todos los choferes";
    if (modo === "RESPONSABLES") return "Todos los Responsables";
    if (modo === "AREA") return areas.length ? `Choferes de ${areas.map((k) => options?.areas.find((a) => a.key === k)?.label ?? k).join(", ")}` : "";
    const elegidas = (options?.personas ?? []).filter((p) => userIds.includes(p.id));
    if (elegidas.length === 0) return "";
    return elegidas.length <= 3 ? elegidas.map((p) => `${p.nombre} ${p.apellido}`).join(", ") : `${elegidas.length} personas`;
  }, [modo, areas, userIds, options, user]);

  if (!canEmit) return <Navigate to="/memorandums" replace />;
  if (!options && !error) return <PageLoader />;

  const toggle = (list, setList, value) => setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const validate = () => {
    if (!tipo) return "Elige el tipo de memorándum";
    if (titulo.trim().length < 3) return "Escribe el asunto";
    if (cuerpo.trim().length < 10) return "Escribe el texto del memorándum";
    if (modo === "AREA" && areas.length === 0) return "Elige al menos una zona";
    if (modo === "PERSONAS" && userIds.length === 0) return "Elige al menos una persona";
    return "";
  };

  const handleReview = () => {
    const problem = validate();
    setError(problem);
    setConfirming(!problem);
  };

  const handleEmit = async () => {
    setSending(true);
    setError("");
    try {
      const memo = await emitMemorandumRequest({
        tipo,
        titulo: titulo.trim(),
        cuerpo: cuerpo.trim(),
        nivelFirma: nivel,
        ...(plazoDias ? { plazoDias: Number(plazoDias) } : {}),
        destinatarios: { modo, ...(modo === "AREA" ? { areas } : {}), ...(modo === "PERSONAS" ? { userIds } : {}) },
      });
      window.dispatchEvent(new Event(MEMORANDUMS_CHANGED));
      navigate(`/memorandums/emitidos/${memo.id}`, { replace: true });
    } catch (err) {
      setError(parseApiError(err).message);
      setConfirming(false);
      setSending(false);
    }
  };

  const modoOptions = options.modos.map((m) => ({ value: m, label: m === "CHOFERES" && user?.cargo === "ADMIN" ? "Todos mis choferes" : MODO_LABELS[m] }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/memorandums?tab=emitidos" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
          ← Memorándums
        </Link>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-ink-50">Nuevo memorándum</h1>
        <p className="mt-1 text-[14px] text-ink-300">
          Escribe el texto: el sistema genera el documento con el logo y lo envía. Cada destinatario recibe un aviso y tiene que confirmar para abrirlo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div className="flex min-w-0 flex-col gap-5">
          <GlassCard>
            <h2 className="text-[17px] font-semibold text-ink-50">1. Tipo</h2>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {options.tipos.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => pickTipo(t)}
                  className={clsx(
                    "rounded-xl border px-4 py-3 text-left transition-colors",
                    tipo === t.key ? "border-brand bg-brand/10" : "border-line/20 hover:bg-line/10"
                  )}
                >
                  <span className="block text-[14px] font-semibold text-ink-50">{t.label}</span>
                  <span className="block text-[12px] text-ink-400">{t.descripcion}</span>
                </button>
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <h2 className="text-[17px] font-semibold text-ink-50">2. Texto</h2>
            <div className="mt-3 flex flex-col gap-4">
              <TextField id="memo-titulo" label="Asunto" value={titulo} maxLength={160} onChange={(e) => setTitulo(e.target.value)} />
              <Textarea
                id="memo-cuerpo"
                label="Texto del memorándum"
                rows={12}
                value={cuerpo}
                onChange={(e) => {
                  setCuerpo(e.target.value);
                  setCuerpoTocado(true);
                }}
              />
              <p className="-mt-2 text-[12px] text-ink-400">
                Deja una línea en blanco para separar párrafos. Las líneas que empiezan con «- » salen como viñetas. Reemplaza lo que va entre [corchetes].
              </p>
            </div>
          </GlassCard>

          <GlassCard>
            <h2 className="text-[17px] font-semibold text-ink-50">3. A quién va</h2>
            <div className="mt-3 flex flex-col gap-4">
              <Select id="memo-modo" label="Destinatarios" value={modo} onChange={(e) => setModo(e.target.value)} options={modoOptions} />

              {modo === "AREA" && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {options.areas.map((a) => (
                    <label key={a.key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line/20 px-4 py-2.5 text-[14px] text-ink-50">
                      <input type="checkbox" checked={areas.includes(a.key)} onChange={() => toggle(areas, setAreas, a.key)} className="h-4 w-4" />
                      {a.label}
                    </label>
                  ))}
                  <p className="text-[12px] text-ink-400 sm:col-span-2">Les llega a los choferes que trabajaron en esa zona en los últimos 60 días.</p>
                </div>
              )}

              {modo === "PERSONAS" && (
                <div className="flex flex-col gap-2">
                  <TextField id="memo-buscar" placeholder="Buscar por nombre" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                  <div className="max-h-60 overflow-y-auto rounded-xl border border-line/20">
                    {personasFiltradas.length === 0 && <p className="px-4 py-3 text-[13px] text-ink-400">Nadie coincide con la búsqueda.</p>}
                    {personasFiltradas.map((p) => (
                      <label key={p.id} className="flex cursor-pointer items-center gap-3 border-b border-line/10 px-4 py-2.5 text-[14px] text-ink-50 last:border-b-0 hover:bg-line/5">
                        <input type="checkbox" checked={userIds.includes(p.id)} onChange={() => toggle(userIds, setUserIds, p.id)} className="h-4 w-4" />
                        <span className="min-w-0 flex-1 truncate">
                          {p.nombre} {p.apellido}
                        </span>
                        <span className="text-[12px] text-ink-400">{CARGO_LABELS[p.cargo] ?? p.cargo}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[12px] text-ink-400">{userIds.length} seleccionadas</p>
                </div>
              )}
            </div>
          </GlassCard>

          <GlassCard>
            <h2 className="text-[17px] font-semibold text-ink-50">4. Cómo confirman</h2>
            <div className="mt-3 flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {["ENTENDIDO", "FIRMA"].map((n) => (
                  <label
                    key={n}
                    className={clsx(
                      "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3",
                      nivel === n ? "border-brand bg-brand/10" : "border-line/20",
                      tipoCfg?.nivelFijo && n !== nivel && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <input type="radio" name="nivel" checked={nivel === n} disabled={tipoCfg?.nivelFijo && n !== nivel} onChange={() => setNivel(n)} className="mt-1" />
                    <span>
                      <span className="block text-[14px] font-semibold text-ink-50">{NIVEL_LABELS[n]}</span>
                      <span className="block text-[12px] text-ink-400">
                        {n === "ENTENDIDO" ? "«He leído y entiendo»: para circulares y avisos." : "Firma con el dedo en pantalla: para comunicaciones formales y políticas."}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              {tipoCfg?.nivelFijo && <p className="-mt-2 text-[12px] text-ink-400">Este tipo siempre se firma.</p>}
              <Select id="memo-plazo" label="Plazo para confirmar" value={plazoDias} onChange={(e) => setPlazoDias(e.target.value)} options={PLAZO_OPTIONS} />
              <p className="-mt-2 text-[12px] text-ink-400">
                Quien no confirme recibe recordatorios en el celular (de día) hasta que lo haga. Con plazo, los recordatorios se vuelven más frecuentes el último día.
              </p>
            </div>
          </GlassCard>

          <Alert>{error}</Alert>

          {confirming ? (
            <GlassCard>
              <h2 className="text-[17px] font-semibold text-ink-50">¿Emitir este memorándum?</h2>
              <p className="mt-1 text-[14px] text-ink-300">
                Se enviará a: <strong className="text-ink-50">{audiencia}</strong>. Cada persona recibirá un aviso en el celular. Una vez que alguien lo firme, ya no se podrá eliminar.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button onClick={handleEmit} loading={sending} className="sm:w-auto sm:px-8">
                  Sí, emitir
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(false)} disabled={sending} className="sm:w-auto sm:px-8">
                  Volver a revisar
                </Button>
              </div>
            </GlassCard>
          ) : (
            <div>
              <Button onClick={handleReview} className="sm:w-auto sm:px-8">
                Revisar y emitir
              </Button>
            </div>
          )}
        </div>

        <div className="min-w-0 xl:sticky xl:top-24 xl:self-start">
          <p className="mb-2 text-[13px] font-medium text-ink-300">Vista previa del documento</p>
          <Preview
            numero={`MEMO-${new Date().getFullYear()}-###`}
            tipoLabel={tipoCfg?.label}
            titulo={titulo}
            cuerpo={cuerpo}
            audiencia={audiencia}
            emisor={emisor}
            rol={rol}
            plazoDias={plazoDias}
            nivel={nivel}
          />
          <p className="mt-2 text-[12px] text-ink-400">El número se asigna al emitir.</p>
        </div>
      </div>
    </div>
  );
};
