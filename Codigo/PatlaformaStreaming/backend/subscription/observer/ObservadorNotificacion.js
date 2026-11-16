import Observador from './Observador.js';

const MAX_BANDEJA = 50;

/**
 * OBSERVADOR CONCRETO — aviso al usuario. (En producción aquí se enviaría
 * un correo o una notificación push; en el proyecto se guarda en una
 * bandeja en memoria y se muestra en la traza.)
 */
class ObservadorNotificacion extends Observador {
  #bandeja = [];

  actualizar(evento) {
    const aviso = `Tu plan pasó de "${evento.planAnterior}" a "${evento.planNuevo}": calidad ${evento.calidadMaxima}, ${evento.pantallasMaximas} pantalla(s) simultánea(s).`;
    this.#bandeja.push({ usuarioId: evento.usuarioId, fecha: new Date().toISOString(), aviso });
    if (this.#bandeja.length > MAX_BANDEJA) this.#bandeja.shift();
    return `Aviso enviado al usuario: ${aviso}`;
  }

  /** Avisos enviados a un usuario (el más antiguo primero). */
  enviadosA(usuarioId) {
    return this.#bandeja.filter((a) => String(a.usuarioId) === String(usuarioId));
  }
}

export default ObservadorNotificacion;
