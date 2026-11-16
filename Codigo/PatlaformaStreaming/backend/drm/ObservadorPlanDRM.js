import Observador from '../subscription/observer/Observador.js';
import SesionesRegistry from './SesionesRegistry.js';
import AuditoriaLog from './AuditoriaLog.js';

/**
 * OBSERVADOR CONCRETO — subservicio DRM.
 *
 * Problema real que resuelve: si un usuario baja de plan (p. ej. de Familiar,
 * 4 pantallas, a Free, 1 pantalla), antes seguía con todas sus pantallas
 * abiertas hasta que expiraban solas (10 min). Ahora, en cuanto cambia el
 * plan, se liberan las sesiones MÁS ANTIGUAS que excedan el límite nuevo y
 * queda constancia en la bitácora de auditoría DRM.
 */
class ObservadorPlanDRM extends Observador {
  actualizar(evento) {
    const liberadas = SesionesRegistry.limitar(evento.usuarioId, evento.pantallasMaximas);
    for (const s of liberadas) {
      AuditoriaLog.registrar({
        resultado: 'REVOCADA',
        usuarioId: evento.usuarioId,
        contenidoId: s.contenidoId,
        sesionId: s.id,
        motivo: 'CAMBIO_DE_PLAN',
      });
    }
    const enUso = SesionesRegistry.activas(evento.usuarioId).length;
    return liberadas.length === 0
      ? `Sin sesiones de más: ${enUso}/${evento.pantallasMaximas} pantalla(s) en uso.`
      : `Liberó ${liberadas.length} pantalla(s) (${liberadas.map((s) => s.id).join(', ')}); quedan ${enUso}/${evento.pantallasMaximas}.`;
  }
}

export default ObservadorPlanDRM;
