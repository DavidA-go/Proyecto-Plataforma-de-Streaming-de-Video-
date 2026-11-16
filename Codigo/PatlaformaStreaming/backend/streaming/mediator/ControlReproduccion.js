import ComponenteReproductor from './ComponenteReproductor.js';
import { ESTADOS } from '../state/estados.js';

/**
 * COLLEAGUE (Mediator) + CONTEXTO (State) — botones del reproductor y su estado.
 *   estado: 'detenido' | 'cargando' | 'reproduciendo' | 'pausado'
 *
 * Colaboración de dos patrones:
 *   - MEDIATOR: decide CUÁNDO ocurre algo (llega un evento y se lo ordena al control).
 *   - STATE:    el objeto de estado actual decide QUÉ significa ese evento AHORA y a qué
 *               estado se pasa. El control ya no tiene if/else sobre su propio estado.
 *
 * Tres tipos de métodos:
 *   solicitar*()  -> lo que PIDE el usuario; solo avisa al mediador.
 *   ordenar*()    -> lo que ORDENA el mediador; se delega en el estado actual.
 *   transicionarA() / ignorar() -> los usan los estados para cambiar de estado o dejar constancia.
 */
class ControlReproduccion extends ComponenteReproductor {
  #estado = ESTADOS.detenido;

  constructor(duracionSeg) {
    super('ControlReproduccion');
    this.duracionSeg = duracionSeg;
    this.posicionSeg = 0;
  }

  /** Nombre del estado actual. */
  get estado() {
    return this.#estado.nombre;
  }

  /** ¿El usuario quiere ver el video? Lo dice el estado (cargando/reproduciendo: sí). */
  get quiereReproducir() {
    return this.#estado.quiereReproducir;
  }

  /** ¿Avanza el tiempo y se consume buffer? Solo en "reproduciendo". */
  get estaReproduciendo() {
    return this.#estado.reproduce;
  }

  accionesPermitidas() {
    return this.#estado.accionesPermitidas();
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

  // --- lo ordena el mediador: se delega en el estado actual ---
  ordenarReproducir({ bufferSuficiente }) {
    this.#estado.reproducir(this, { bufferSuficiente });
  }

  ordenarPausa() {
    this.#estado.pausar(this);
  }

  ordenarBufferVacio() {
    this.#estado.bufferVacio(this);
  }

  ordenarBufferRecuperado() {
    this.#estado.bufferRecuperado(this);
  }

  ordenarFin() {
    this.#estado.finContenido(this);
  }

  // --- lo usan los estados ---
  transicionarA(nombre, motivo = '') {
    const nuevo = ESTADOS[nombre];
    if (!nuevo) throw new Error(`Estado desconocido: "${nombre}".`);
    const de = this.#estado.nombre;
    this.#estado = nuevo;
    console.log(`🚦 [State] ${de} → ${nombre}${motivo ? ` (${motivo})` : ''}`);
    this.emitir('ESTADO_CAMBIO', { de, a: nombre, motivo });
  }

  /** Una acción del usuario que el estado actual no admite: no cambia nada y queda anotado. */
  ignorar(evento) {
    console.log(`🚦 [State] "${evento}" ignorado en estado ${this.#estado.nombre}`);
    this.emitir('TRANSICION_IGNORADA', { estado: this.#estado.nombre, evento, permitidas: this.#estado.accionesPermitidas() });
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
