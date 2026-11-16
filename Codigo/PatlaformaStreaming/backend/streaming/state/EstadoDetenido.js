import EstadoReproduccion from './EstadoReproduccion.js';

/** ESTADO CONCRETO — sin reproducir (inicio, o el video terminó). Solo admite reproducir. */
class EstadoDetenido extends EstadoReproduccion {
  get nombre() {
    return 'detenido';
  }

  accionesPermitidas() {
    return ['reproducir', 'buscar'];
  }

  reproducir(ctx, { bufferSuficiente }) {
    ctx.transicionarA(bufferSuficiente ? 'reproduciendo' : 'cargando', 'el usuario pulsó reproducir');
  }
  // pausar(): heredado -> se ignora (no hay nada que pausar)
}

export default EstadoDetenido;
