import ProxyProtegido from './ProxyProtegido.js';
import { P } from '../flyweight/Permisos.js';

/** PROXY DE PROTECCIÓN de recomendación (generarPerfil). */
class RecomendacionProxy extends ProxyProtegido {
  constructor(real, actor) {
    super('recomendacion', real, actor);
  }

  generarPerfil(datos) {
    this.exigir('generar perfil de recomendación', P.RECOMENDACION_VER);
    return this.real.generarPerfil(datos);
  }
}

export default RecomendacionProxy;
