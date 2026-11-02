// Al abrir la app, la oficina (Owner / Admin) aterriza en Registros y no en Inicio. Se recuerda mientras la app siga abierta para que "Inicio" siga llevando a Inicio.
let entrado = false;
export const haEntrado = () => entrado;
export const marcarEntrado = (valor) => {
  entrado = valor;
};
