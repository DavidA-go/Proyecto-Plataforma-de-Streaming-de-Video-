import ProxyProtegido from './ProxyProtegido.js';
import { P } from '../flyweight/Permisos.js';

/**
 * PROXY DE PROTECCIÓN de suscripciones (listarPlanes, obtenerPlan, cambiarPlan).
 *  - listarPlanes: público (incluye invitados, para la pantalla de registro).
 *  - cambiarPlan:  tu propio plan -> usuario/admin; el de otra persona -> solo admin.
 */
class SuscripcionProxy extends ProxyProtegido {
  constructor(real, actor) {
    super('suscripcion', real, actor);
  }

  listarPlanes() {
    this.exigir('listar planes', P.PLANES_VER);
    return this.real.listarPlanes();
  }

  /** Consultar el plan de alguien: mismos permisos que cambiarlo (propio -> usuario/admin; ajeno -> admin). */
  obtenerPlan(usuarioId) {
    this.exigirPropioOAjeno('consultar plan', usuarioId, P.PLAN_CAMBIAR_PROPIO, P.PLAN_CAMBIAR_AJENO);
    return this.real.obtenerPlan(usuarioId);
  }

  cambiarPlan(usuarioId, tipoPlan) {
    this.exigirPropioOAjeno('cambiar plan', usuarioId, P.PLAN_CAMBIAR_PROPIO, P.PLAN_CAMBIAR_AJENO);
    return this.real.cambiarPlan(usuarioId, tipoPlan);
  }
}

export default SuscripcionProxy;
