import clsx from "clsx";
import { MisBustaPagaCard } from "../../components/bustapaga/MisBustaPagaCard";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import heroImage from "../../assets/login-hero.webp";
import { LocationSharingBlock } from "../../components/profile/LocationSharingBlock";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { CameraPickButton } from "../../components/ui/CameraPickButton";
import { PasswordField } from "../../components/ui/PasswordField";
import { Spinner } from "../../components/ui/Spinner";
import { Switch } from "../../components/ui/Switch";
import { GpsRespaldoBlock } from "../../components/profile/GpsRespaldoBlock";
import { TextField } from "../../components/ui/TextField";
import {
  AlertTriangleIcon,
  BriefcaseIcon,
  CalendarIcon,
  CameraIcon,
  CheckCircleIcon,
  ClipboardListIcon,
  FileTextIcon,
  HomeIcon,
  KeyIcon,
  MailIcon,
  MapPinIcon,
  SettingsIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  ShieldIcon,
  TruckIcon,
  UserIcon,
  UsersIcon,
  ZapIcon,
} from "../../components/ui/icons";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { AREA_OPTIONS, GRUPO_LABELS, TIPO_DOCUMENTO_LABELS } from "../../lib/constants";
import { PHONE_GPS_ENABLED } from "../../lib/features";
import { changePasswordRequest } from "../../lib/auth.api";
import { createDocumentRequest, listDocumentsRequest, updateDocumentRequest } from "../../lib/documents.api";
import { formatDate, formatDateOnly, formatKm, toDateInputValue } from "../../lib/format";
import { AREA_LABEL_BY_KEY, roleText, userAreaKeys } from "../../lib/roles";
import { listRecordsByMonthRequest } from "../../lib/records.api";
import {
  listUsersRequest,
  updateMyReperibilidadRequest,
  updateUserRequest,
  uploadUserAvatarRequest,
} from "../../lib/users.api";
import { kmRecorrido } from "../../lib/km";
import { setToken } from "../../lib/token";

const areaLabel = (value) => AREA_OPTIONS.find((opt) => opt.value === value)?.label ?? value;

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_DAYS = 30;

// Mismo criterio de "es de hoy" que ChoferDashboardPage: si reperibilidadActualizada no
// es de hoy, el flag quedo de un dia anterior y se trata como no marcado.
const isToday = (value) => {
  if (!value) return false;
  const d = new Date(value);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  );
};

// fechaNacimiento / fechaScadenza son fechas "puras" (sin hora) que llegan como medianoche UTC.
const ageFromBirthdate = (value) => {
  if (!value) return null;
  const birth = new Date(value);
  const now = new Date();
  let age = now.getFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getUTCMonth() ||
    (now.getMonth() === birth.getUTCMonth() && now.getDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
};

const daysUntil = (value) => {
  const target = new Date(value);
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((targetUtc - todayUtc) / DAY_MS);
};

// Semaforo de vencimiento: rojo vencido, naranja por vencer, verde vigente. Sin fecha
// cargada no se puede juzgar, queda neutro.
const documentStatus = (document) => {
  if (!document.fechaScadenza) {
    return { key: "sin-fecha", label: "Sin vencimiento", tone: "neutral", days: null };
  }
  const days = daysUntil(document.fechaScadenza);
  if (days < 0) return { key: "vencido", label: "Vencido", tone: "danger", days };
  if (days <= EXPIRING_SOON_DAYS) {
    return { key: "por-vencer", label: days === 0 ? "Vence hoy" : `Vence en ${days} d`, tone: "warning", days };
  }
  return { key: "vigente", label: "Vigente", tone: "success", days };
};

const TONE_BADGE = {
  success: "bg-success-500/15 text-success-500",
  warning: "bg-warning-500/20 text-warning-500",
  danger: "bg-danger-500/20 text-danger-500",
  neutral: "bg-ink-500/15 text-ink-300",
};

const Badge = ({ tone = "neutral", children, className }) => (
  <span
    className={clsx(
      "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
      TONE_BADGE[tone],
      className
    )}
  >
    {children}
  </span>
);

const Section = ({ icon: Icon, title, action, children, className }) => (
  <section className={clsx("glass-surface rounded-2xl p-5", className)}>
    <div className="mb-4 flex items-center justify-between gap-3 border-b border-line/10 pb-3">
      <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-ink-50">
        <Icon className="h-5 w-5 text-ink-300" />
        {title}
      </h2>
      {action}
    </div>
    {children}
  </section>
);

const EditButton = ({ onClick, label = "Editar" }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1.5 rounded-lg glass-input px-3 py-1 text-[12px] font-medium text-ink-50 hover:bg-line/10"
  >
    <PencilIcon className="h-3.5 w-3.5" />
    {label}
  </button>
);

const InfoRow = ({ icon: Icon, label, value, href }) => (
  <div className="flex items-start gap-3.5 py-2.5">
    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-ink-400" />
    <div className="min-w-0">
      <span className="block text-[12px] text-ink-400">{label}</span>
      {value ? (
        href ? (
          <a href={href} className="block break-words text-[14px] font-medium text-ink-50 hover:text-accent-300">
            {value}
          </a>
        ) : (
          <span className="block break-words text-[14px] font-medium text-ink-50">{value}</span>
        )
      ) : (
        <span className="block text-[14px] text-ink-400">Sin completar</span>
      )}
    </div>
  </div>
);

const HeaderFact = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    {/* La cabecera siempre es una foto oscura: colores fijos claros, no los del tema. */}
    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-white/60" />
    <div className="min-w-0">
      <span className="block text-[12px] text-white/65">{label}</span>
      <span className="block text-[14px] font-medium text-white">{value}</span>
    </div>
  </div>
);

const QuickAction = ({ icon: Icon, label, to, onClick }) => {
  const className =
    "flex items-center gap-2.5 rounded-xl glass-surface-sm px-3.5 py-3 text-[13px] font-medium text-ink-50 transition-colors hover:bg-line/10";
  const content = (
    <>
      <Icon className="h-4.5 w-4.5 shrink-0 text-ink-300" />
      <span className="min-w-0 truncate">{label}</span>
    </>
  );
  return to ? (
    <Link to={to} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={clsx(className, "text-left")}>
      {content}
    </button>
  );
};

// Fila de un documento propio con su semaforo de vencimiento.
const DocumentItem = ({ document }) => {
  const status = documentStatus(document);
  return (
    <a
      href={document.archivoUrl}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-line/[0.06]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-500/15 text-ink-300">
        <FileTextIcon className="h-4.5 w-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink-50">
          {TIPO_DOCUMENTO_LABELS[document.tipoDocumento] ?? document.tipoDocumento}
        </span>
        <span className="block text-[12px] text-ink-400">
          {document.fechaScadenza ? `Valido hasta ${formatDateOnly(document.fechaScadenza)}` : "Sin fecha de vencimiento"}
        </span>
      </span>
      <Badge tone={status.tone}>{status.label}</Badge>
    </a>
  );
};

// Documentos personales que cada persona sube por su cuenta (los mismos que acepta el servidor, ver SELF_DOCUMENT_TYPES en document.service.js).
//  - vence: tiene fecha de vencimiento (la impresa en el documento). Con ella la oficina recibe el aviso antes de que caduque.
//  - nota: aclaracion corta para quien sube el documento.
// Que documentos vencen, segun las fuentes oficiales italianas: carta d'identita, patente, passaporto y permesso di soggiorno traen su fecha;
// el codice fiscale como numero no caduca (la tessera sanitaria que lo lleva si, pero vencida sigue valiendo como prueba del codice fiscale); y la
// traduccion de la patente no tiene fecha propia: la patente extranjera vale en Italia hasta 1 anio despues de la residencia (art. 135 del Codice della Strada).
const MIS_DOCUMENTOS = [
  { tipo: "CARTA_IDENTITA", vence: true },
  { tipo: "PATENTE", vence: true },
  {
    tipo: "TRADUZIONE_PATENTE",
    vence: true,
    fechaLabel: "Valida hasta (opcional)",
    nota: "La traduccion no vence sola: la patente extranjera vale en Italia hasta 1 año despues de tu residencia. Si sabes esa fecha, ponla.",
  },
  { tipo: "CODICE_FISCALE", vence: false, nota: "El codice fiscale no vence." },
  { tipo: "PASSAPORTO", vence: true },
  { tipo: "SOGGIORNO", vence: true, nota: "Renuevalo con tiempo: el permiso se pide antes de que caduque." },
];
const DOC_MAX_MB = 15;
// Lista explicita (no "image/*"): asi el celular convierte las fotos HEIC de iPhone a JPG antes de subirlas.
const DOC_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const DOC_BUTTON_CLASS =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-full glass-input px-3 py-1.5 text-[12px] font-medium text-ink-50 hover:bg-line/10";

// Una tarjeta por documento: subir o reemplazar (foto o PDF), ver el archivo, poner el vencimiento y marcar "no lo tengo".
const MisDocumentos = ({ userId, documents, noTiene, onChange, onNoTieneChange }) => {
  const [busy, setBusy] = useState({});
  const [errors, setErrors] = useState({});
  // Fecha escrita antes de subir el archivo (todavia no hay documento donde guardarla): se manda junto con el archivo.
  const [fechas, setFechas] = useState({});

  const byType = useMemo(() => {
    const map = {};
    for (const d of documents) if (!map[d.tipoDocumento]) map[d.tipoDocumento] = d;
    return map;
  }, [documents]);

  const flag = (setter, tipo, value) => setter((prev) => ({ ...prev, [tipo]: value }));

  const run = async (tipo, job) => {
    flag(setBusy, tipo, true);
    flag(setErrors, tipo, "");
    try {
      await job();
    } catch (err) {
      flag(setErrors, tipo, parseApiError(err).message);
    } finally {
      flag(setBusy, tipo, false);
    }
  };

  const handleFile = (tipo) => (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!DOC_ACCEPT.split(",").includes(file.type)) {
      flag(setErrors, tipo, "Sube una foto (JPG, PNG o WEBP) o un PDF.");
      return;
    }
    if (file.size > DOC_MAX_MB * 1024 * 1024) {
      flag(setErrors, tipo, `El archivo pesa mas de ${DOC_MAX_MB} MB.`);
      return;
    }
    const existing = byType[tipo];
    const fecha = fechas[tipo] || undefined;
    run(tipo, async () => {
      const doc = existing
        ? await updateDocumentRequest(existing.id, { file, fechaScadenza: fecha })
        : await createDocumentRequest(userId, tipo, file, fecha);
      flag(setFechas, tipo, undefined);
      onChange(doc);
    });
  };

  const handleDate = (tipo) => (e) => {
    const value = e.target.value;
    flag(setFechas, tipo, value);
    const existing = byType[tipo];
    if (!value || !existing) return;
    run(tipo, async () => {
      const doc = await updateDocumentRequest(existing.id, { fechaScadenza: value });
      flag(setFechas, tipo, undefined);
      onChange(doc);
    });
  };

  const handleNoTiene = (tipo) => (checked) =>
    run(tipo, () => onNoTieneChange(checked ? [...new Set([...noTiene, tipo])] : noTiene.filter((t) => t !== tipo)));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-ink-300">
        Sube una foto o un PDF de cada documento. Solo los ve la oficina. Si no tienes alguno, marca «No lo tengo».
      </p>
      {MIS_DOCUMENTOS.map(({ tipo, vence, fechaLabel, nota }) => {
        const doc = byType[tipo];
        const working = Boolean(busy[tipo]);
        const sinDocumento = !doc && noTiene.includes(tipo);
        const status = doc
          ? vence
            ? documentStatus(doc)
            : { label: "Subido", tone: "success" }
          : sinDocumento
            ? { label: "No lo tiene", tone: "neutral" }
            : { label: "Falta", tone: "warning" };
        const fecha = fechas[tipo] ?? toDateInputValue(doc?.fechaScadenza);
        return (
          <div key={tipo} className="rounded-xl border border-line/10 px-3 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-500/15 text-ink-300">
                <FileTextIcon className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium leading-tight text-ink-50">{TIPO_DOCUMENTO_LABELS[tipo]}</span>
                <span className="block text-[12px] text-ink-400">
                  {doc
                    ? vence && doc.fechaScadenza
                      ? `Valido hasta ${formatDateOnly(doc.fechaScadenza)}`
                      : vence
                        ? "Agrega la fecha de vencimiento"
                        : `Subido el ${formatDateOnly(doc.updatedAt ?? doc.createdAt)}`
                    : sinDocumento
                      ? "Marcado como que no lo tienes"
                      : "Todavia no lo subiste"}
                </span>
              </span>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>

            {!sinDocumento && (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {doc && (
                    <a href={doc.archivoUrl} target="_blank" rel="noreferrer" className={DOC_BUTTON_CLASS}>
                      Ver
                    </a>
                  )}
                  <label className={DOC_BUTTON_CLASS}>
                    {working ? <Spinner className="h-3.5 w-3.5" /> : doc ? "Reemplazar" : "Subir archivo"}
                    <input type="file" accept={DOC_ACCEPT} className="hidden" onChange={handleFile(tipo)} disabled={working} />
                  </label>
                  <CameraPickButton onChange={handleFile(tipo)} disabled={working} className={DOC_BUTTON_CLASS} />
                </div>

                {vence && (
                  <label className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="shrink-0 text-[11px] uppercase tracking-wide text-ink-400">{fechaLabel ?? "Vence"}</span>
                    <input
                      type="date"
                      value={fecha}
                      onChange={handleDate(tipo)}
                      disabled={working}
                      className="glass-input min-w-[9rem] flex-1 rounded-lg px-2 py-1 text-[13px] text-ink-50"
                    />
                  </label>
                )}
                {doc && vence && (
                  <p className="mt-1 text-[11px] text-ink-400">Si renovaste el documento, cambia la fecha de vencimiento.</p>
                )}
              </>
            )}

            {nota && <p className="mt-2 text-[11px] leading-snug text-ink-400">{nota}</p>}

            {!doc && (
              <div className="mt-3 border-t border-line/10 pt-3">
                <Switch
                  small
                  id={`no-tiene-${tipo}`}
                  label="No lo tengo"
                  checked={sinDocumento}
                  onChange={handleNoTiene(tipo)}
                  disabled={working}
                />
              </div>
            )}
            {errors[tipo] && <p className="mt-2 text-[12px] text-danger-500">{errors[tipo]}</p>}
          </div>
        );
      })}
    </div>
  );
};

// Formulario inline reutilizado por "Informacion personal" y "Contacto de emergencia".
const InlineForm = ({ fields, values, onChange, onSave, onCancel, saving, error }) => (
  <div className="flex flex-col gap-3">
    <Alert>{error}</Alert>
    {fields.map((field) => (
      <TextField
        key={field.name}
        id={`profile-${field.name}`}
        label={field.label}
        type={field.type ?? "text"}
        value={values[field.name]}
        onChange={(e) => onChange(field.name, e.target.value)}
        placeholder={field.placeholder}
        maxLength={field.maxLength}
      />
    ))}
    <div className="mt-1 flex justify-end gap-2">
      <Button variant="ghost" className="w-auto px-5 py-2 text-[13px]" disabled={saving} onClick={onCancel}>
        Cancelar
      </Button>
      <Button className="w-auto px-5 py-2 text-[13px]" loading={saving} onClick={onSave}>
        Guardar
      </Button>
    </div>
  </div>
);

const PersonalFields = [
  { name: "nombre", label: "Nombre", maxLength: 100 },
  { name: "apellido", label: "Apellido", maxLength: 100 },
  { name: "numeroCelular", label: "Telefono", type: "tel", maxLength: 30 },
  { name: "direccion", label: "Direccion", placeholder: "Calle, numero, ciudad", maxLength: 200 },
];

const EmergencyFields = [
  { name: "contactoEmergenciaNombre", label: "Nombre", maxLength: 100 },
  { name: "contactoEmergenciaParentesco", label: "Parentesco", placeholder: "Familiar, pareja, amigo...", maxLength: 50 },
  { name: "contactoEmergenciaTelefono", label: "Telefono", type: "tel", maxLength: 30 },
];

const ChangePasswordModal = ({ onClose, onDone }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saving, onClose]);

  const handleSave = async () => {
    if (!currentPassword) {
      setError("Escribe tu contrasena actual");
      return;
    }
    if (password.length < 8) {
      setError("La contrasena debe tener al menos 8 caracteres");
      return;
    }
    if (password !== confirm) {
      setError("Las contrasenas no coinciden");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { token } = await changePasswordRequest({ currentPassword, newPassword: password });
      // El servidor cerro las demas sesiones y emitio una nueva para esta: sin guardarla, la app quedaria deslogueada.
      setToken(token);
      onDone();
    } catch (err) {
      setError(parseApiError(err).message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => !saving && onClose()}
        className="absolute inset-0 bg-backdrop backdrop-blur-sm"
      />
      <div className="glass-surface relative z-10 w-full max-w-sm rounded-3xl bg-background p-6">
        <h2 className="text-[17px] font-semibold text-ink-50">Cambiar contrasena</h2>
        <p className="mt-1 text-[13px] text-ink-300">Minimo 8 caracteres.</p>

        <div className="mt-4 flex flex-col gap-3">
          <Alert>{error}</Alert>
          <PasswordField
            id="current-password"
            label="Contrasena actual"
            icon={KeyIcon}
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <PasswordField
            id="new-password"
            label="Nueva contrasena"
            icon={KeyIcon}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordField
            id="confirm-password"
            label="Repetir contrasena"
            icon={KeyIcon}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" className="sm:w-auto sm:px-6" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button className="sm:w-auto sm:px-6" loading={saving} onClick={handleSave}>
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
};

// Alertas del equipo (solo OWNER/ADMIN): documentos de choferes vencidos o por vencer.
// Es lo que un Admin necesita al entrar a su perfil.
const TeamAlerts = () => {
  const [state, setState] = useState({ loading: true, error: "", users: [], documents: [] });

  useEffect(() => {
    let cancelled = false;
    Promise.all([listUsersRequest(), listDocumentsRequest()])
      .then(([users, documents]) => {
        if (!cancelled) setState({ loading: false, error: "", users, documents });
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, error: parseApiError(err).message, users: [], documents: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const docAlerts = useMemo(() => {
    const activeDrivers = state.users.filter((u) => u.cargo === "CHOFER" && u.estado === "ACTIVO");
    const driversById = new Map(activeDrivers.map((u) => [u.id, u]));
    const alerts = state.documents
      .filter((d) => driversById.has(d.usuarioId) && d.fechaScadenza)
      .map((d) => ({ document: d, driver: driversById.get(d.usuarioId), status: documentStatus(d) }))
      .filter((a) => a.status.key === "vencido" || a.status.key === "por-vencer")
      .sort((a, b) => a.status.days - b.status.days);
    return alerts;
  }, [state]);

  if (state.loading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );
  }
  if (state.error) return <Alert>{state.error}</Alert>;

  if (docAlerts.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-success-500/10 px-4 py-3 text-[14px] text-success-500">
        <CheckCircleIcon className="h-5 w-5 shrink-0" />
        Todo en orden: sin documentos por vencer.
      </div>
    );
  }

  const shown = docAlerts.slice(0, 6);

  return (
    <div className="flex flex-col gap-1">
      {shown.map(({ document, driver, status }) => (
        <Link
          key={document.id}
          to={`/choferes/${driver.id}`}
          className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-line/[0.06]"
        >
          <Avatar user={driver} className="h-9 w-9 text-[12px]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium text-ink-50">
              {driver.nombre} {driver.apellido}
            </span>
            <span className="block truncate text-[12px] text-ink-400">
              {TIPO_DOCUMENTO_LABELS[document.tipoDocumento] ?? document.tipoDocumento} -{" "}
              {formatDateOnly(document.fechaScadenza)}
            </span>
          </span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </Link>
      ))}
      {docAlerts.length > shown.length && (
        <Link to="/choferes" className="px-2 py-1 text-[12px] font-medium text-accent-400 hover:text-accent-300">
          Ver los {docAlerts.length - shown.length} restantes en Choferes
        </Link>
      )}
    </div>
  );
};

// Servicios y km del mes del propio chofer. El backend ya filtra por actor, asi que un
// CHOFER solo recibe los suyos.
const MyMonth = () => {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    listRecordsByMonthRequest(now.getFullYear(), now.getMonth() + 1)
      .then((data) => {
        if (!cancelled) setRecords(data);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!records) {
    return (
      <div className="flex justify-center py-4">
        <Spinner />
      </div>
    );
  }

  const valid = records.filter((r) => r.estado !== "ANNULLATO");
  const entregados = valid.filter((r) => r.estado === "CONSEGNATO").length;
  const km = valid.reduce((total, r) => total + kmRecorrido(r), 0);

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {[
        { label: "Servicios", value: valid.length },
        { label: "Entregados", value: entregados },
        { label: "Recorridos", value: formatKm(km) },
      ].map((item) => (
        <div key={item.label} className="glass-surface-sm rounded-xl px-3 py-3">
          <span className="block text-[11px] uppercase tracking-wide text-ink-400">{item.label}</span>
          <span className="mt-1 block text-[18px] font-semibold text-ink-50">{item.value}</span>
        </div>
      ))}
    </div>
  );
};

export const ProfilePage = () => {
  const { user, setUser } = useAuth();
  const isChofer = user?.cargo === "CHOFER";
  // Choferes, Responsables y Admin suben sus propios documentos desde aqui (los usuarios cliente y Recursos Humanos no, por ahora).
  const canSelfUpload = ["CHOFER", "ADMIN", "OWNER"].includes(user?.cargo);
  const isOwner = user?.cargo === "OWNER";
  const isRrhh = user?.cargo === "RRHH";

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  // Edicion inline: "personal" | "emergency" | null (una sola a la vez).
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [documents, setDocuments] = useState(null);
  const [documentsError, setDocumentsError] = useState("");

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  const [savingReperibilidad, setSavingReperibilidad] = useState(false);
  const [reperibilidadError, setReperibilidadError] = useState("");

  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    // Un CHOFER siempre recibe solo los suyos; OWNER/ADMIN necesita pasar su propio id.
    listDocumentsRequest(user.id)
      .then((data) => {
        if (!cancelled) setDocuments(data);
      })
      .catch((err) => {
        if (!cancelled) setDocumentsError(parseApiError(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const sortedDocuments = useMemo(() => {
    if (!documents) return [];
    // Primero lo urgente (vencido / por vencer), despues lo vigente y lo sin fecha.
    const rank = (d) => {
      const s = documentStatus(d);
      return s.days == null ? Number.MAX_SAFE_INTEGER : s.days;
    };
    return [...documents].sort((a, b) => rank(a) - rank(b));
  }, [documents]);

  // Los de la empresa (contrato, UNILAV...) los carga la oficina: se ven pero no se cambian desde aqui.
  const companyDocuments = useMemo(
    () => sortedDocuments.filter((d) => !MIS_DOCUMENTOS.some((m) => m.tipo === d.tipoDocumento)),
    [sortedDocuments]
  );

  const startEdit = useCallback(
    (section) => {
      const fields = section === "personal" ? PersonalFields : EmergencyFields;
      setForm(Object.fromEntries(fields.map((f) => [f.name, user?.[f.name] ?? ""])));
      setFormError("");
      setEditing(section);
    },
    [user]
  );

  const handleSave = async () => {
    const fields = editing === "personal" ? PersonalFields : EmergencyFields;
    const payload = {};
    for (const field of fields) {
      const value = (form[field.name] ?? "").trim();
      if (editing === "personal" && field.name !== "direccion" && !value) {
        setFormError(`${field.label} es obligatorio`);
        return;
      }
      // Los campos opcionales vacios se guardan como null para poder borrarlos.
      payload[field.name] = field.name === "direccion" || editing === "emergency" ? value || null : value;
    }
    setSaving(true);
    setFormError("");
    try {
      const updated = await updateUserRequest(user.id, payload);
      setUser(updated);
      setEditing(null);
    } catch (err) {
      setFormError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAvatarUploading(true);
    setAvatarError("");
    try {
      const updated = await uploadUserAvatarRequest(user.id, file);
      setUser(updated);
    } catch (err) {
      setAvatarError(parseApiError(err).message);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleToggleReperibilidad = async (checked) => {
    setSavingReperibilidad(true);
    setReperibilidadError("");
    try {
      const updated = await updateMyReperibilidadRequest(checked);
      setUser(updated);
    } catch (err) {
      setReperibilidadError(parseApiError(err).message);
    } finally {
      setSavingReperibilidad(false);
    }
  };

  const age = ageFromBirthdate(user?.fechaNacimiento);
  const hasEmergency = Boolean(user?.contactoEmergenciaNombre || user?.contactoEmergenciaTelefono);
  const areaKeys = userAreaKeys(user);

  return (
    <div className="flex flex-col gap-5">
      {/* Cabecera */}
      <div className="relative overflow-hidden rounded-2xl border border-line/15 bg-[#050d1b]">
        <img
          src={heroImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-right opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050d1b] via-[#050d1b]/85 to-[#050d1b]/30" />

        <div className="relative flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left lg:flex-1">
            <div className="relative shrink-0">
              <Avatar
                user={user}
                className="h-28 w-28 border-4 border-white/90 bg-white/15! text-3xl text-white! sm:h-32 sm:w-32"
              />
              <label
                className="absolute bottom-1 right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg transition-colors hover:bg-brand-light"
                title="Cambiar foto de perfil"
              >
                {avatarUploading ? <Spinner className="h-4 w-4" /> : <CameraIcon className="h-4.5 w-4.5" />}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={avatarUploading}
                />
              </label>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
                <h1 className="text-[26px] font-semibold leading-tight text-white sm:text-[30px]">
                  {user?.nombre} {user?.apellido}
                </h1>
                <Badge tone={user?.estado === "ACTIVO" ? "success" : "danger"} className="px-3 py-1 text-[12px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {user?.estado === "ACTIVO" ? "Activo" : "Inactivo"}
                </Badge>
              </div>
              <p className="mt-1 text-[16px] font-medium text-brand-bright">
                {roleText(user)}
              </p>
              <p className="text-[14px] text-white/75">ONE DRIVER Express</p>
              {avatarError && <p className="mt-2 text-[13px] text-danger-500">{avatarError}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-5 border-t border-white/10 pt-5 lg:w-[420px] lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <HeaderFact icon={BriefcaseIcon} label="Rol" value={roleText(user)} />
            <HeaderFact icon={ShieldIcon} label="Area" value={areaLabel(user?.area)} />
            <HeaderFact icon={CalendarIcon} label="Miembro desde" value={formatDate(user?.createdAt)} />
            <HeaderFact
              icon={MapPinIcon}
              label={user?.grupo ? "Grupo" : "Correo"}
              value={user?.grupo ? (GRUPO_LABELS[user.grupo] ?? user.grupo) : user?.correoElectronico}
            />
          </div>
        </div>
      </div>

      {passwordChanged && (
        <div className="flex items-center gap-3 rounded-xl bg-success-500/10 px-4 py-3 text-[14px] text-success-500">
          <CheckCircleIcon className="h-5 w-5 shrink-0" />
          Contrasena actualizada.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Columna 1: informacion personal */}
        <Section
          icon={UserIcon}
          title="Informacion personal"
          action={editing !== "personal" && <EditButton onClick={() => startEdit("personal")} />}
          className="self-start"
        >
          {editing === "personal" ? (
            <InlineForm
              fields={PersonalFields}
              values={form}
              onChange={(name, value) => setForm((prev) => ({ ...prev, [name]: value }))}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
              saving={saving}
              error={formError}
            />
          ) : (
            <div className="divide-y divide-line/10">
              <InfoRow icon={UserIcon} label="Nombre completo" value={`${user?.nombre ?? ""} ${user?.apellido ?? ""}`.trim()} />
              <InfoRow
                icon={MailIcon}
                label="Correo electronico"
                value={user?.correoElectronico}
                href={`mailto:${user?.correoElectronico}`}
              />
              <InfoRow
                icon={PhoneIcon}
                label="Telefono"
                value={user?.numeroCelular}
                href={user?.numeroCelular ? `tel:${user.numeroCelular.replace(/\s/g, "")}` : undefined}
              />
              <InfoRow
                icon={CalendarIcon}
                label="Fecha de nacimiento"
                value={
                  user?.fechaNacimiento
                    ? `${formatDateOnly(user.fechaNacimiento)}${age != null ? ` (${age} anos)` : ""}`
                    : null
                }
              />
              <InfoRow icon={HomeIcon} label="Direccion" value={user?.direccion} />
            </div>
          )}
        </Section>

        {/* Columna 2: lo propio de cada rol */}
        <div className="flex flex-col gap-5">
          {isChofer ? (
            <>
              <Section icon={ClipboardListIcon} title="Mi mes">
                <MyMonth />
              </Section>
            </>
          ) : isRrhh ? (
            <Section icon={ShieldIcon} title="Acceso y permisos" action={<Badge tone="success">Recursos Humanos</Badge>}>
              <ul className="flex flex-col gap-2.5 text-[14px] text-ink-50">
                {["Choferes: datos, documentos y estado", "Vehiculos", "Carga de la busta paga de todo el personal"].map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <CheckCircleIcon className="h-4.5 w-4.5 shrink-0 text-success-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </Section>
          ) : (
            <>
              <Section icon={ShieldIcon} title="Acceso y permisos" action={<Badge tone="success">{isOwner ? "Total" : "Por area"}</Badge>}>
                <ul className="flex flex-col gap-2.5 text-[14px] text-ink-50">
                  {(isOwner
                    ? [
                        "Registros de todas las areas",
                        "Choferes, vehiculos y documentos",
                        "Mapa, seguimiento, Area C y excesos de velocidad",
                        "Dashboard con facturacion y costos",
                      ]
                    : [
                        areaKeys
                          ? areaKeys.length > 0
                            ? `Servicios de: ${areaKeys.map((k) => AREA_LABEL_BY_KEY[k] ?? k).join(", ")}`
                            : "Todavia no tienes areas asignadas (pidelas a un Admin)"
                          : "Registros de todas las areas",
                        "Choferes, vehiculos y documentos",
                        "Mapa, seguimiento, Area C y excesos de velocidad",
                      ]
                  ).map((item) => (
                    <li key={item} className="flex items-center gap-2.5">
                      <CheckCircleIcon className="h-4.5 w-4.5 shrink-0 text-success-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Section>

              <Section icon={AlertTriangleIcon} title="Alertas del equipo">
                <TeamAlerts />
              </Section>
            </>
          )}
          {/* La busta paga la recibe todo el personal, sea cual sea su cargo */}
          <MisBustaPagaCard />
        </div>

        {/* Columna 3: emergencia, documentos y acciones */}
        <div className="flex flex-col gap-5">
          <Section
            icon={PhoneIcon}
            title="Contacto de emergencia"
            action={editing !== "emergency" && <EditButton onClick={() => startEdit("emergency")} />}
          >
            {editing === "emergency" ? (
              <InlineForm
                fields={EmergencyFields}
                values={form}
                onChange={(name, value) => setForm((prev) => ({ ...prev, [name]: value }))}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
                saving={saving}
                error={formError}
              />
            ) : hasEmergency ? (
              <div className="flex items-center gap-3.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-[18px] font-semibold text-accent-300">
                  {(user.contactoEmergenciaNombre ?? "?")[0].toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink-50">
                    {user.contactoEmergenciaNombre ?? "Sin nombre"}
                  </span>
                  {user.contactoEmergenciaParentesco && (
                    <span className="block text-[12px] text-ink-400">{user.contactoEmergenciaParentesco}</span>
                  )}
                  <span className="block text-[13px] text-ink-300">
                    {user.contactoEmergenciaTelefono ?? "Sin telefono"}
                  </span>
                </div>
                {user.contactoEmergenciaTelefono && (
                  <a
                    href={`tel:${user.contactoEmergenciaTelefono.replace(/\s/g, "")}`}
                    aria-label="Llamar al contacto de emergencia"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-500/15 text-success-500 transition-colors hover:bg-success-500/25"
                  >
                    <PhoneIcon className="h-5 w-5" />
                  </a>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-ink-300">
                Todavia no cargaste un contacto de emergencia. Es util si te pasa algo en ruta.
              </p>
            )}
          </Section>

          <Section icon={FileTextIcon} title={canSelfUpload ? "Mis documentos" : "Documentos"}>
            <Alert>{documentsError}</Alert>
            {!documents && !documentsError && (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            )}
            {canSelfUpload && documents && (
              <>
                <MisDocumentos
                  userId={user.id}
                  documents={documents}
                  noTiene={user.documentosNoTiene ?? []}
                  onChange={(doc) => {
                    setDocuments((prev) => [doc, ...(prev ?? []).filter((d) => d.id !== doc.id)]);
                    // Subir un documento lo saca de "no lo tengo" (lo hace el servidor): se refleja aqui.
                    setUser((prev) =>
                      prev?.documentosNoTiene?.includes(doc.tipoDocumento)
                        ? { ...prev, documentosNoTiene: prev.documentosNoTiene.filter((t) => t !== doc.tipoDocumento) }
                        : prev
                    );
                  }}
                  onNoTieneChange={async (lista) => {
                    const updated = await updateUserRequest(user.id, { documentosNoTiene: lista });
                    setUser(updated);
                  }}
                />
                {companyDocuments.length > 0 && (
                  <div className="mt-4 border-t border-line/10 pt-3">
                    <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-ink-400">Documentos de la empresa</p>
                    <div className="flex flex-col">
                      {companyDocuments.map((document) => (
                        <DocumentItem key={document.id} document={document} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {!canSelfUpload && documents && sortedDocuments.length === 0 && (
              <p className="text-[13px] text-ink-300">Todavia no hay documentos cargados.</p>
            )}
            {!canSelfUpload && sortedDocuments.length > 0 && (
              <div className="flex flex-col">
                {sortedDocuments.map((document) => (
                  <DocumentItem key={document.id} document={document} />
                ))}
              </div>
            )}
          </Section>

          <Section icon={ZapIcon} title="Acciones rapidas">
            <div className="grid grid-cols-2 gap-2.5">
              {isChofer ? (
                <QuickAction icon={ClipboardListIcon} label="Mis registros" to="/records" />
              ) : (
                <>
                  <QuickAction icon={PlusIcon} label="Nuevo registro" to="/records" />
                  <QuickAction icon={UsersIcon} label="Choferes" to="/choferes" />
                  <QuickAction icon={TruckIcon} label="Vehiculos" to="/vehiculos" />
                </>
              )}
              <QuickAction icon={KeyIcon} label="Contrasena" onClick={() => setPasswordOpen(true)} />
              <QuickAction icon={SettingsIcon} label="Ajustes de la app" to="/ajustes" />
            </div>

            {isChofer && user?.area === "EXTRAS_PIAZZA" && (
              <div className="mt-4 border-t border-line/10 pt-4">
                <Alert>{reperibilidadError}</Alert>
                <Switch
                  id="reperibilidad-no-disponible"
                  label="No estoy disponible esta noche"
                  description="Activalo si no queres aparecer en el listado de reperibilita por si sale un pedido de Extras Piazza. Se resetea solo al dia siguiente."
                  checked={Boolean(user?.reperibilidadNoDisponible) && isToday(user?.reperibilidadActualizada)}
                  disabled={savingReperibilidad}
                  onChange={handleToggleReperibilidad}
                />
              </div>
            )}

            {isChofer && (
              <div className="mt-4 border-t border-line/10 pt-4">
                <GpsRespaldoBlock />
              </div>
            )}

            {PHONE_GPS_ENABLED && isChofer && (
              <div className="mt-4 border-t border-line/10 pt-4">
                <LocationSharingBlock />
              </div>
            )}
          </Section>
        </div>
      </div>

      {passwordOpen && (
        <ChangePasswordModal
          onClose={() => setPasswordOpen(false)}
          onDone={() => {
            setPasswordOpen(false);
            setPasswordChanged(true);
          }}
        />
      )}
    </div>
  );
};
