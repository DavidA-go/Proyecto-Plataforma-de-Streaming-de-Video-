/**
 * GeneradorRecomendaciones.js
 * ------------------------------------------------------------------
 * TEMPLATE METHOD: define el ESQUELETO fijo de cualquier recomendación y deja a las subclases
 * solo los pasos que cambian.
 *
 *   generar()  ← método plantilla (no se sobrescribe)
 *     1. prepararContexto()         fijo      vistos, afinidad por género…
 *          └ definirGenerosInteres()  GANCHO   ¿qué géneros importan? (por defecto, los favoritos)
 *     2. obtenerCandidatos()        ABSTRACTO cada subclase decide de dónde salen los títulos
 *     3. filtrar()                  GANCHO    por defecto quita lo ya visto
 *     4. puntuar()                  fijo      delega en la ESTRATEGIA (patrón Strategy)
 *     5. puntajeMinimo()            GANCHO    por defecto descarta lo que no tiene ninguna relación
 *     6. ordenar() · limitar()      fijo      mayor puntaje primero; empate -> por título
 *     7. explicar()                 GANCHO    el "por qué te lo recomendamos"
 *     8. alFinalizar()              GANCHO    vacío por defecto (para log, métricas…)
 *
 * Template Method (herencia: el ORDEN de los pasos es fijo, cambian sus detalles) trabaja junto a
 * Strategy (composición: el ALGORITMO de puntuación se elige en tiempo de ejecución).
 *
 * Reutiliza el Iterator del catálogo para recorrer el árbol Composite.
 * ------------------------------------------------------------------
 */
const TIPOS_TITULO = ['pelicula', 'documental', 'serie']; // lo que se recomienda (no episodios ni grupos)
const redondear = (n) => Math.round(n * 1000) / 1000;

class GeneradorRecomendaciones {
  constructor() {
    if (new.target === GeneradorRecomendaciones) {
      throw new Error('GeneradorRecomendaciones es abstracta: usa RecomendacionParaTi, RecomendacionSimilares o RecomendacionDescubrir.');
    }
    // JavaScript no tiene "final": se hace cumplir aquí para que nadie rompa el orden de los pasos.
    if (Object.hasOwn(new.target.prototype, 'generar')) {
      throw new Error(`${new.target.name} no puede sobrescribir generar(): es el método plantilla.`);
    }
  }

  // ==================================================================
  // MÉTODO PLANTILLA
  // ==================================================================

  /**
   * @param {object} ctx  { perfil, historial: string[], estrategia, limite, raiz, contenidoId?, nodoReferencia? }
   */
  generar(ctx) {
    const pasos = [];
    const anotar = (paso, cantidad, nota) => pasos.push({ paso, ...(cantidad !== undefined ? { cantidad } : {}), ...(nota ? { nota } : {}) });

    this.prepararContexto(ctx);
    anotar('prepararContexto', ctx.generosInteres.length, `géneros de interés: ${ctx.generosInteres.join(', ') || '(ninguno)'}`);

    const candidatos = this.obtenerCandidatos(ctx);
    anotar('obtenerCandidatos', candidatos.length);

    const permitidos = this.filtrar(candidatos, ctx);
    anotar('filtrar', permitidos.length, `descartados: ${candidatos.length - permitidos.length}`);

    const puntuados = this.puntuar(permitidos, ctx);
    anotar('puntuar', puntuados.length, `estrategia: ${ctx.estrategia.id()}`);

    const minimo = this.puntajeMinimo(ctx);
    const relevantes = puntuados.filter((p) => p.puntaje > minimo);
    anotar('descartarIrrelevantes', relevantes.length, `puntaje > ${minimo}`);

    const ordenados = this.ordenar(relevantes);
    const elegidos = this.limitar(ordenados, ctx.limite);
    anotar('ordenar+limitar', elegidos.length, `límite ${ctx.limite}`);

    const recomendaciones = elegidos.map(({ nodo, puntaje }) => ({
      id: nodo.id,
      tipo: nodo.tipo(),
      titulo: nodo.titulo,
      generos: nodo.getGeneros(),
      puntaje: redondear(puntaje),
      motivo: this.explicar(nodo, ctx),
    }));
    anotar('explicar', recomendaciones.length);

    const resultado = {
      plantilla: this.constructor.name,
      tipo: this.tipo(),
      estrategia: ctx.estrategia.id(),
      pasos,
      recomendaciones,
    };
    this.alFinalizar(resultado, ctx);
    console.log(`🧩 [Template Method] ${this.constructor.name} + estrategia "${ctx.estrategia.id()}" -> ${recomendaciones.length} recomendación(es)`);
    return resultado;
  }

  // ==================================================================
  // PASOS FIJOS (iguales para todas las subclases)
  // ==================================================================

  prepararContexto(ctx) {
    ctx.vistos = new Set(ctx.historial);
    ctx.historialVacio = ctx.historial.length === 0;

    // Afinidad: cuántas veces vio cada género, normalizado (el más visto = 1).
    const conteo = new Map();
    for (const id of ctx.historial) {
      const nodo = ctx.raiz.buscar(id);
      if (!nodo) continue;
      for (const g of nodo.getGeneros()) conteo.set(g, (conteo.get(g) ?? 0) + 1);
    }
    const maximo = Math.max(1, ...conteo.values());
    ctx.afinidad = new Map([...conteo].map(([g, n]) => [g, n / maximo]));

    ctx.generosInteres = this.definirGenerosInteres(ctx); // gancho
  }

  /** Strategy: la subclase no decide CÓMO se puntúa; lo hace la estrategia recibida en el contexto. */
  puntuar(candidatos, ctx) {
    return candidatos.map((nodo) => ({ nodo, puntaje: ctx.estrategia.puntuar(nodo, ctx) }));
  }

  ordenar(puntuados) {
    return [...puntuados].sort((a, b) => b.puntaje - a.puntaje || a.nodo.titulo.localeCompare(b.nodo.titulo, 'es'));
  }

  limitar(ordenados, limite) {
    return ordenados.slice(0, limite);
  }

  /** Todos los títulos recomendables del catálogo (Iterator sobre el Composite). */
  titulosDelCatalogo(ctx) {
    return [...ctx.raiz.crearIterador('profundidad', (n) => TIPOS_TITULO.includes(n.tipo()))];
  }

  // ==================================================================
  // PASO ABSTRACTO (cada subclase DEBE implementarlo)
  // ==================================================================

  /** Nombre corto del tipo de recomendación (el que se pide por la API). */
  tipo() {
    throw new Error('tipo() debe ser implementado por la subclase.');
  }

  descripcion() {
    throw new Error('descripcion() debe ser implementado por la subclase.');
  }

  // eslint-disable-next-line no-unused-vars
  obtenerCandidatos(ctx) {
    throw new Error('obtenerCandidatos() debe ser implementado por la subclase.');
  }

  // ==================================================================
  // GANCHOS (tienen comportamiento por defecto; la subclase puede cambiarlo)
  // ==================================================================

  /** Por defecto interesan los géneros favoritos del perfil. */
  definirGenerosInteres(ctx) {
    return [...ctx.perfil.generosFavoritos];
  }

  /** Por defecto no se recomienda lo que el usuario ya vio. */
  filtrar(candidatos, ctx) {
    return candidatos.filter((n) => !ctx.vistos.has(n.id));
  }

  /** Por defecto se descarta lo que no tiene ninguna relación (puntaje 0). */
  // eslint-disable-next-line no-unused-vars
  puntajeMinimo(ctx) {
    return 0;
  }

  /**
   * Por defecto el motivo cuenta lo que la ESTRATEGIA realmente miró: géneros en común y/o
   * géneros que el usuario ya ha visto.
   */
  explicar(nodo, ctx) {
    const partes = [];
    if (ctx.estrategia.usaGeneros()) {
      const comunes = nodo.getGeneros().filter((g) => ctx.generosInteres.includes(g));
      if (comunes.length) partes.push(`Coincide con tus géneros: ${comunes.join(', ')}`);
    }
    if (ctx.estrategia.usaHistorial()) {
      const vistos = nodo.getGeneros().filter((g) => ctx.afinidad.has(g));
      if (vistos.length) partes.push(`Por lo que has visto: ${vistos.join(', ')}`);
    }
    return partes.join(' · ') || 'Afín a tu perfil';
  }

  // eslint-disable-next-line no-unused-vars
  alFinalizar(resultado, ctx) {}
}

export default GeneradorRecomendaciones;
