import clsx from "clsx";
import { MisBustaPagaCard } from "../../components/bustapaga/MisBustaPagaCard";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import heroImage from "../../assets/login-hero.webp";
import { LocationSharingBlock } from "../../components/profile/LocationSharingBlock";
import { Alert } from "../../components/ui/Alert";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
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
import { listDocumentsRequest } from "../../lib/documents.api";
import { formatDate, formatDateOnly, formatKm } from "../../lib/format";
import { AREA_LABEL_BY_KEY, roleText, userAreaKeys } from "../../lib/roles";
import { listRecordsByMonthRequest } from "../../lib/records.api";
import {
  listUsersRequest,
  updateMyReperibilidadRequest,
  updateUserRequest,
  uploadUserAvatarRequest,
} from "../../lib/users.api";
import { kmRecorrido } from "../../lib/km";

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

const ChangePasswordModal = ({ userId, onClose, onDone }) => {
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
      await updateUserRequest(userId, { password });
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

// Alertas del equipo (solo OWNER/ADMIN): documentos de choferes vencidos o por vencer y
// choferes activos sin vehiculo asignado. Es lo que un Admin necesita al entrar a su perfil.
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

  const { docAlerts, sinVehiculo } = useMemo(() => {
    const activeDrivers = state.users.filter((u) => u.cargo === "CHOFER" && u.estado === "ACTIVO");
    const driversById = new Map(activeDrivers.map((u) => [u.id, u]));
    const alerts = state.documents
      .filter((d) => driversById.has(d.usuarioId) && d.fechaScadenza)
      .map((d) => ({ document: d, driver: driversById.get(d.usuarioId), status: documentStatus(d) }))
      .filter((a) => a.status.key === "vencido" || a.status.key === "por-vencer")
      .sort((a, b) => a.status.days - b.status.days);
    return {
      docAlerts: alerts,
      sinVehiculo: activeDrivers.filter((u) => !u.vehiculoAsignadoId),
    };
  }, [state]);

  if (state.loading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );
  }
  if (state.error) return <Alert>{state.error}</Alert>;

  if (docAlerts.length === 0 && sinVehiculo.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-success-500/10 px-4 py-3 text-[14px] text-success-500">
        <CheckCircleIcon className="h-5 w-5 shrink-0" />
        Todo en orden: sin documentos por vencer ni choferes sin vehiculo.
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

      {sinVehiculo.length > 0 && (
        <Link
          to="/choferes"
          className="mt-2 flex items-center gap-3 rounded-xl bg-warning-500/10 px-3 py-2.5 text-[13px] text-warning-500 transition-colors hover:bg-warning-500/15"
        >
          <AlertTriangleIcon className="h-5 w-5 shrink-0" />
          <span className="min-w-0 flex-1">
            {sinVehiculo.length === 1
              ? "1 chofer activo sin vehiculo asignado"
              : `${sinVehiculo.length} choferes activos sin vehiculo asignado`}
          </span>
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

  const missingDocuments = useMemo(() => {
    if (!documents) return [];
    const present = new Set(documents.map((d) => d.tipoDocumento));
    return Object.keys(TIPO_DOCUMENTO_LABELS).filter((tipo) => !present.has(tipo));
  }, [documents]);

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
  const vehicle = user?.vehiculoAsignado;
  const hasNextService = Boolean(user?.proximoServicioFecha || user?.proximoServicioNota);

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
              <p className="text-[14px] text-white/75">Gamonal Driver 2.0</p>
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
              <Section icon={TruckIcon} title="Mi vehiculo y proximo servicio">
                <div className="divide-y divide-line/10">
                  <InfoRow
                    icon={TruckIcon}
                    label="Vehiculo habitual"
                    value={vehicle ? `${vehicle.targa}${vehicle.modelo ? ` - ${vehicle.modelo}` : ""}` : null}
                  />
                  <InfoRow
                    icon={CalendarIcon}
                    label="Proximo servicio"
                    value={
                      hasNextService
                        ? [user.proximoServicioFecha && formatDate(user.proximoServicioFecha), user.proximoServicioNota]
                            .filter(Boolean)
                            .join(" - ")
                        : null
                    }
                  />
                </div>
              </Section>

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

          <Section icon={FileTextIcon} title="Documentos">
            <Alert>{documentsError}</Alert>
            {!documents && !documentsError && (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            )}
            {documents && sortedDocuments.length === 0 && (
              <p className="text-[13px] text-ink-300">Todavia no hay documentos cargados.</p>
            )}
            {sortedDocuments.length > 0 && (
              <div className="flex flex-col">
                {sortedDocuments.map((document) => (
                  <DocumentItem key={document.id} document={document} />
                ))}
              </div>
            )}
            {isChofer && missingDocuments.length > 0 && sortedDocuments.length > 0 && (
              <p className="mt-3 border-t border-line/10 pt-3 text-[12px] text-ink-400">
                Sin subir: {missingDocuments.map((tipo) => TIPO_DOCUMENTO_LABELS[tipo]).join(", ")}
              </p>
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
          userId={user.id}
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
