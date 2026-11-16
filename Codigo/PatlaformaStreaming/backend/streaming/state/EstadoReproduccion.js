/**
 * EstadoReproduccion.js
 * ------------------------------------------------------------------
 * STATE (interfaz) — subservicio de STREAMING ADAPTATIVO.
 *
 * Antes, el estado del reproductor era un string ('detenido', 'cargando',
 * 'reproduciendo', 'pausado') y las reglas sobre él estaban repartidas en
 * if/else dentro del mediador ("si BUFFER_VACIO y estaba reproduciendo...",
 * "si BUFFER_RECUPERADO y quería reproducir y estaba cargando..."). Nada
 * impedía transiciones absurdas, como "pausar" un video detenido.
 *
 * Con State, cada estado es un objeto que sabe:
 *   - QUÉ hace ante cada evento (reproducir, pausar, buffer vacío/recuperado, fin);
 *   - A QUÉ estado pasa;
 *   - QUÉ acciones permite (las muestra el Dashboard).
 * Agregar un estado nuevo (p. ej. "buffering de anuncio") es crear una clase.
 *
 * Los estados NO guardan datos: los datos (posición, duración) viven en el
 * contexto (ControlReproduccion). Por eso cada estado existe una sola vez y
 * se comparte (ver estados.js).
 *
 * Eventos de USUARIO (reproducir, pausar) que un estado no admite se
 * IGNORAN dejando constancia (TRANSICION_IGNORADA). Eventos de SISTEMA
 * (buffer, fin) que no le atañen se ignoran en silencio.
 * ------------------------------------------------------------------
 */
class EstadoReproduccion {
  constructor() {
    if (new.target === EstadoReproduccion) {
      throw new Error('EstadoReproduccion es abstracta: usa EstadoDetenido, EstadoCargando, EstadoReproduciendo o EstadoPausado.');
    }
  }

  /** 'detenido' | 'cargando' | 'reproduciendo' | 'pausado' */
  get nombre() {
    throw new Error('nombre debe ser implementado por el estado concreto.');
  }

  /** ¿En este estado el tiempo avanza y se consume buffer? Solo en "reproduciendo". */
  get reproduce() {
    return false;
  }

  /** ¿El usuario quiere ver el video? (si el buffer se vacía y se recupera, se reanuda solo). */
  get quiereReproducir() {
    return false;
  }

  /** Acciones del usuario que este estado admite (buscar siempre se admite). */
  accionesPermitidas() {
    throw new Error('accionesPermitidas() debe ser implementado por el estado concreto.');
  }

  // --- Eventos de USUARIO: por defecto se ignoran con constancia ---

  /** @param {{bufferSuficiente:boolean}} datos  lo calcula el mediador (el control no conoce al buffer) */
  // eslint-disable-next-line no-unused-vars
  reproducir(ctx, datos) {
    ctx.ignorar('REPRODUCIR');
  }

  pausar(ctx) {
    ctx.ignorar('PAUSA');
  }

  // --- Eventos de SISTEMA: por defecto no hacen nada ---
  // eslint-disable-next-line no-unused-vars
  bufferVacio(ctx) {}

  // eslint-disable-next-line no-unused-vars
  bufferRecuperado(ctx) {}

  // eslint-disable-next-line no-unused-vars
  finContenido(ctx) {}
}

export default EstadoReproduccion;
