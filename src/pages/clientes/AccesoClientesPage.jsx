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
import { listClienteUsersRequest } from "../../lib/cliente.api";
import { listClientsRequest } from "../../lib/clients.api";
import { CLIENTE_MODULOS, CLIENTE_MODULOS_DEFAULT, toggleModulo } from "../../lib/clientes";
import { createUserRequest, deleteUserRequest, updateUserRequest } from "../../lib/users.api";

const EMPTY_FORM = { nombre: "", apellido: "", correoElectronico: "", password: "", clienteId: "", clienteModulos: CLIENTE_MODULOS_DEFAULT, activo: true };

const moduloLabel = (key) => CLIENTE_MODULOS.find((m) => m.key === key)?.label ?? key;

// Alta y edicion de un usuario cliente: su empresa y las casillas de lo que puede ver.
const ClienteUsuarioForm = ({ initial, clientes, onSaved, onCancel }) => {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(
    initial
      ? { nombre: initial.nombre, apellido: initial.apellido, correoElectronico: initial.correoElectronico, password: "", clienteId: initial.clienteId ?? "", clienteModulos: initial.clienteModulos ?? [], activo: initial.estado === "ACTIVO" }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const onChange = (field) => (e) => setField(field, e.target.value);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setFieldErrors({});
    try {
      if (isEdit) {
        const payload = {
          nombre: form.nombre,
          apellido: form.apellido,
          correoElectronico: form.correoElectronico,
          clienteId: form.clienteId || undefined,
          clienteModulos: form.clienteModulos,
          estado: form.activo ? "ACTIVO" : "INACTIVO",
        };
        if (form.password) payload.password = form.password;
        await updateUserRequest(initial.id, payload);
      } else {
        await createUserRequest({
          nombre: form.nombre,
          apellido: form.apellido,
          correoElectronico: form.correoElectronico,
          password: form.password,
          cargo: "CLIENTE",
          clienteId: form.clienteId || undefined,
          clienteModulos: form.clienteModulos,
        });
      }
      onSaved();
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
            Entra con su propia vista: solo ve el seguimiento de los servicios de su empresa, sin las pantallas de chofer ni de oficina.
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
          <div className="sm:col-span-2">
            <SearchableSelect
              id="cu-empresa"
              label="Empresa cliente"
              placeholder="Escribe para buscar la empresa"
              options={clientes.map((c) => ({ value: c.id, label: c.nombre }))}
              value={form.clienteId}
              onChange={(v) => setField("clienteId", v)}
              error={fieldErrors.clienteId?.[0]}
            />
            <p className="mt-1.5 text-[12px] text-ink-400">Solo vera los servicios de esta empresa. Varias personas pueden compartir la misma empresa.</p>
          </div>
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
      const key = u.cliente?.nombre ?? "Sin empresa";
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
          onSaved={() => {
            setEditing(null);
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
                <div className="min-w-0 flex-1 basis-56">
                  <span className="block truncate text-[15px] font-semibold text-ink-50">
                    {u.nombre} {u.apellido}
                  </span>
                  <span className="block truncate text-[13px] text-ink-300">{u.correoElectronico}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {(u.clienteModulos ?? []).length === 0 && <span className="text-[12px] text-warning-500">Sin modulos marcados: no ve nada</span>}
                    {(u.clienteModulos ?? []).map((key) => (
                      <span key={key} title={moduloLabel(key)} className="rounded-md bg-accent-500/15 px-1.5 py-0.5 text-[11px] font-medium text-accent-300">
                        {key === "MAPA" ? "Mapa" : key === "LISTA" ? "Lista" : key === "AVISOS" ? "Avisos" : key === "HISTORIAL" ? "Historial" : key === "FOTOS" ? "Fotos" : "Excel"}
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
