import GeneradorRecomendaciones from './GeneradorRecomendaciones.js';

/**
 * Plantilla concreta "para ti": todos los títulos del catálogo que el usuario no ha visto,
 * respetando el `tipoContenidoPreferido` de su perfil (pelicula -> películas y documentales · serie -> series).
 */
class RecomendacionParaTi extends GeneradorRecomendaciones {
  tipo() {
    return 'para-ti';
  }

  descripcion() {
    return 'Títulos que aún no viste y que encajan con tu perfil (respeta tu tipo de contenido preferido).';
  }

  obtenerCandidatos(ctx) {
    return this.titulosDelCatalogo(ctx);
  }

  // GANCHO: además de quitar lo visto (comportamiento base), aplica el tipo preferido.
  filtrar(candidatos, ctx) {
    const sinVistos = super.filtrar(candidatos, ctx);
    const pref = ctx.perfil.tipoContenidoPreferido;
    if (pref === 'mixto') return sinVistos;
    return sinVistos.filter((n) => (pref === 'serie' ? n.tipo() === 'serie' : n.tipo() !== 'serie'));
  }
}

export default RecomendacionParaTi;
