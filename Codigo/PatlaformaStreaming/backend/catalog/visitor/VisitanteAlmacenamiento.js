import VisitanteContenido from './VisitanteContenido.js';
import CalidadVideoFactory from '../../flyweight/CalidadVideoFactory.js';

const CALIDADES_POR_DEFECTO = ['360p', '480p', '720p', '1080p'];

/**
 * VISITANTE CONCRETO — espacio en disco que ocuparía el contenido en cada calidad.
 * Colabora con Flyweight: el bitrate sale de CalidadVideoFactory (instancias compartidas).
 *   GB = bitrate(kbps) × 1000 × segundos / 8 / 1e9
 */
class VisitanteAlmacenamiento extends VisitanteContenido {
  #calidades;
  #segundosTotales = 0;
  #reproducibles = 0;
  #masPesado = null;

  /** @param {string[]} calidades resoluciones a estimar (deben existir en el Flyweight) */
  constructor({ calidades = CALIDADES_POR_DEFECTO } = {}) {
    super();
    if (!Array.isArray(calidades) || calidades.length === 0) throw new Error('Indica al menos una calidad.');
    this.#calidades = calidades.map((r) => CalidadVideoFactory.obtener(r)); // lanza si la calidad no existe
  }

  static gb(bitrateKbps, segundos) {
    return (bitrateKbps * 1000 * segundos) / 8 / 1e9;
  }

  visitarHoja(nodo) {
    super.visitarHoja(nodo);
    const segundos = nodo.getDuracion() * 60;
    this.#segundosTotales += segundos;
    this.#reproducibles++;
    const peso = segundos; // el más pesado es el más largo (el bitrate es el mismo para todos)
    if (!this.#masPesado || peso > this.#masPesado.segundos) {
      this.#masPesado = { id: nodo.id, titulo: nodo.titulo, segundos };
    }
  }

  resultado() {
    const redondear = (n) => Math.round(n * 100) / 100;
    const calidades = Object.fromEntries(
      this.#calidades.map((c) => [c.resolucion, { bitrateKbps: c.bitrateKbps, gb: redondear(VisitanteAlmacenamiento.gb(c.bitrateKbps, this.#segundosTotales)) }])
    );
    const mayor = this.#calidades.at(-1);
    return {
      nodosVisitados: this.nodosVisitados,
      reproducibles: this.#reproducibles,
      duracionTotalMin: this.#segundosTotales / 60,
      calidades,
      masPesado: this.#masPesado && {
        id: this.#masPesado.id,
        titulo: this.#masPesado.titulo,
        [`gb${mayor.resolucion}`]: redondear(VisitanteAlmacenamiento.gb(mayor.bitrateKbps, this.#masPesado.segundos)),
      },
    };
  }
}

export default VisitanteAlmacenamiento;
