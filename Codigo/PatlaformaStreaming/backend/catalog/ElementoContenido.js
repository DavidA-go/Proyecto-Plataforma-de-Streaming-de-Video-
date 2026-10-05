/**
 * ElementoContenido.js
 * ------------------------------------------------------------------
 * COMPONENT del patrón Composite.
 *
 * Es la interfaz común que comparten TODOS los elementos del catálogo:
 * tanto los elementos simples (Pelicula, Documental, Episodio = "hojas")
 * como los grupos (Temporada, Serie, Coleccion = "composites").
 *
 * Gracias a esta interfaz común, el código cliente (index.js) puede
 * pedirle "getDuracion()" o "obtenerReproducibles()" a CUALQUIER nodo
 * sin preguntar antes "¿eres una película o una serie?".
 * ------------------------------------------------------------------
 */
class ElementoContenido {
  constructor(id, titulo, generos = []) {
    if (new.target === ElementoContenido) {
      throw new Error('ElementoContenido es abstracta y no puede instanciarse directamente.');
    }
    this.id = id;
    this.titulo = titulo;
    this.generos = generos;
  }

  /** 'pelicula' | 'documental' | 'episodio' | 'temporada' | 'serie' | 'coleccion' */
  tipo() {
    throw new Error('tipo() debe ser implementado por la subclase.');
  }

  /** Duración total en minutos (en un grupo, es la suma de sus hijos). */
  getDuracion() {
    throw new Error('getDuracion() debe ser implementado por la subclase.');
  }

  /**
   * Lista PLANA de los elementos que realmente se pueden reproducir
   * (las hojas). Una hoja se devuelve a sí misma; un grupo junta los de
   * todos sus hijos. Es lo que usa el endpoint de streaming.
   */
  obtenerReproducibles() {
    throw new Error('obtenerReproducibles() debe ser implementado por la subclase.');
  }

  /** Géneros del elemento (en un grupo, la unión de los géneros de sus hijos). */
  getGeneros() {
    return this.generos;
  }

  /** Busca un nodo por id dentro de este elemento (y de sus descendientes). */
  buscar(id) {
    return this.id === id ? this : null;
  }

  /**
   * Filtra por géneros. Devuelve la representación JSON del nodo si
   * coincide con algún género pedido, o null si no. Un grupo conserva
   * solo los hijos que coinciden (y desaparece si ninguno coincide).
   */
  filtrar(generos) {
    const coincide = this.getGeneros().some((g) => generos.includes(g));
    return coincide ? this.toJSON() : null;
  }

  static formatearDuracion(totalMin) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
  }

  getDuracionFormateada() {
    return ElementoContenido.formatearDuracion(this.getDuracion());
  }

  toJSON() {
    return {
      id: this.id,
      tipo: this.tipo(),
      titulo: this.titulo,
      duracionMin: this.getDuracion(),
      duracionTexto: this.getDuracionFormateada(),
      generos: this.getGeneros(),
    };
  }
}

export default ElementoContenido;
