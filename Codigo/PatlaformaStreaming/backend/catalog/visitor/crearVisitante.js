import VisitanteEstadisticas from './VisitanteEstadisticas.js';
import VisitanteAlmacenamiento from './VisitanteAlmacenamiento.js';
import VisitanteExportadorCSV from './VisitanteExportadorCSV.js';

/** Visitantes disponibles por nombre (el endpoint de reportes usa esta tabla). */
export const VISITANTES = Object.freeze({
  estadisticas: VisitanteEstadisticas,
  almacenamiento: VisitanteAlmacenamiento,
  csv: VisitanteExportadorCSV,
});

export function crearVisitante(nombre = 'estadisticas', opciones = {}) {
  const Clase = VISITANTES[nombre];
  if (!Clase) {
    throw new Error(`Visitante inválido: "${nombre}". Válidos: ${Object.keys(VISITANTES).join(', ')}.`);
  }
  return new Clase(opciones);
}
