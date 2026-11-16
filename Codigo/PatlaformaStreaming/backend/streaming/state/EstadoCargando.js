import EstadoReproduccion from './EstadoReproduccion.js';

/** ESTADO CONCRETO — el usuario quiere ver el video pero el buffer aún no alcanza. Reanuda solo al recuperarse. */
class EstadoCargando extends EstadoReproduccion {
  get nombre() {
    return 'cargando';
  }

  get quiereReproducir() {
    return true;
  }

  accionesPermitidas() {
    return ['pausar', 'buscar'];
  }

  pausar(ctx) {
    ctx.transicionarA('pausado', 'el usuario pausó mientras cargaba');
  }

  bufferRecuperado(ctx) {
    ctx.transicionarA('reproduciendo', 'el buffer se recuperó');
  }
  // reproducir(): heredado -> se ignora (ya está cargando para reproducir)
}

export default EstadoCargando;
