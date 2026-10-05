import Pelicula from './Pelicula.js';

/**
 * Documental (LEAF del patrón Composite)
 * Igual que una película, pero con su propio tipo para poder
 * distinguirlo en el catálogo y en la interfaz.
 */
class Documental extends Pelicula {
  tipo() {
    return 'documental';
  }
}

export default Documental;
