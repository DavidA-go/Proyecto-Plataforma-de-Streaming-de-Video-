import EstadoReproduccion from './EstadoReproduccion.js';

/** ESTADO CONCRETO — el video avanza y consume buffer. */
class EstadoReproduciendo extends EstadoReproduccion {
  get nombre() {
    return 'reproduciendo';
  }

  get reproduce() {
    return true;
  }

  get quiereReproducir() {
    return true;
  }

  accionesPermitidas() {
    return ['pausar', 'buscar'];
  }

  pausar(ctx) {
    ctx.transicionarA('pausado', 'el usuario pausó');
  }

  bufferVacio(ctx) {
    ctx.transicionarA('cargando', 'el buffer se vació');
  }

  finContenido(ctx) {
    ctx.transicionarA('detenido', 'el contenido terminó');
  }
  // reproducir(): heredado -> se ignora (ya se está reproduciendo)
}

export default EstadoReproduciendo;
