import { api } from "./api";

export const listDocumentsRequest = (usuarioId) =>
  api.get("/documents", { params: { usuarioId } }).then((res) => res.data.data.documents);

export const createDocumentRequest = (usuarioId, tipoDocumento, file, fechaScadenza) => {
  const formData = new FormData();
  formData.append("archivo", file);
  formData.append("tipoDocumento", tipoDocumento);
  formData.append("usuarioId", usuarioId);
  if (fechaScadenza) formData.append("fechaScadenza", fechaScadenza);
  return api.post("/documents", formData).then((res) => res.data.data.document);
};

export const updateDocumentRequest = (id, { file, fechaScadenza } = {}) => {
  const formData = new FormData();
  if (file) formData.append("archivo", file);
  if (fechaScadenza) formData.append("fechaScadenza", fechaScadenza);
  return api.patch(`/documents/${id}`, formData).then((res) => res.data.data.document);
};
