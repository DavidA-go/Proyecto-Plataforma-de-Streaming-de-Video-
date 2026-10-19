import CatalogoServicio from '../services/CatalogoServicio.js';
import RecomendacionServicio from '../services/RecomendacionServicio.js';
import StreamingServicio from '../services/StreamingServicio.js';
import DRMServicio from '../services/DRMServicio.js';
import SuscripcionServicio from '../services/SuscripcionServicio.js';
import UsuarioServicio from '../services/UsuarioServicio.js';
import CatalogoProxy from './CatalogoProxy.js';
import RecomendacionProxy from './RecomendacionProxy.js';
import StreamingProxy from './StreamingProxy.js';
import DRMProxy from './DRMProxy.js';
import SuscripcionProxy from './SuscripcionProxy.js';
import UsuarioProxy from './UsuarioProxy.js';
import AccesoLog from './AccesoLog.js';
import RolFlyweightFactory from '../flyweight/RolFlyweightFactory.js';
import CalidadVideoFactory from '../flyweight/CalidadVideoFactory.js';
import ProxyProtegido from './ProxyProtegido.js';
import { P } from '../flyweight/Permisos.js';

/**
 * ServiciosProxy.js
 * ------------------------------------------------------------------
 * Punto único donde se ENSAMBLAN los proxies. Los servicios reales son
 * stateless y se crean una sola vez; los proxies se crean POR PETICIÓN
 * porque cada uno guarda el actor (quien llama).
 *
 *   const s = ServiciosProxy.para(usuario);   // usuario = {id, rol} o null
 *   s.catalogo.listar();                       // proxy -> servicio real
 *
 * Los endpoints solo hablan con proxies: nadie fuera de este archivo
 * importa un servicio real.
 * ------------------------------------------------------------------
 */
const reales = {
  catalogo: new CatalogoServicio(),
  recomendacion: new RecomendacionServicio(),
  streaming: new StreamingServicio(),
  drm: new DRMServicio(),
  suscripcion: new SuscripcionServicio(),
  usuarios: new UsuarioServicio(),
};

/** Proxy mínimo para los datos propios del sistema (accesos y estadísticas del Flyweight). */
class SistemaProxy extends ProxyProtegido {
  constructor(actor) {
    super('sistema', null, actor);
  }

  accesos(cantidad = 50) {
    this.exigir('consultar registro de accesos', P.SISTEMA_ACCESOS);
    return AccesoLog.ultimos(cantidad);
  }

  estadisticasFlyweight() {
    this.exigir('consultar estadísticas Flyweight', P.SISTEMA_ESTADISTICAS);
    return {
      roles: RolFlyweightFactory.estadisticas(),
      calidades: CalidadVideoFactory.estadisticas(),
      permisosPorRol: ['invitado', 'usuario', 'admin'].map((r) => RolFlyweightFactory.obtener(r).toJSON()),
    };
  }
}

class ServiciosProxy {
  static para(actor) {
    return {
      catalogo: new CatalogoProxy(reales.catalogo, actor),
      recomendacion: new RecomendacionProxy(reales.recomendacion, actor),
      streaming: new StreamingProxy(reales.streaming, actor),
      drm: new DRMProxy(reales.drm, actor),
      suscripcion: new SuscripcionProxy(reales.suscripcion, actor),
      usuarios: new UsuarioProxy(reales.usuarios, actor),
      sistema: new SistemaProxy(actor),
    };
  }
}

export default ServiciosProxy;
