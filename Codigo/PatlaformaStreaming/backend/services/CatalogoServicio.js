import CatalogoService from '../catalog/CatalogoService.js';
import PerfilRecomendacionRegistry from '../recommendation/PerfilRecomendacionRegistry.js';
import { ErrorNegocio } from '../proxy/errores.js';

/** SUJETO REAL (Proxy) — catálogo. Interfaz: listar(), detalle(). */
class CatalogoServicio {
  listar({ perfil, generos } = {}) {
    let lista = [];
    try {
      if (perfil) lista = PerfilRecomendacionRegistry.obtenerPlantilla(String(perfil)).generosFavoritos;
    } catch (e) {
      throw new ErrorNegocio(e.message);
    }
    if (!perfil && generos) lista = String(generos).split(',');

    if (lista.length === 0) return { catalogo: CatalogoService.obtenerArbol() };
    const catalogo = CatalogoService.filtrarPorGeneros(lista);
    return { generos: lista, catalogo, ...(catalogo ? {} : { message: 'Sin resultados para esos géneros.' }) };
  }

  detalle(id) {
    const nodo = CatalogoService.buscar(id);
    if (!nodo) throw new ErrorNegocio(`Contenido "${id}" no encontrado.`, 404);
    return { contenido: nodo.toJSON(), resumen: CatalogoService.resumir(nodo) };
  }
}

export default CatalogoServicio;
