import ElementoContenido from './ElementoContenido.js';

/**
 * Pelicula (LEAF del patrón Composite)
 * Elemento simple: no tiene hijos, sabe su propia duración.
 */
class Pelicula extends ElementoContenido {
  constructor(id, titulo, duracionMin, generos = []) {
    super(id, titulo, generos);
    this.duracionMin = duracionMin;
  }

  tipo() {
    return 'pelicula';
  }

  getDuracion() {
    return this.duracionMin;
  }

  // Una hoja es reproducible por sí misma: se devuelve a sí misma.
obtenerReproducibles() {
  console.log(`🌳 [Composite:hoja] ${this.tipo()} "${this.titulo}" se devuelve a sí mismo`);
  return [this];
}
}

export default Pelicula;
