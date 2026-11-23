import RecomendacionParaTi from './RecomendacionParaTi.js';
import RecomendacionSimilares from './RecomendacionSimilares.js';
import RecomendacionDescubrir from './RecomendacionDescubrir.js';

/** Registro de plantillas de recomendación: un tipo nuevo = una subclase + una línea aquí. */
const GENERADORES = {
  'para-ti': RecomendacionParaTi,
  similares: RecomendacionSimilares,
  descubrir: RecomendacionDescubrir,
};

export const TIPO_POR_DEFECTO = 'para-ti';

export const tiposDisponibles = () =>
  Object.values(GENERADORES).map((Clase) => {
    const g = new Clase();
    return { id: g.tipo(), descripcion: g.descripcion() };
  });

export function crearGenerador(tipo = TIPO_POR_DEFECTO) {
  const Clase = GENERADORES[String(tipo).toLowerCase().trim()];
  if (!Clase) throw new Error(`Tipo de recomendación inválido: "${tipo}". Válidos: ${Object.keys(GENERADORES).join(', ')}.`);
  return new Clase();
}
