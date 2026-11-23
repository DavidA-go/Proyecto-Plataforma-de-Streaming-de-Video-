import PuntuacionPorGeneros from './PuntuacionPorGeneros.js';
import PuntuacionPorHistorial from './PuntuacionPorHistorial.js';
import PuntuacionHibrida from './PuntuacionHibrida.js';

/**
 * Registro de estrategias: agregar un algoritmo nuevo = crear su clase y añadirla aquí.
 * El servicio y el generador no cambian.
 */
const ESTRATEGIAS = {
  generos: PuntuacionPorGeneros,
  historial: PuntuacionPorHistorial,
  hibrida: PuntuacionHibrida,
};

export const ESTRATEGIA_POR_DEFECTO = 'hibrida';

export const estrategiasDisponibles = () =>
  Object.values(ESTRATEGIAS).map((Clase) => {
    const e = new Clase();
    return { id: e.id(), descripcion: e.descripcion() };
  });

export function crearEstrategia(id = ESTRATEGIA_POR_DEFECTO) {
  const Clase = ESTRATEGIAS[String(id).toLowerCase().trim()];
  if (!Clase) throw new Error(`Estrategia inválida: "${id}". Válidas: ${Object.keys(ESTRATEGIAS).join(', ')}.`);
  return new Clase();
}
