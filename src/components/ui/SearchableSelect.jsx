import clsx from "clsx";
import { useEffect, useState } from "react";
import { Spinner } from "./Spinner";

const DEFAULT_MAX_SUGGESTIONS = 5;

// Input con sugerencias filtradas en vivo (maximo `maxSuggestions`, default 5), fondo
// solido para que se lea bien aunque haya otros campos debajo. Si se pasa onCreateNew,
// permite crear una opcion nueva al aceptar un texto que no matchea ninguna existente
// (ej: Cliente); sin esa prop, solo permite elegir entre las opciones dadas (ej: Chofer,
// Vehiculo, Estado). Para listas cortas y fijas (ej: Estado) conviene pasar
// maxSuggestions=options.length para que se vean todas sin tener que escribir.
export const SearchableSelect = ({
  id,
  label,
  options,
  value,
  onChange,
  onCreateNew,
  createLabel = (text) => `+ Crear "${text}"`,
  placeholder = "Escribe para buscar...",
  error,
  maxSuggestions = DEFAULT_MAX_SUGGESTIONS,
  autoFocus = false,
  selectSingleMatch = false,
}) => {
  const [query, setQuery] = useState("");
  // Separado de "query": mientras no se escriba nada nuevo desde que se abrio el
  // campo, se muestran todas las opciones en vez de filtrar por el valor ya cargado.
  const [filterQuery, setFilterQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    const match = options.find((o) => o.value === value);
    setQuery(match?.label ?? "");
  }, [value, options]);

  const findExactMatch = (text) =>
    options.find((o) => o.label.trim().toLowerCase() === text.trim().toLowerCase());

  const commitQuery = async () => {
    const trimmed = query.trim();

    if (!trimmed) {
      if (value) onChange("");
      return;
    }

    const exact = findExactMatch(trimmed);
    if (exact) {
      if (exact.value !== value) onChange(exact.value);
      setQuery(exact.label);
      return;
    }

    if (!onCreateNew) {
      // no hay match y no se permite crear: revierte al valor seleccionado previamente
      const current = options.find((o) => o.value === value);
      setQuery(current?.label ?? "");
      return;
    }

    setCreating(true);
    setCreateError("");
    try {
      const created = await onCreateNew(trimmed);
      onChange(created.value);
      setQuery(created.label);
    } catch (err) {
      setCreateError(err?.message ?? "No se pudo crear");
    } finally {
      setCreating(false);
    }
  };

  const handleSelect = (opt) => {
    onChange(opt.value);
    setQuery(opt.label);
    setOpen(false);
  };

  const handleBlur = () => {
    setOpen(false);
    commitQuery();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (selectSingleMatch && open && filterQuery.trim() && filtered.length === 1) {
        handleSelect(filtered[0]);
      } else {
        setOpen(false);
        commitQuery();
      }
    }
  };

  const filtered = (filterQuery.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(filterQuery.trim().toLowerCase()))
    : options
  ).slice(0, maxSuggestions);

  const exactMatch = findExactMatch(query);
  const showCreateOption = Boolean(onCreateNew) && query.trim() && !exactMatch;

  return (
    <div className="relative">
      {label && <span className="mb-1.5 block text-[13px] font-medium text-ink-300">{label}</span>}

      <div className="relative">
        <input
          id={id}
          type="text"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setFilterQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={(e) => {
            setOpen(true);
            setFilterQuery("");
            e.target.select();
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className={clsx(
            "glass-input w-full rounded-xl px-4 py-3 pr-9 text-[15px] text-ink-50",
            error && "border-danger-500/70 focus:border-danger-500"
          )}
        />
        {creating && (
          <span className="absolute inset-y-0 right-3 flex items-center">
            <Spinner className="h-4 w-4 border-line/20 border-t-line" />
          </span>
        )}
      </div>

      {error && <span className="mt-1.5 block text-[13px] text-danger-500">{error}</span>}
      {createError && (
        <span className="mt-1.5 block text-[13px] text-danger-500">{createError}</span>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-line/15 bg-popover p-1 shadow-2xl">
          {filtered.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(opt)}
              className="block w-full rounded-lg px-3 py-2 text-left text-[14px] text-ink-50 hover:bg-line/10"
            >
              {opt.label}
            </button>
          ))}

          {showCreateOption && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                commitQuery();
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-[14px] text-accent-400 hover:bg-line/10"
            >
              {createLabel(query.trim())}
            </button>
          )}

          {filtered.length === 0 && !showCreateOption && (
            <p className="px-3 py-2 text-[13px] text-ink-400">
              {options.length === 0 ? "No hay opciones todavia." : "Sin resultados."}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
