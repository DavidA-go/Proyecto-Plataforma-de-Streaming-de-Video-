import FuenteMedia from './FuenteMedia.js';

/**
 * FuenteSimulada (NULL OBJECT)
 * ------------------------------------------------------------------
 * Es la fuente por defecto de cualquier título que NO tiene video real:
 * mantiene exactamente el comportamiento que tenía la plataforma antes de
 * agregar contenido real (3 calidades y URLs de un CDN de ejemplo que no
 * existe). Gracias a ella no hay un solo `if (tieneArchivo)` en el catálogo.
 * ------------------------------------------------------------------
 */
class FuenteSimulada extends FuenteMedia {
  /** Es stateless, así que una sola instancia sirve para todos los títulos. */
  static INSTANCIA = new FuenteSimulada();

  esReal() {
    return false;
  }

  protocolosSoportados() {
    return ['hls', 'dash'];
  }

  todasLasCalidades() {
    return ['360p', '720p', '1080p'];
  }
}

export default FuenteSimulada;
