import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { GlassCard } from "../../components/ui/GlassCard";
import { PageLoader } from "../../components/ui/PageLoader";
import { PasswordField } from "../../components/ui/PasswordField";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { Switch } from "../../components/ui/Switch";
import { TextField } from "../../components/ui/TextField";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { AREA_ACCESS_OPTIONS, AREA_LABEL_BY_KEY } from "../../lib/roles";
import { listClienteUsersRequest } from "../../lib/cliente.api";
import { listClientsRequest } from "../../lib/clients.api";
import { CLIENTE_MODULO_CORTO, CLIENTE_MODULOS, CLIENTE_MODULOS_DEFAULT, toggleModulo } from "../../lib/clientes";
import { createUserRequest, deleteUserRequest, updateUserRequest, uploadUserAvatarRequest } from "../../lib/users.api";

const EMPTY_FORM = { nombre: "", apellido: "", correoElectronico: "", password: "", clienteId: "", clienteAreas: [], clienteModulos: CLIENTE_MODULOS_DEFAULT, activo: true };

const moduloLabel = (key) => CLIENTE_MODULOS.find((m) => m.key === key)?.label ?? key;

// Alta y edicion de un usuario cliente: su empresa y las casillas de lo que puede ver.
const ClienteUsuarioForm = ({ initial, clientes, onSaved, onCancel }) => {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(
    initial
      ? { nombre: initial.nombre, apellido: initial.apellido, correoElectronico: initial.correoElectronico, password: "", clienteId: initial.clienteId ?? "", clienteAreas: initial.clienteAreas ?? [], clienteModulos: initial.clienteModulos ?? [], activo: initial.estado === "ACTIVO" }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const logoPreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : null), [logoFile]);
  useEffect(() => () => logoPreview && URL.revokeObjectURL(logoPreview), [logoPreview]);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const onChange = (field) => (e) => setField(field, e.target.value);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setFieldErrors({});
    let savedId = null;
    try {
      if (isEdit) {
        const payload = {
          nombre: form.nombre,
          apellido: form.apellido,
          correoElectronico: form.correoElectronico,
          clienteId: form.clienteId || null,
          clienteAreas: form.clienteAreas,
          clienteModulos: form.clienteModulos,
          estado: form.activo ? "ACTIVO" : "INACTIVO",
        };
        if (form.password) payload.password = form.password;
        await updateUserRequest(initial.id, payload);
        savedId = initial.id;
      } else {
        const created = await createUserRequest({
          nombre: form.nombre,
          apellido: form.apellido,
          correoElectronico: form.correoElectronico,
          password: form.password,
          cargo: "CLIENTE",
          clienteId: form.clienteId || undefined,
          clienteAreas: form.clienteAreas,
          clienteModulos: form.clienteModulos,
        });
        savedId = created.id;
      }
      // El logo se sube aparte: si falla, el usuario ya quedo guardado y se avisa para reintentarlo desde Editar.
      let warning = "";
      if (logoFile) {
        try {
          await uploadUserAvatarRequest(savedId, logoFile, { logo: true });
        } catch (logoErr) {
          warning = `El usuario se guardo, pero el logo no se pudo subir: ${parseApiError(logoErr).message} Editalo para volver a intentarlo.`;
        }
      }
      onSaved(warning);
    } catch (err) {
      const parsed = parseApiError(err);
      setError(parsed.message);
      setFieldErrors(parsed.fieldErrors || {});
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassCard>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div>
          <h2 className="text-[17px] font-semibold text-ink-50">{isEdit ? "Editar usuario cliente" : "Nuevo usuario cliente"}</h2>
          <p className="mt-1 text-[13px] text-ink-300">
            Entra con su propia vista: solo ve el seguimiento de los servicios que le des (por spedizione o por empresa), sin las pantallas de chofer ni de oficina.
          </p>
        </div>
        <Alert>{error}</Alert>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField id="cu-nombre" label="Nombre" value={form.nombre} onChange={onChange("nombre")} error={fieldErrors.nombre?.[0]} required />
          <TextField id="cu-apellido" label="Apellido" value={form.apellido} onChange={onChange("apellido")} error={fieldErrors.apellido?.[0]} required />
          <TextField
            id="cu-correo"
            label="Correo electronico"
            type="email"
            value={form.correoElectronico}
            onChange={onChange("correoElectronico")}
            error={fieldErrors.correoElectronico?.[0]}
            required
          />
          <PasswordField
            id="cu-password"
            label={isEdit ? "Contrasena nueva (opcional)" : "Contrasena"}
            placeholder="Minimo 8 caracteres"
            value={form.password}
            onChange={onChange("password")}
            error={fieldErrors.password?.[0]}
            required={!isEdit}
          />
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-300">Logo de la empresa (opcional)</span>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1">
              {logoPreview || initial?.imagenUrl ? (
                <img src={logoPreview ?? initial.imagenUrl} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-[11px] text-gray-400">Sin logo</span>
              )}
            </span>
            <label htmlFor="cu-logo" className="inline-flex cursor-pointer items-center rounded-xl border border-line/30 px-3.5 py-2 text-[13px] font-medium text-ink-50 transition-colors hover:bg-line/10">
              {logoPreview || initial?.imagenUrl ? "Cambiar logo" : "Subir logo"}
              <input id="cu-logo" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { setLogoFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            </label>
            <span className="text-[12px] text-ink-400">Aparece arriba a la izquierda, junto al nombre. Se ve entero, sin recortar.</span>
          </div>
        </div>

        <div>
          <span className="mb-1 block text-[13px] font-medium text-ink-300">Spedizioni que puede ver</span>
          <p className="mb-2 text-[12px] text-ink-400">Ve todos los servicios de las spedizioni que marques, no uno solo.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2.5">
            {AREA_ACCESS_OPTIONS.map((a) => (
              <label key={a.key} htmlFor={`cu-area-${a.key}`} className="flex cursor-pointer items-center gap-2 text-[14px] text-ink-100">
                <input
                  id={`cu-area-${a.key}`}
                  type="checkbox"
                  checked={form.clienteAreas.includes(a.key)}
                  onChange={() =>
                    setField("clienteAreas", form.clienteAreas.includes(a.key) ? form.clienteAreas.filter((k) => k !== a.key) : [...form.clienteAreas, a.key])
                  }
                  className="h-4 w-4 rounded border-line/20 bg-transparent accent-accent-500"
                />
                {a.label}
              </label>
            ))}
          </div>
          {fieldErrors.clienteAreas?.[0] && <span className="mt-1.5 block text-[13px] text-danger-500">{fieldErrors.clienteAreas[0]}</span>}
        </div>

        <div>
          <SearchableSelect
            id="cu-empresa"
            label="Empresa cliente (opcional)"
            placeholder="Escribe para buscar la empresa"
            options={clientes.map((c) => ({ value: c.id, label: c.nombre }))}
            value={form.clienteId}
            onChange={(v) => setField("clienteId", v)}
            error={fieldErrors.clienteId?.[0]}
          />
          <p className="mt-1.5 text-[12px] text-ink-400">
            Si la eliges, tambien ve los servicios de esa empresa (se suman a las spedizioni). Tiene que tener al menos una spedizione o una empresa.
          </p>
        </div>

        <div>
          <span className="mb-2 block text-[13px] font-medium text-ink-300">Que puede ver (solo lectura)</span>
          <div className="flex flex-col gap-2.5">
            {CLIENTE_MODULOS.map((m) => (
              <label key={m.key} htmlFor={`cu-mod-${m.key}`} className="flex cursor-pointer items-start gap-2.5">
                <input
                  id={`cu-mod-${m.key}`}
                  type="checkbox"
                  checked={form.clienteModulos.includes(m.key)}
                  onChange={() => setField("clienteModulos", toggleModulo(form.clienteModulos, m.key))}
                  className="mt-0.5 h-4 w-4 rounded border-line/20 bg-transparent accent-accent-500"
                />
                <span className="text-[14px] text-ink-100">
                  {m.label}
                  <span className="block text-[12px] text-ink-400">{m.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {fieldErrors.clienteModulos?.[0] && <span className="mt-1.5 block text-[13px] text-danger-500">{fieldErrors.clienteModulos[0]}</span>}
        </div>

        {isEdit && <Switch id="cu-activo" label="Usuario activo" description="Si lo desactivas, pierde el acceso de inmediato." checked={form.activo} onChange={(v) => setField("activo", v)} />}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={saving} className="!w-auto px-8">
            {isEdit ? "Guardar cambios" : "Crear usuario"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} className="!w-auto px-6">
            Cancelar
          </Button>
        </div>
      </form>
    </GlassCard>
  );
};

export const AccesoClientesPage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | usuario
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(() => {
    Promise.all([listClienteUsersRequest(), listClientsRequest()])
      .then(([list, empresas]) => {
        setUsers(list);
        setClientes(empresas);
        setError("");
      })
      .catch((err) => setError(parseApiError(err).message));
  }, []);

  useEffect(() => {
    if (user?.cargo === "OWNER") load();
  }, [user?.cargo, load]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const u of users ?? []) {
      const key = u.cliente?.nombre ?? (u.clienteAreas?.length ? "Por spedizione" : "Sin acceso asignado");
      map.set(key, [...(map.get(key) ?? []), u]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "es"));
  }, [users]);

  if (user?.cargo !== "OWNER") return <Navigate to="/" replace />;

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteUserRequest(toDelete.id);
      setToDelete(null);
      load();
    } catch (err) {
      setDeleteError(parseApiError(err).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold text-ink-50">Acceso de clientes</h1>
          <p className="mt-1 max-w-xl text-[14px] text-ink-300">
            Usuarios de empresas cliente para seguir sus servicios en camino. Solo ven lo suyo, en solo lectura, y solo lo que marques.
          </p>
        </div>
        {editing === null && (
          <Button className="!w-auto px-5" onClick={() => setEditing("new")}>
            + Nuevo usuario cliente
          </Button>
        )}
      </div>

      <Alert>{error}</Alert>

      {editing !== null && (
        <ClienteUsuarioForm
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          clientes={clientes}
          onCancel={() => setEditing(null)}
          onSaved={(warning) => {
            setEditing(null);
            setError(warning || "");
            load();
          }}
        />
      )}

      {!users && !error && <PageLoader />}
      {users && users.length === 0 && editing === null && (
        <p className="px-1 py-6 text-[14px] text-ink-400">Todavia no hay usuarios cliente. Crea el primero con «Nuevo usuario cliente».</p>
      )}

      {groups.map(([empresa, list]) => (
        <section key={empresa} className="flex flex-col gap-2">
          <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-400">
            {empresa} <span className="ml-1 font-normal normal-case">{list.length}</span>
          </h2>
          <div className="glass-surface rounded-2xl">
            {list.map((u, index) => (
              <div key={u.id} className={clsx("flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5", index > 0 && "border-t border-line/10")}>
                {u.imagenUrl && (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5">
                    <img src={u.imagenUrl} alt="" className="h-full w-full object-contain" />
                  </span>
                )}
                <div className="min-w-0 flex-1 basis-56">
                  <span className="block truncate text-[15px] font-semibold text-ink-50">
                    {u.nombre} {u.apellido}
                  </span>
                  <span className="block truncate text-[13px] text-ink-300">{u.correoElectronico}</span>
                  {(u.clienteAreas ?? []).length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {u.clienteAreas.map((key) => (
                        <span key={key} className="rounded-md bg-line/15 px-1.5 py-0.5 text-[11px] font-medium text-ink-100">
                          {AREA_LABEL_BY_KEY[key] ?? key}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {(u.clienteModulos ?? []).length === 0 && <span className="text-[12px] text-warning-500">Sin modulos marcados: no ve nada</span>}
                    {(u.clienteModulos ?? []).map((key) => (
                      <span key={key} title={moduloLabel(key)} className="rounded-md bg-accent-500/15 px-1.5 py-0.5 text-[11px] font-medium text-accent-300">
                        {CLIENTE_MODULO_CORTO[key] ?? key}
                      </span>
                    ))}
                  </span>
                </div>
                <span className={clsx("rounded-full px-2.5 py-0.5 text-[12px] font-medium", u.estado === "ACTIVO" ? "bg-success-500/15 text-success-500" : "bg-line/15 text-ink-400")}>
                  {u.estado === "ACTIVO" ? "Activo" : "Inactivo"}
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" className="!w-auto px-4 py-2 text-[13px]" onClick={() => setEditing(u)}>
                    Editar
                  </Button>
                  <Button variant="ghost" className="!w-auto px-4 py-2 text-[13px] text-danger-500" onClick={() => setToDelete(u)}>
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <ConfirmModal
        open={Boolean(toDelete)}
        title="Eliminar usuario cliente"
        description={toDelete ? `${toDelete.nombre} ${toDelete.apellido} perdera el acceso. Esta accion no se puede deshacer.` : ""}
        confirmLabel="Eliminar"
        error={deleteError}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};
