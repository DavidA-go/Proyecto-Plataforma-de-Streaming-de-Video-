import ContenidoCompuesto from './ContenidoCompuesto.js';

/**
 * Temporada (COMPOSITE concreto del patrón Composite)
 * Agrupa episodios. Es hijo de una Serie.
 */
class Temporada extends ContenidoCompuesto {
  tipo() {
    return 'temporada';
  }

  aceptar(visitante) {
    return visitante.visitarTemporada(this); // Visitor
  }
}

export default Temporada;
