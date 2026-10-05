import ElementoContenido from './ElementoContenido.js';

/**
 * Episodio (LEAF del patrón Composite)
 * Unidad mínima reproducible de una serie.
 */
class Episodio extends ElementoContenido {
  constructor(id, titulo, numero, duracionMin, generos = []) {
    super(id, titulo, generos);
    this.numero = numero;
    this.duracionMin = duracionMin;
  }

  tipo() {
    return 'episodio';
  }

  getDuracion() {
    return this.duracionMin;
  }

  obtenerReproducibles() {
  console.log(`🌳 [Composite:hoja] ${this.tipo()} "${this.titulo}" se devuelve a sí mismo`);
  return [this];
}

  toJSON() {
    return { ...super.toJSON(), numero: this.numero };
  }
}

export default Episodio;
