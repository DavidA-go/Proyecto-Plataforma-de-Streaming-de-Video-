import ProxyProtegido from './ProxyProtegido.js';
import { P } from '../flyweight/Permisos.js';

/**
 * PROXY DE PROTECCIÓN + CACHÉ del catálogo.
 * Misma interfaz que CatalogoServicio (listar, detalle).
 * Además de verificar permisos, cachea el árbol completo (que no cambia
 * entre peticiones), así el servicio real se ejecuta una sola vez.
 */
class CatalogoProxy extends ProxyProtegido {
  static #cacheArbol = null;
  static aciertosCache = 0;

  constructor(real, actor) {
    super('catalogo', real, actor);
  }

  listar(filtros = {}) {
    this.exigir('listar catálogo', P.CATALOGO_VER);
    const sinFiltro = !filtros.perfil && !filtros.generos;
    if (sinFiltro) {
      if (CatalogoProxy.#cacheArbol) {
        CatalogoProxy.aciertosCache++;
        console.log('🛡️  [Proxy:catalogo] respuesta desde caché');
        return CatalogoProxy.#cacheArbol;
      }
      return (CatalogoProxy.#cacheArbol = this.real.listar(filtros));
    }
    return this.real.listar(filtros);
  }

  detalle(id) {
    this.exigir('ver detalle de contenido', P.CATALOGO_VER);
    return this.real.detalle(id);
  }
}

export default CatalogoProxy;
