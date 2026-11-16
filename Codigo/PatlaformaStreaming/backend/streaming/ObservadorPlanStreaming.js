import Observador from '../subscription/observer/Observador.js';
import RegistroSesiones from './mediator/RegistroSesiones.js';
import { techoDesdePlan } from '../services/StreamingServicio.js';

/**
 * OBSERVADOR CONCRETO — subservicio de STREAMING ADAPTATIVO.
 *
 * Problema real que resuelve: cada sesión de reproducción (Mediator) guarda
 * el techo de calidad con el que se creó. Si el usuario cambiaba de plan a
 * mitad de una película, seguía viendo la calidad del plan anterior. Ahora
 * cada sesión abierta recibe el techo nuevo y su mediador decide si hay que
 * bajar la calidad al instante o dejar que la ABR suba sola.
 */
class ObservadorPlanStreaming extends Observador {
  actualizar(evento) {
    const sesiones = RegistroSesiones.delUsuario(evento.usuarioId);
    if (sesiones.length === 0) return 'El usuario no tiene sesiones de reproducción abiertas.';

    const techo = techoDesdePlan(evento.calidadMaxima);
    const cambios = sesiones.map((s) => s.cambiarTecho(techo));
    const ajustadas = cambios.filter((c) => c.calidadAnterior !== c.calidadNueva).length;
    return `${sesiones.length} sesión(es) con techo ${techo}; ${ajustadas} cambiaron de calidad (${cambios.map((c) => `${c.calidadAnterior}→${c.calidadNueva}`).join(', ')}).`;
  }
}

export default ObservadorPlanStreaming;
