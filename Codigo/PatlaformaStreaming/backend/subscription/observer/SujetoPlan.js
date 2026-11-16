import Observador from './Observador.js';

const MAX_HISTORIAL = 100;

/**
 * SujetoPlan.js
 * ------------------------------------------------------------------
 * SUBJECT (sujeto observable) del patrón Observer.
 *
 * Mantiene la lista de observadores y, cuando SuscripcionServicio le
 * pasa un evento ("PLAN_CAMBIADO"), se lo entrega a cada uno.
 *
 * Reglas importantes:
 *  - Aislamiento: si un observador falla, los demás igual se enteran y el
 *    cambio de plan NO se revierte (el observador es un efecto secundario,
 *    no parte de la transacción). El fallo queda en la traza como ERROR.
 *  - suscribir() es idempotente (el mismo observador no se duplica) y
 *    devuelve una función para darse de baja.
 *  - Se notifica sobre una COPIA de la lista: un observador puede darse de
 *    baja mientras recibe el evento sin romper la iteración.
 *  - Cada notificación se guarda con su TRAZA (qué hizo cada observador),
 *    por eso el Dashboard y las pruebas pueden VER el patrón funcionando.
 * ------------------------------------------------------------------
 */
class SujetoPlan {
  #observadores = [];
  #historial = [];
  #secuencia = 0;

  /** Registra un observador. Devuelve una función que lo da de baja. */
  suscribir(observador) {
    if (!(observador instanceof Observador)) {
      throw new Error('Solo se pueden suscribir instancias de Observador.');
    }
    if (!this.#observadores.includes(observador)) {
      this.#observadores.push(observador);
      console.log(`👁️  [Observer] ${observador.nombre} suscrito (${this.#observadores.length} observador(es))`);
    }
    return () => this.desuscribir(observador);
  }
  desuscribir(observador) {
    const i = this.#observadores.indexOf(observador);
    if (i === -1) return false;
    this.#observadores.splice(i, 1);
    console.log(`👁️  [Observer] ${observador.nombre} dado de baja (${this.#observadores.length} observador(es))`);
    return true;
  }
  nombresObservadores() {
    return this.#observadores.map((o) => o.nombre);
  }
  cantidad() {
    return this.#observadores.length;
  }
  /**
   * Entrega el evento a todos los observadores y devuelve el registro de lo ocurrido:
   * { n, fecha, ...evento, traza: [{ observador, estado: 'OK'|'ERROR', detalle }] }
   */
  notificar(evento) {
    const registro = { n: ++this.#secuencia, fecha: new Date().toISOString(), ...evento, traza: [] };
    console.log(`👁️  [Observer] ${evento.tipo} usuario=${evento.usuarioId} ${evento.planAnterior} → ${evento.planNuevo} · avisando a ${this.#observadores.length} observador(es)`);

    for (const observador of [...this.#observadores]) {
      try {
        const detalle = observador.actualizar(Object.freeze({ ...evento })) ?? '';
        registro.traza.push({ observador: observador.nombre, estado: 'OK', detalle: String(detalle) });
        console.log(`👁️  [Observer:${observador.nombre}] ${detalle}`);
      } catch (error) {
        registro.traza.push({ observador: observador.nombre, estado: 'ERROR', detalle: error.message });
        console.error(`👁️  [Observer:${observador.nombre}] ERROR: ${error.message}`);
      }
    }

    this.#historial.push(registro);
    if (this.#historial.length > MAX_HISTORIAL) this.#historial.shift();
    return registro;
  }

  /** Últimas notificaciones de un usuario (la más antigua primero). */
  historialDe(usuarioId, cantidad = 20) {
    return this.#historial.filter((r) => String(r.usuarioId) === String(usuarioId)).slice(-cantidad);
  }
}

export default SujetoPlan;
