import { api } from "./api";

const BASE = "/solleciti";

// fields: texto (los undefined/null se omiten); files: { archivo, comprobante } (File).
const toFormData = (fields = {}, files = {}) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  Object.entries(files).forEach(([key, file]) => {
    if (file) formData.append(key, file);
  });
  return formData;
};

// Devuelve { items, resumen: { POR_PAGAR, PAGADO, NO_CORRESPONDE } -> { count, total } }.
export const listSollecitiRequest = (params) => api.get(BASE, { params }).then((res) => res.data.data);

export const createSollecitoRequest = (fields, files) =>
  api.post(BASE, toFormData(fields, files)).then((res) => res.data.data.sollecito);

export const updateSollecitoRequest = (id, fields, files) =>
  api.patch(`${BASE}/${id}`, toFormData(fields, files)).then((res) => res.data.data.sollecito);

export const deleteSollecitoRequest = (id) => api.delete(`${BASE}/${id}`);

export const SOLLECITO_ESTADOS = [
  { value: "POR_PAGAR", label: "Por pagar", pill: "bg-danger-500/15 text-danger-500", edge: "border-l-danger-500" },
  { value: "PAGADO", label: "Pagado", pill: "bg-success-500/15 text-success-500", edge: "border-l-success-500" },
  { value: "NO_CORRESPONDE", label: "No corresponde", pill: "bg-line/15 text-ink-300", edge: "border-l-line/40" },
];

export const sollecitoEstado = (value) => SOLLECITO_ESTADOS.find((e) => e.value === value) ?? SOLLECITO_ESTADOS[0];
