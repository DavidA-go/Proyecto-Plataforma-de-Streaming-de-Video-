/**
 * FuenteMedia.js
 * ------------------------------------------------------------------
 * "De dónde sale el video" de una hoja del catálogo (Pelicula, Documental,
 * Episodio). Es una pequeña jerarquía de dos variantes intercambiables:
 *
 *   FuenteSimulada  -> el comportamiento de siempre (URLs de un CDN inventado)
 *   FuenteLocal     -> archivos MP4 reales que viven en backend/media/<id>/
 *
 * Así el Composite no tiene que preguntar "¿este título tiene archivo real?":
 * todas las hojas responden a la misma interfaz (patrón Null Object para la
 * simulada) y el Bridge de streaming simplemente usa la fuente que le toque.
 *
 * El método calidades() es un TEMPLATE METHOD mínimo: el esqueleto (ordenar y
 * recortar por el techo del plan) vive aquí y cada fuente solo aporta
 * todasLasCalidades().
 * ------------------------------------------------------------------
 */
class FuenteMedia {
  /** Calidades conocidas, de menor a mayor (misma escalera que el Flyweight y el Mediator). */
  static ESCALERA = ['360p', '480p', '720p', '1080p'];

  constructor() {
    if (new.target === FuenteMedia) {
      throw new Error('FuenteMedia es abstracta: usa FuenteSimulada o FuenteLocal.');
    }
  }

  /** ¿Hay archivos de video de verdad detrás? */
  esReal() {
    throw new Error('esReal() debe ser implementado por la subclase.');
  }

  /** Protocolos con los que se puede entregar esta fuente ('hls', 'dash', 'mp4'). El primero es el preferido. */
  protocolosSoportados() {
    throw new Error('protocolosSoportados() debe ser implementado por la subclase.');
  }

  /** Paso variable del template: todas las resoluciones que existen, sin filtrar. */
  todasLasCalidades() {
    throw new Error('todasLasCalidades() debe ser implementado por la subclase.');
  }

  /** URL del archivo para una resolución (null si la fuente no sirve archivos propios). */
  // eslint-disable-next-line no-unused-vars
  urlArchivo(contenidoId, resolucion) {
    return null;
  }

  /** Atribución / licencia del contenido (null si no aplica). */
  creditos() {
    return null;
  }

  /**
   * Paso fijo del template: calidades ordenadas de menor a mayor y recortadas al
   * techo del plan. Siempre devuelve al menos la más baja (nunca deja sin video).
   * @param {string|null} techo  ej. '480p'; null = sin límite
   * @param {boolean} unica  true = el plan NO permite elegir calidad (p. ej. Free): se devuelve solo la más alta que cabe
   */
  calidades(techo = null, unica = false) {
    const orden = (r) => FuenteMedia.ESCALERA.indexOf(r);
    const todas = [...this.todasLasCalidades()].sort((a, b) => orden(a) - orden(b));
    let lista = todas;
    if (techo && orden(techo) !== -1) {
      const permitidas = todas.filter((r) => orden(r) <= orden(techo));
      lista = permitidas.length > 0 ? permitidas : todas.slice(0, 1);
    }
    return unica ? lista.slice(-1) : lista;
  }
}

export default FuenteMedia;
