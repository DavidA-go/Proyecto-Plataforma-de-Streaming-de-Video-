import ElementoContenido from './ElementoContenido.js';

/**
 * ContenidoCompuesto.js
 * ------------------------------------------------------------------
 * COMPOSITE (clase base) del patrón Composite.
 *
 * Guarda una lista de hijos (que pueden ser hojas u otros composites)
 * y DELEGA en ellos cada operación de la interfaz ElementoContenido.
 * Temporada, Serie y Coleccion solo extienden esta clase y definen
 * tipo(): toda la lógica recursiva vive aquí, una sola vez.
 *
 * Ejemplo de la recursión en getDuracion():
 *   Serie -> pregunta a cada Temporada -> cada Temporada pregunta a
 *   cada Episodio (hoja, responde directo) -> las respuestas se suman
 *   y suben de nuevo hasta la Serie.
 * ------------------------------------------------------------------
 */
class ContenidoCompuesto extends ElementoContenido {
  constructor(id, titulo, generos = []) {
    if (new.target === ContenidoCompuesto) {
      throw new Error('ContenidoCompuesto es abstracta: usa Temporada, Serie o Coleccion.');
    }
    super(id, titulo, generos);
    this.hijos = [];
  }

  /** Agrega un hijo (hoja o composite). Devuelve this para encadenar. */
  agregar(hijo) {
    if (!(hijo instanceof ElementoContenido)) {
      throw new Error('Solo se pueden agregar elementos que implementen ElementoContenido.');
    }
    this.hijos.push(hijo);
    return this;
  }

  getDuracion() {
    return this.hijos.reduce((total, hijo) => total + hijo.getDuracion(), 0);
  }

  obtenerReproducibles() {
    return this.hijos.flatMap((hijo) => hijo.obtenerReproducibles());
  }

  // Géneros propios del grupo + los de todos sus descendientes (sin repetir).
  getGeneros() {
    const todos = [...this.generos, ...this.hijos.flatMap((hijo) => hijo.getGeneros())];
    return [...new Set(todos)];
  }

  buscar(id) {
    if (this.id === id) return this;
    for (const hijo of this.hijos) {
      const encontrado = hijo.buscar(id);
      if (encontrado) return encontrado;
    }
    return null;
  }

  filtrar(generos) {
    // Si el grupo mismo declara uno de los géneros (ej. una Serie "familiar"),
    // se conserva completo: todas sus temporadas y episodios.
    if (this.generos.some((g) => generos.includes(g))) return this.toJSON();

    // Si no, se conservan solo los hijos que coincidan (recursivamente).
    const hijosFiltrados = this.hijos.map((hijo) => hijo.filtrar(generos)).filter(Boolean);
    if (hijosFiltrados.length === 0) return null;

    // Se recalculan los totales solo con los hijos que sobrevivieron al filtro.
    const duracionMin = hijosFiltrados.reduce((total, h) => total + h.duracionMin, 0);
    const totalReproducibles = hijosFiltrados.reduce((total, h) => total + (h.totalReproducibles ?? 1), 0);
    return {
      id: this.id,
      tipo: this.tipo(),
      titulo: this.titulo,
      duracionMin,
      duracionTexto: ElementoContenido.formatearDuracion(duracionMin),
      generos: this.getGeneros(),
      totalReproducibles,
      hijos: hijosFiltrados,
    };
  }

  toJSON() {
    return {
      ...super.toJSON(),
      totalReproducibles: this.obtenerReproducibles().length,
      hijos: this.hijos.map((hijo) => hijo.toJSON()),
    };
  }
}

export default ContenidoCompuesto;
