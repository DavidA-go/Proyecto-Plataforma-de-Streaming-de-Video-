import CatalogoService from '../catalog/CatalogoService.js';
import PerfilRecomendacionRegistry from '../recommendation/PerfilRecomendacionRegistry.js';
import { ErrorNegocio } from '../proxy/errores.js';

const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAXIMO = 100;

/** SUJETO REAL (Proxy) — catálogo. Interfaz: listar(), detalle(), recorrer(), siguiente(). */
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

  /**
   * ITERATOR — recorre el árbol del catálogo desde el nodo `id` y devuelve una PÁGINA.
   * El iterador es perezoso: para pedir la página 1 no se recorre todo el catálogo.
   *
   * @param {string} id        nodo raíz del recorrido ("catalogo" = todo)
   * @param {string} orden     'profundidad' (por defecto) | 'anchura' | 'reproducibles'
   * @param {string} genero    solo nodos que incluyan ese género (opcional)
   * @param {string} tipo      solo nodos de ese tipo: pelicula, episodio, serie... (opcional)
   * @param {number} desde     cuántos elementos saltar (paginación)
   * @param {number} limite    tamaño de página (máx. 100)
   */
  recorrer({ id = 'catalogo', orden = 'profundidad', genero, tipo, desde = 0, limite = LIMITE_POR_DEFECTO } = {}) {
    const raiz = CatalogoService.buscar(id);
    if (!raiz) throw new ErrorNegocio(`Contenido "${id}" no encontrado.`, 404);

    const salto = Number.parseInt(desde, 10);
    const tamano = Number.parseInt(limite, 10);
    if (!Number.isInteger(salto) || salto < 0) throw new ErrorNegocio('"desde" debe ser un entero >= 0.');
    if (!Number.isInteger(tamano) || tamano < 1) throw new ErrorNegocio('"limite" debe ser un entero >= 1.');
    const tope = Math.min(tamano, LIMITE_MAXIMO);

    const generoNorm = genero ? String(genero).toLowerCase().trim() : null;
    const tipoNorm = tipo ? String(tipo).toLowerCase().trim() : null;
    const predicado = (nodo) =>
      (!generoNorm || nodo.getGeneros().includes(generoNorm)) && (!tipoNorm || nodo.tipo() === tipoNorm);

    let iterador;
    try {
      iterador = raiz.crearIterador(orden, predicado);
    } catch (e) {
      throw new ErrorNegocio(e.message);
    }

    for (let i = 0; i < salto && iterador.hasNext(); i++) iterador.next(); // salta las páginas anteriores

    const elementos = [];
    while (elementos.length < tope && iterador.hasNext()) {
      const nodo = iterador.next();
      elementos.push({ ...CatalogoService.resumir(nodo), nivel: iterador.nivel, generos: nodo.getGeneros() });
    }
    const hayMas = iterador.hasNext();

    return {
      raiz: id,
      orden,
      filtros: { genero: generoNorm, tipo: tipoNorm },
      desde: salto,
      cantidad: elementos.length,
      siguiente: hayMas ? salto + elementos.length : null, // valor para pedir la página siguiente
      elementos,
    };
  }

  /**
   * ITERATOR — "siguiente episodio / siguiente título": dentro del orden de reproducción de TODO el
   * catálogo, devuelve el reproducible que viene después de `id` (que puede ser un episodio, una
   * película o incluso una serie: en ese caso se parte desde su último reproducible).
   */
  siguiente(id) {
    const actual = CatalogoService.buscar(id);
    if (!actual) throw new ErrorNegocio(`Contenido "${id}" no encontrado.`, 404);

    const ultimoDelNodo = actual.esReproducible() ? actual : actual.crearIterador('reproducibles').toArray().at(-1);
    if (!ultimoDelNodo) return { actual: CatalogoService.resumir(actual), siguiente: null };

    const iterador = CatalogoService.raiz.crearIterador('reproducibles');
    while (iterador.hasNext()) {
      if (iterador.next() === ultimoDelNodo) {
        const sig = iterador.hasNext() ? iterador.next() : null;
        return { actual: CatalogoService.resumir(actual), siguiente: sig ? CatalogoService.resumir(sig) : null };
      }
    }
    return { actual: CatalogoService.resumir(actual), siguiente: null };
  }
}

export default CatalogoServicio;
