import ContenidoCompuesto from './ContenidoCompuesto.js';

/**
 * Serie (COMPOSITE concreto del patrón Composite)
 * Agrupa temporadas. Es un composite de composites.
 */
class Serie extends ContenidoCompuesto {
  tipo() {
    return 'serie';
  }

  aceptar(visitante) {
    return visitante.visitarSerie(this); // Visitor
  }
}

export default Serie;
