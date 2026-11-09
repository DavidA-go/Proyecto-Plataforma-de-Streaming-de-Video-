import ProxyProtegido from './ProxyProtegido.js';
import { P } from '../flyweight/Permisos.js';

/** PROXY DE PROTECCIÓN de streaming (generarManifestBasico, generarEntrega + sesiones del Mediator). */
class StreamingProxy extends ProxyProtegido {
  constructor(real, actor) {
    super('streaming', real, actor);
  }

  generarManifestBasico(datos) {
    this.exigir('generar manifiesto básico', P.STREAMING_MANIFEST_BASICO);
    return this.real.generarManifestBasico(datos);
  }

  generarEntrega(datos) {
    this.exigir('generar entrega de streaming', P.STREAMING_REPRODUCIR);
    return this.real.generarEntrega(datos);
  }

  // ---- Mediator: sesiones de reproducción. Siempre del propio actor (no se acepta usuarioId ajeno). ----
  crearSesion(datos) {
    this.exigir('crear sesión de reproducción', P.STREAMING_REPRODUCIR);
    return this.real.crearSesion({ ...datos, usuarioId: this.actor.id });
  }

  accionSesion(datos) {
    this.exigir('controlar sesión de reproducción', P.STREAMING_REPRODUCIR);
    return this.real.accionSesion({ ...datos, usuarioId: this.actor.id });
  }

  estadoSesion(datos) {
    this.exigir('consultar sesión de reproducción', P.STREAMING_REPRODUCIR);
    return this.real.estadoSesion({ ...datos, usuarioId: this.actor.id });
  }

  cerrarSesion(datos) {
    this.exigir('cerrar sesión de reproducción', P.STREAMING_REPRODUCIR);
    return this.real.cerrarSesion({ ...datos, usuarioId: this.actor.id });
  }
}

export default StreamingProxy;
