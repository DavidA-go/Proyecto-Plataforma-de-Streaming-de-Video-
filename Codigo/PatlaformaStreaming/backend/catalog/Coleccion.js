import ContenidoCompuesto from './ContenidoCompuesto.js';

/**
 * Coleccion (COMPOSITE concreto del patrón Composite)
 * Agrupa lo que sea: películas, series u otras colecciones (anidación libre).
 */
class Coleccion extends ContenidoCompuesto {
  tipo() {
    return 'coleccion';
  }
}

export default Coleccion;
