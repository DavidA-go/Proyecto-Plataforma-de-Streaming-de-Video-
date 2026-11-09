import IteradorContenido from './IteradorContenido.js';
/**
 * ITERATOR concreto — recorrido en PROFUNDIDAD (preorden).
 * Entrega primero el grupo y luego, completos, cada uno de sus hijos:
 *   Serie -> Temporada 1 -> Ep.1 -> Ep.2 ... -> Temporada 2 -> Ep.1 ...
 * Es el orden "natural" de un catálogo (como se ve en el árbol).
 * Usa una pila explícita (no recursión): no se desborda con árboles hondos.
 */
class IteradorProfundidad extends IteradorContenido {
  _iniciar() {
    this.pila = [{ nodo: this.raiz, nivel: 0 }];
  }
  _siguienteCrudo() {
    const actual = this.pila.pop();
    if (!actual) return null;
    const hijos = actual.nodo.getHijos();
    // Se apilan al revés para que el primer hijo sea el primero en salir.
    for (let i = hijos.length - 1; i >= 0; i--) this.pila.push({ nodo: hijos[i], nivel: actual.nivel + 1 });
    return actual;
  }
}

export default IteradorProfundidad;
