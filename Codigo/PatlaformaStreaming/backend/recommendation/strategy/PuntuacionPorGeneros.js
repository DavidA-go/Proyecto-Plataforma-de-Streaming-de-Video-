import EstrategiaPuntuacion from './EstrategiaPuntuacion.js';

/**
 * Estrategia concreta: qué fracción de los géneros del título está entre los géneros de interés.
 *   ["accion","thriller"] contra interés ["accion","drama"]  ->  1/2 = 0.5
 */
class PuntuacionPorGeneros extends EstrategiaPuntuacion {
  id() {
    return 'generos';
  }

  descripcion() {
    return 'Fracción de los géneros del título que coinciden con tus géneros de interés.';
  }

  puntuar(nodo, ctx) {
    const generos = nodo.getGeneros();
    if (generos.length === 0) return 0;
    const interes = new Set(ctx.generosInteres);
    return generos.filter((g) => interes.has(g)).length / generos.length;
  }
}

export default PuntuacionPorGeneros;
