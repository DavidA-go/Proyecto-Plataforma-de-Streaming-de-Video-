/**
 * Observador.js
 * ------------------------------------------------------------------
 * OBSERVER (interfaz) — subservicio de SUSCRIPCIONES.
 *
 * Cambiar de plan no es un asunto solo de "suscripción": cuando el plan
 * cambia, otros subservicios tienen que reaccionar:
 *   - DRM        -> liberar las pantallas que el plan nuevo ya no permite
 *   - Streaming  -> bajar (o subir) el techo de calidad de las sesiones abiertas
 *   - Usuario    -> recibir un aviso con lo que cambió
 *
 * Sin Observer, SuscripcionServicio tendría que importar y llamar a cada
 * uno de esos subsistemas (y a los que se agreguen mañana). Con Observer,
 * la suscripción solo AVISA "el plan cambió" y cada interesado se registra
 * por su cuenta: la suscripción no conoce a ningún observador concreto.
 * ------------------------------------------------------------------
 */
class Observador {
  constructor() {
    if (new.target === Observador) {
      throw new Error('Observador es abstracta: usa un observador concreto (DRM, Streaming, Notificación...).');
    }
  }

  /** Nombre que aparece en la traza y en los logs. */
  get nombre() {
    return this.constructor.name;
  }

  /**
   * Reacciona a un evento del sujeto.
   * @param {{tipo:string, usuarioId:number, planAnterior:string, planNuevo:string}} evento
   * @returns {string} resumen legible de lo que hizo (queda en la traza del evento)
   */
  // eslint-disable-next-line no-unused-vars
  actualizar(evento) {
    throw new Error('actualizar() debe ser implementado por el observador concreto.');
  }
}

export default Observador;
