import EstrategiaPuntuacion from './EstrategiaPuntuacion.js';
import PuntuacionPorGeneros from './PuntuacionPorGeneros.js';
import PuntuacionPorHistorial from './PuntuacionPorHistorial.js';

/**
 * Estrategia concreta: mezcla las dos anteriores con el `pesoHistorial` del perfil del usuario
 * (0 = solo géneros · 1 = solo historial). Es el campo que el perfil ya tenía y nadie usaba.
 *
 *   puntaje = (1 - peso) · porGeneros + peso · porHistorial
 *
 * Si el usuario aún no vio nada, el peso efectivo es 0 (no tiene sentido fiarse de un historial vacío).
 * Las dos estrategias que combina se reciben por constructor (composición): mismo contrato, otra mezcla.
 */
class PuntuacionHibrida extends EstrategiaPuntuacion {
  constructor(porGeneros = new PuntuacionPorGeneros(), porHistorial = new PuntuacionPorHistorial()) {
    super();
    this.porGeneros = porGeneros;
    this.porHistorial = porHistorial;
  }

  id() {
    return 'hibrida';
  }

  descripcion() {
    return 'Mezcla géneros e historial según el "pesoHistorial" de tu perfil.';
  }

  usaHistorial() {
    return true;
  }

  /** Peso real del historial para este usuario. */
  pesoEfectivo(ctx) {
    return ctx.historialVacio ? 0 : ctx.perfil.pesoHistorial;
  }

  puntuar(nodo, ctx) {
    const w = this.pesoEfectivo(ctx);
    return (1 - w) * this.porGeneros.puntuar(nodo, ctx) + w * this.porHistorial.puntuar(nodo, ctx);
  }
}

export default PuntuacionHibrida;
