import VisitanteContenido from './VisitanteContenido.js';

const TIPOS = ['coleccion', 'serie', 'temporada', 'episodio', 'pelicula', 'documental'];
const TITULOS = new Set(['serie', 'pelicula', 'documental']); // lo que el usuario ve como "un título" del catálogo

/** VISITANTE CONCRETO — cuántos nodos hay de cada tipo, duración total, título más largo y géneros. */
class VisitanteEstadisticas extends VisitanteContenido {
  #porTipo = Object.fromEntries(TIPOS.map((t) => [t, 0]));
  #porGenero = {};
  #duracionTotalMin = 0;
  #reproducibles = 0;
  #masLargo = null;
  #profundidadMaxima = 0;

  #registrar(nodo) {
    this.#porTipo[nodo.tipo()]++;
    this.#profundidadMaxima = Math.max(this.#profundidadMaxima, this.nivel);
    if (TITULOS.has(nodo.tipo())) {
      for (const g of nodo.getGeneros()) this.#porGenero[g] = (this.#porGenero[g] ?? 0) + 1;
    }
  }

  visitarHoja(nodo) {
    super.visitarHoja(nodo);
    this.#registrar(nodo);
    this.#reproducibles++;
    this.#duracionTotalMin += nodo.getDuracion(); // el total de un grupo es la suma de sus hojas
    if (!this.#masLargo || nodo.getDuracion() > this.#masLargo.duracionMin) {
      this.#masLargo = { id: nodo.id, titulo: nodo.titulo, tipo: nodo.tipo(), duracionMin: nodo.getDuracion() };
    }
  }

  visitarGrupo(nodo) {
    this.#registrar(nodo);
    super.visitarGrupo(nodo);
  }

  resultado() {
    const ordenados = Object.entries(this.#porGenero).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return {
      nodosVisitados: this.nodosVisitados,
      porTipo: this.#porTipo,
      reproducibles: this.#reproducibles,
      duracionTotalMin: this.#duracionTotalMin,
      duracionTexto: `${Math.floor(this.#duracionTotalMin / 60)}h ${String(this.#duracionTotalMin % 60).padStart(2, '0')}m`,
      masLargo: this.#masLargo,
      profundidadMaxima: this.#profundidadMaxima,
      titulosPorGenero: Object.fromEntries(ordenados),
    };
  }
}

export default VisitanteEstadisticas;
