import ComponenteReproductor from './ComponenteReproductor.js';

/**
 * COLLEAGUE — botones del reproductor (play / pausa / saltar) y su estado.
 *   estado: 'detenido' | 'cargando' | 'reproduciendo' | 'pausado'
 * Distingue dos tipos de métodos:
 *   solicitar*()  -> lo que PIDE el usuario; solo avisa al mediador.
 *   establecer*() -> lo que ORDENA el mediador; cambia el estado.
 * `quiereReproducir` recuerda la intención del usuario: si el buffer se vacía
 * en medio del video, al recuperarse se reanuda solo (el usuario nunca pausó).
 */
class ControlReproduccion extends ComponenteReproductor {
  constructor(duracionSeg) {
    super('ControlReproduccion');
    this.duracionSeg = duracionSeg;
    this.estado = 'detenido';
    this.posicionSeg = 0;
    this.quiereReproducir = false;
  }

  // --- lo pide el usuario ---
  solicitarReproducir() {
    this.emitir('REPRODUCIR');
  }

  solicitarPausa() {
    this.emitir('PAUSA');
  }

  solicitarBuscar(segundo) {
    if (!Number.isFinite(segundo) || segundo < 0 || segundo >= this.duracionSeg) {
      throw new Error(`La posición debe estar entre 0 y ${this.duracionSeg - 1} segundos.`);
    }
    this.emitir('BUSCAR', { segundo: Math.floor(segundo) });
  }

  // --- lo ordena el mediador ---
  establecerEstado(estado) {
    this.estado = estado;
  }

  moverA(segundo) {
    this.posicionSeg = segundo;
  }

  /** Avanza la posición; si llega al final avisa FIN_CONTENIDO. */
  avanzar(segundos) {
    this.posicionSeg = Math.min(this.duracionSeg, this.posicionSeg + segundos);
    if (this.posicionSeg >= this.duracionSeg) this.emitir('FIN_CONTENIDO', { posicionSeg: this.posicionSeg });
  }
}

export default ControlReproduccion;
