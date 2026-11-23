import GeneradorRecomendaciones from './GeneradorRecomendaciones.js';

/**
 * Plantilla concreta "descubrir": sale de tu zona de confort. Los géneros de interés son los que ya
 * viste pero NO están en tus favoritos (gustos emergentes); si no hay, cualquiera que no sea favorito.
 * Solo propone títulos que tengan al menos un género fuera de tus favoritos.
 */
class RecomendacionDescubrir extends GeneradorRecomendaciones {
  tipo() {
    return 'descubrir';
  }

  descripcion() {
    return 'Géneros que ya viste pero no están en tus favoritos, o nuevos para ti.';
  }

  definirGenerosInteres(ctx) {
    const favoritos = new Set(ctx.perfil.generosFavoritos);
    const emergentes = [...ctx.afinidad.keys()].filter((g) => !favoritos.has(g));
    if (emergentes.length) return emergentes;
    const todos = new Set(this.titulosDelCatalogo(ctx).flatMap((n) => n.getGeneros()));
    return [...todos].filter((g) => !favoritos.has(g));
  }

  obtenerCandidatos(ctx) {
    return this.titulosDelCatalogo(ctx);
  }

  filtrar(candidatos, ctx) {
    const favoritos = new Set(ctx.perfil.generosFavoritos);
    return super.filtrar(candidatos, ctx).filter((n) => n.getGeneros().some((g) => !favoritos.has(g)));
  }

  explicar(nodo, ctx) {
    const nuevos = nodo.getGeneros().filter((g) => ctx.generosInteres.includes(g));
    return nuevos.length ? `Para salir de la rutina: ${nuevos.join(', ')}` : 'Algo distinto a tus favoritos';
  }
}

export default RecomendacionDescubrir;
