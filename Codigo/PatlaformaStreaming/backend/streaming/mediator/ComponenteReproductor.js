/**
 * ComponenteReproductor.js
 * ------------------------------------------------------------------
 * COLLEAGUE (base) del patrón Mediator. Toda pieza del reproductor
 * extiende esta clase y solo conoce una cosa: su mediador. Nunca
 * referencia a otro componente.
 * ------------------------------------------------------------------
 */
class ComponenteReproductor {
  constructor(nombre) {
    if (new.target === ComponenteReproductor) {
      throw new Error('ComponenteReproductor es abstracta: usa MonitorRed, SelectorCalidad, BufferReproduccion, ControlReproduccion o ControlPistas.');
    }
    this.nombre = nombre;
    this.mediador = null;
  }

  setMediador(mediador) {
    this.mediador = mediador;
  }

  /** Avisa al mediador. Si todavía no tiene mediador, no pasa nada (el componente funciona aislado). */
  emitir(evento, datos = {}) {
    this.mediador?.notificar(this, evento, datos);
  }
}

export default ComponenteReproductor;
