/**
 * CalidadVideoFlyweight.js
 * ------------------------------------------------------------------
 * FLYWEIGHT: una calidad de video (360p, 720p, 1080p...). Su estado
 * INTRÍNSECO (resolución, bitrate, dimensiones, códec) es el mismo para
 * TODOS los contenidos, así que se crea una sola vez y se comparte
 * entre miles de manifiestos.
 *
 * El estado EXTRÍNSECO (a qué contenido pertenece y su URL) se pasa en
 * cada uso: ver urlPara()/aEntrada().
 * ------------------------------------------------------------------
 */
class CalidadVideoFlyweight {
  constructor({ resolucion, bitrateKbps, ancho, alto, codec }) {
    this.resolucion = resolucion;
    this.bitrateKbps = bitrateKbps;
    this.ancho = ancho;
    this.alto = alto;
    this.codec = codec;
    Object.freeze(this);
  }

  /** Entrada de manifiesto: mezcla lo compartido (this) con lo extrínseco (url). */
  aEntrada(url) {
    return { resolucion: this.resolucion, bitrateKbps: this.bitrateKbps, url };
  }
}

export default CalidadVideoFlyweight;
