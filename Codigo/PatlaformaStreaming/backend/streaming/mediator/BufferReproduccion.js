import ComponenteReproductor from './ComponenteReproductor.js';

/**
 * COLLEAGUE — segundos de video ya descargados y listos para reproducir.
 * Vigila sus propios umbrales y avisa SOLO al cruzarlos (no en cada cambio):
 *   BUFFER_BAJO        < umbralBajo (5 s)       -> el mediador baja la calidad
 *   BUFFER_VACIO       = 0                      -> el mediador pone el video en "cargando"
 *   BUFFER_RECUPERADO  >= umbralRecuperado (8 s) tras estar bajo/vacío -> el mediador reanuda
 * (el umbral de recuperación es mayor que el de "bajo" a propósito: histéresis, evita parpadeos)
 */
class BufferReproduccion extends ComponenteReproductor {
  constructor({ maximo = 30, umbralBajo = 5, umbralRecuperado = 8 } = {}) {
    super('BufferReproduccion');
    this.maximo = maximo;
    this.umbralBajo = umbralBajo;
    this.umbralRecuperado = umbralRecuperado;
    this.segundos = 0;
    this.nivel = 'vacio'; // 'ok' | 'bajo' | 'vacio'
  }

  llenar(segundos) {
    this.segundos = Math.min(this.maximo, this.segundos + Math.max(0, segundos));
    this.#evaluar();
  }

  consumir(segundos) {
    this.segundos = Math.max(0, this.segundos - Math.max(0, segundos));
    this.#evaluar();
  }

  /** Descarta lo descargado más allá de `segundos` (p. ej. al cambiar de pista de audio). */
  recortarA(segundos) {
    if (this.segundos > segundos) {
      this.segundos = segundos;
      this.#evaluar();
    }
  }

  vaciar() {
    this.segundos = 0;
    this.#evaluar();
  }

  #evaluar() {
    const antes = this.nivel;
    if (this.segundos <= 0) {
      this.nivel = 'vacio';
      if (antes !== 'vacio') this.emitir('BUFFER_VACIO', { segundos: 0 });
    } else if (antes === 'ok' && this.segundos < this.umbralBajo) {
      this.nivel = 'bajo';
      this.emitir('BUFFER_BAJO', { segundos: this.segundos });
    } else if (antes !== 'ok' && this.segundos >= this.umbralRecuperado) {
      this.nivel = 'ok';
      this.emitir('BUFFER_RECUPERADO', { segundos: this.segundos });
    } else if (antes === 'vacio' && this.segundos > 0) {
      this.nivel = 'bajo'; // ya hay algo, pero aún no alcanza para reanudar
    }
  }
}

export default BufferReproduccion;
