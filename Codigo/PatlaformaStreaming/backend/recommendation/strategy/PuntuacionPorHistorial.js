import EstrategiaPuntuacion from './EstrategiaPuntuacion.js';

/**
 * Estrategia concreta: promedio de la afinidad (0..1) que el usuario tiene con cada género del
 * título, calculada con lo que ya vio (el género más visto vale 1). Sin historial puntúa 0.
 */
class PuntuacionPorHistorial extends EstrategiaPuntuacion {
  id() {
    return 'historial';
  }

  descripcion() {
    return 'Afinidad con los géneros que más has visto (necesita historial de visualización).';
  }

  usaGeneros() {
    return false;
  }

  usaHistorial() {
    return true;
  }

  puntuar(nodo, ctx) {
    const generos = nodo.getGeneros();
    if (generos.length === 0) return 0;
    const suma = generos.reduce((acc, g) => acc + (ctx.afinidad.get(g) ?? 0), 0);
    return suma / generos.length;
  }
}

export default PuntuacionPorHistorial;
