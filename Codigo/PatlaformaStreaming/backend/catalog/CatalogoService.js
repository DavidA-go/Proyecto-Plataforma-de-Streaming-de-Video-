import { construirCatalogoDemo } from './catalogoDemo.js';

/**
 * CatalogoService.js
 * ------------------------------------------------------------------
 * Punto único de acceso al catálogo (la RAÍZ del árbol Composite).
 * El resto del backend solo habla con este servicio: pide buscar un
 * nodo por id o filtrar por géneros, y no necesita saber cómo está
 * armado el árbol por dentro.
 * ------------------------------------------------------------------
 */
class CatalogoService {
  static raiz = construirCatalogoDemo();

  static obtenerArbol() {
    return CatalogoService.raiz.toJSON();
  }

  /** Devuelve el nodo (hoja o grupo) con ese id, o null si no existe. */
  static buscar(id) {
    return CatalogoService.raiz.buscar(id);
  }

  /**
   * Resumen de un nodo cualquiera (película, serie, colección...). Sirve
   * igual para hojas y grupos: es la ventaja del Composite. Lo comparten
   * DRMFacade y los endpoints de index.js.
   */
  static resumir(nodo) {
    return {
      id: nodo.id,
      tipo: nodo.tipo(),
      titulo: nodo.titulo,
      duracionMin: nodo.getDuracion(),
      duracionTexto: nodo.getDuracionFormateada(),
      totalReproducibles: nodo.obtenerReproducibles().length,
    };
  }

  /** Árbol podado: solo lo que coincide con alguno de los géneros pedidos. */
  static filtrarPorGeneros(generos) {
    const normalizados = generos.map((g) => g.toLowerCase().trim()).filter(Boolean);
    return CatalogoService.raiz.filtrar(normalizados);
  }
}

export default CatalogoService;
