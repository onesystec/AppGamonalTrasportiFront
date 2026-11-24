import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { DocumentosPersona } from "../../components/drivers/DocumentosPersona";
import { Alert } from "../../components/ui/Alert";
import { SearchableSelect } from "../../components/ui/SearchableSelect";
import { useAuth } from "../../context/AuthContext";
import { parseApiError } from "../../lib/api";
import { CARGO_LABELS } from "../../lib/constants";
import { listPersonalParaDocumentosRequest } from "../../lib/documents.api";

export const DocumentosRrhhPage = () => {
  const { user } = useAuth();
  const [personal, setPersonal] = useState([]);
  const [usuarioId, setUsuarioId] = useState("");
  const [error, setError] = useState("");
  const autorizado = user?.cargo === "RRHH";

  useEffect(() => {
    if (!autorizado) return;
    listPersonalParaDocumentosRequest().then(setPersonal).catch((err) => setError(parseApiError(err).message));
  }, [autorizado]);

  if (!autorizado) return <Navigate to="/rrhh" replace />;

  const persona = personal.find((item) => item.id === usuarioId);
  return (
    <div className="flex flex-col gap-4">
      <div className="w-full max-w-lg">
        <SearchableSelect
          id="rrhh-persona"
          label="Persona"
          placeholder="Busca un chofer o usuario"
          options={personal.map((item) => ({
            value: item.id,
            label: `${item.nombre} ${item.apellido} · ${CARGO_LABELS[item.cargo] ?? item.cargo}`,
          }))}
          value={usuarioId}
          onChange={setUsuarioId}
        />
      </div>
      <Alert>{error}</Alert>
      {persona && <DocumentosPersona key={persona.id} usuarioId={persona.id} documentosNoTiene={persona.documentosNoTiene} editing />}
    </div>
  );
};
