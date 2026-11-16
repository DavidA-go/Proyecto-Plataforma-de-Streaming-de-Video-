import VisitanteContenido from './VisitanteContenido.js';

const CABECERA = 'nivel,tipo,id,titulo,duracionMin,generos';
const csv = (texto) => `"${String(texto).replaceAll('"', '""')}"`; // escapa comillas (RFC 4180)

/** VISITANTE CONCRETO — exporta el árbol a CSV: una fila por nodo, en preorden, con su nivel. */
class VisitanteExportadorCSV extends VisitanteContenido {
  #filas = [];

  #fila(nodo) {
    this.#filas.push([this.nivel, nodo.tipo(), nodo.id, csv(nodo.titulo), nodo.getDuracion(), csv(nodo.getGeneros().join('|'))].join(','));
  }

  visitarHoja(nodo) {
    super.visitarHoja(nodo);
    this.#fila(nodo);
  }

  visitarGrupo(nodo) {
    this.#fila(nodo); // primero el grupo, luego sus hijos (preorden)
    super.visitarGrupo(nodo);
  }

  resultado() {
    return { nodosVisitados: this.nodosVisitados, filas: this.#filas.length, csv: [CABECERA, ...this.#filas].join('\n') };
  }
}

export default VisitanteExportadorCSV;
