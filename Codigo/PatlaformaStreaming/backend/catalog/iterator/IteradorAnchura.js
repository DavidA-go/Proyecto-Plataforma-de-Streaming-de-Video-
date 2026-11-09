import IteradorContenido from './IteradorContenido.js';

/**
 * ITERATOR concreto — recorrido en ANCHURA (por niveles).
 * Entrega primero todo lo del nivel 0, luego el nivel 1, etc.
 * Sirve para mostrar primero lo "de arriba" (colecciones y series) y
 * solo después el detalle (temporadas y episodios).
 */
class IteradorAnchura extends IteradorContenido {
  _iniciar() {
    this.cola = [{ nodo: this.raiz, nivel: 0 }];
    this.cabeza = 0; // índice de lectura: evita el costo O(n) de shift()
  }

  _siguienteCrudo() {
    if (this.cabeza >= this.cola.length) return null;
    const actual = this.cola[this.cabeza++];
    for (const hijo of actual.nodo.getHijos()) this.cola.push({ nodo: hijo, nivel: actual.nivel + 1 });
    return actual;
  }
}

export default IteradorAnchura;
