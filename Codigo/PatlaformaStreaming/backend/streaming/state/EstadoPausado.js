import EstadoReproduccion from './EstadoReproduccion.js';

/** ESTADO CONCRETO — pausa del usuario: el tiempo no avanza, pero el buffer sigue llenándose. */
class EstadoPausado extends EstadoReproduccion {
  get nombre() {
    return 'pausado';
  }

  accionesPermitidas() {
    return ['reproducir', 'buscar'];
  }

  reproducir(ctx, { bufferSuficiente }) {
    ctx.transicionarA(bufferSuficiente ? 'reproduciendo' : 'cargando', 'el usuario reanudó');
  }
  // pausar(): heredado -> se ignora (ya está en pausa)
}

export default EstadoPausado;
