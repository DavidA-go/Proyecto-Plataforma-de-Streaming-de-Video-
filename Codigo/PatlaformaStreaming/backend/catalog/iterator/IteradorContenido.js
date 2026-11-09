/**
 * IteradorContenido.js
 * ------------------------------------------------------------------
 * ITERATOR (interfaz + comportamiento común) — subservicio de GESTIÓN
 * DE CONTENIDO.
 *
 * Recorre el árbol del catálogo (Composite) SIN exponer cómo está
 * armado por dentro: el cliente solo usa hasNext() / next(), igual si
 * el recorrido es en profundidad, en anchura o solo de reproducibles.
 *
 * El recorrido es PEREZOSO: no se aplana todo el árbol de entrada,
 * cada next() avanza solo lo necesario (útil para paginar o para
 * "siguiente episodio" sin recorrer el catálogo completo).
 *
 * Las subclases solo deciden EL ORDEN (ver _siguienteCrudo()); el filtro
 * (predicado) y el protocolo hasNext()/next() viven aquí, una sola vez.
 * Además cumple el protocolo de JavaScript, así que se puede usar con
 * for...of y con el operador spread.
 * ------------------------------------------------------------------
 */
class IteradorContenido {
  #listo = false; // ¿ya hay un elemento "mirado" por adelantado?
  #pendiente = null; // { nodo, nivel } mirado por hasNext()
  #nivelActual = -1;

  /**
   * @param {ElementoContenido} raiz      nodo desde donde se recorre (incluido)
   * @param {(nodo)=>boolean}   predicado filtro opcional: solo se entregan los nodos que lo cumplen
   */
  constructor(raiz, predicado = () => true) {
    if (new.target === IteradorContenido) {
      throw new Error('IteradorContenido es abstracta: usa IteradorProfundidad, IteradorAnchura o IteradorReproducibles.');
    }
    this.raiz = raiz;
    this.predicado = predicado;
    this._iniciar();
  }

  /** (subclase) deja la estructura interna lista para empezar desde la raíz. */
  _iniciar() {
    throw new Error('_iniciar() debe ser implementado por la subclase.');
  }

  /** (subclase) devuelve { nodo, nivel } del siguiente nodo en SU orden, o null si se acabó (sin filtrar). */
  _siguienteCrudo() {
    throw new Error('_siguienteCrudo() debe ser implementado por la subclase.');
  }

  /** Mira por adelantado el siguiente nodo que cumpla el predicado. */
  #avanzarHastaCoincidencia() {
    if (this.#listo) return;
    let entrada = this._siguienteCrudo();
    while (entrada && !this.predicado(entrada.nodo)) entrada = this._siguienteCrudo();
    this.#pendiente = entrada;
    this.#listo = true;
  }

  hasNext() {
    this.#avanzarHastaCoincidencia();
    return this.#pendiente !== null;
  }

  /** Devuelve el siguiente nodo; lanza si no quedan (usa hasNext() antes). */
  next() {
    if (!this.hasNext()) throw new Error('El iterador no tiene más elementos.');
    const { nodo, nivel } = this.#pendiente;
    this.#pendiente = null;
    this.#listo = false;
    this.#nivelActual = nivel;
    return nodo;
  }

  /** Profundidad (0 = raíz) del último nodo entregado por next(). */
  get nivel() {
    return this.#nivelActual;
  }

  /** Vuelve al inicio para recorrer otra vez. */
  reset() {
    this.#listo = false;
    this.#pendiente = null;
    this.#nivelActual = -1;
    this._iniciar();
  }

  /** Agota lo que queda y lo devuelve como arreglo (atajo; pierde la ventaja de lo perezoso). */
  toArray() {
    return [...this];
  }

  /** Protocolo de JavaScript: permite `for (const nodo of iterador)` y `[...iterador]`. */
  [Symbol.iterator]() {
    return {
      next: () => (this.hasNext() ? { value: this.next(), done: false } : { value: undefined, done: true }),
    };
  }
}

export default IteradorContenido;
