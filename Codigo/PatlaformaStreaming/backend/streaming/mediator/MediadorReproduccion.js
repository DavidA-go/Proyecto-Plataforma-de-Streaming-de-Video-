/**
 * MediadorReproduccion.js
 * ------------------------------------------------------------------
 * MEDIATOR (interfaz) — subservicio de STREAMING ADAPTATIVO.
 *
 * Un reproductor adaptativo tiene varias piezas que dependen unas de
 * otras: la red cambia -> hay que cambiar de calidad; el buffer se
 * vacía -> hay que pausar y bajar calidad; el usuario salta -> hay que
 * vaciar el buffer y arrancar en baja calidad...
 *
 * Si cada pieza conociera a las demás, serían 5 clases acopladas entre
 * sí (hasta 20 referencias cruzadas). Con el Mediator cada pieza SOLO
 * conoce al mediador: le avisa "pasó esto" y él decide qué hacen las demás.
 * ------------------------------------------------------------------
 */
class MediadorReproduccion {
  /**
   * @param {ComponenteReproductor} emisor quién avisa
   * @param {string} evento                nombre del evento (RED_CAMBIO, BUFFER_BAJO, ...)
   * @param {object} datos                 detalle del evento
   */
  // eslint-disable-next-line no-unused-vars
  notificar(emisor, evento, datos) {
    throw new Error('notificar() debe ser implementado por el mediador concreto.');
  }
}

export default MediadorReproduccion;
