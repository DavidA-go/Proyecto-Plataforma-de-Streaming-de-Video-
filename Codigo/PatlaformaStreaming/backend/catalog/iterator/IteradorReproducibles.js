import IteradorProfundidad from './IteradorProfundidad.js';

/**
 * ITERATOR concreto — solo las HOJAS reproducibles (películas, documentales,
 * episodios) en orden de profundidad: es el orden de reproducción real
 * ("maratón"/autoplay). Reutiliza el recorrido en profundidad y le añade
 * el filtro "es hoja", así no se duplica la lógica de navegar el árbol.
 */
class IteradorReproducibles extends IteradorProfundidad {
  constructor(raiz, predicado = () => true) {
    super(raiz, (nodo) => nodo.esReproducible() && predicado(nodo));
  }
}

export default IteradorReproducibles;
