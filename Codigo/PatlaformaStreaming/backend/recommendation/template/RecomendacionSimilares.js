import GeneradorRecomendaciones from './GeneradorRecomendaciones.js';

/**
 * Plantilla concreta "similares a X": parte de un título de referencia (ctx.nodoReferencia) y busca
 * los que comparten géneros con él. Aquí lo que "interesa" no son tus favoritos sino los géneros de X.
 */
class RecomendacionSimilares extends GeneradorRecomendaciones {
  tipo() {
    return 'similares';
  }

  descripcion() {
    return 'Títulos parecidos a uno concreto (parámetro contenidoId).';
  }

  // GANCHO: el interés son los géneros del título de referencia.
  definirGenerosInteres(ctx) {
    return [...ctx.nodoReferencia.getGeneros()];
  }

  obtenerCandidatos(ctx) {
    return this.titulosDelCatalogo(ctx).filter((n) => n.id !== ctx.nodoReferencia.id);
  }

  // GANCHO: aquí SÍ se puede recomendar algo ya visto (si te gustó X, quizá quieras repetir otro parecido).
  filtrar(candidatos) {
    return candidatos;
  }

  // GANCHO: se antepone la referencia al motivo base (géneros en común / historial).
  explicar(nodo, ctx) {
    const base = super.explicar(nodo, ctx);
    return `Parecido a "${ctx.nodoReferencia.titulo}"${base === 'Afín a tu perfil' ? '' : ` · ${base}`}`;
  }
}

export default RecomendacionSimilares;
