import ContenidoCompuesto from './ContenidoCompuesto.js';

/**
 * Coleccion (COMPOSITE concreto del patrón Composite)
 * Agrupa lo que sea: películas, series u otras colecciones (anidación libre).
 */
class Coleccion extends ContenidoCompuesto {
  tipo() {
    return 'coleccion';
  }

  aceptar(visitante) {
    return visitante.visitarColeccion(this); // Visitor
  }
}

export default Coleccion;
