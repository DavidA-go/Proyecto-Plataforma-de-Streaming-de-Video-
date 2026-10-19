import ProxyProtegido from './ProxyProtegido.js';
import { P } from '../flyweight/Permisos.js';

/**
 * PROXY DE PROTECCIÓN del subsistema DRM (autorizar, detener, auditoria).
 *  - autorizar: siempre para el propio actor (no se puede pedir licencia a nombre de otro).
 *  - detener:   propio -> usuario/admin; sesiones ajenas -> solo admin.
 *  - auditoria: solo admin.
 */
class DRMProxy extends ProxyProtegido {
  constructor(real, actor) {
    super('drm', real, actor);
  }

  autorizar(datos) {
    this.exigir('autorizar reproducción', P.DRM_AUTORIZAR);
    return this.real.autorizar({ ...datos, usuarioId: this.actor.id });
  }

  detener({ usuarioId, sesionId }) {
    const objetivo = usuarioId ?? this.actor?.id;
    this.exigirPropioOAjeno('detener reproducción', objetivo, P.DRM_DETENER_PROPIO, P.DRM_DETENER_AJENO);
    return this.real.detener({ usuarioId: objetivo, sesionId });
  }

  auditoria(cantidad) {
    this.exigir('consultar auditoría DRM', P.DRM_AUDITORIA);
    return this.real.auditoria(cantidad);
  }
}

export default DRMProxy;
