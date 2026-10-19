import ProxyProtegido from './ProxyProtegido.js';
import { P } from '../flyweight/Permisos.js';

/** PROXY DE PROTECCIÓN de streaming (generarManifestBasico, generarEntrega). */
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
}

export default StreamingProxy;
