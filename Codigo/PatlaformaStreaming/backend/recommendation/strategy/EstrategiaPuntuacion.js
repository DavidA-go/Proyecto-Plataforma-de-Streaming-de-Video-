/**
 * EstrategiaPuntuacion.js
 * ------------------------------------------------------------------
 * STRATEGY (interfaz): una forma intercambiable de PUNTUAR qué tan bien
 * encaja un título con un usuario (0 = nada, 1 = encaje total).
 *
 * El generador de recomendaciones (Template Method) no sabe cuál usa:
 * solo llama a puntuar(). Cambiar el algoritmo = pasar otra estrategia,
 * sin tocar el generador ni el servicio.
 *
 * Contexto que recibe cada estrategia (lo arma el generador):
 *   ctx.generosInteres   géneros que "interesan" ahora (favoritos, o los de un título de referencia)
 *   ctx.afinidad         Map género -> 0..1 calculado con lo que el usuario ya vio
 *   ctx.historialVacio   true si el usuario aún no ha visto nada
 *   ctx.perfil           PerfilRecomendacion del usuario (pesoHistorial, etc.)
 * ------------------------------------------------------------------
 */
class EstrategiaPuntuacion {
  constructor() {
    if (new.target === EstrategiaPuntuacion) {
      throw new Error('EstrategiaPuntuacion es abstracta: usa PuntuacionPorGeneros, PuntuacionPorHistorial o PuntuacionHibrida.');
    }
  }

  /** Identificador corto (el que se pide por la API). */
  id() {
    throw new Error('id() debe ser implementado por la subclase.');
  }

  /** Explicación en una frase de cómo puntúa. */
  descripcion() {
    throw new Error('descripcion() debe ser implementado por la subclase.');
  }

  /** ¿Esta estrategia mira los géneros de interés? (el generador lo usa para explicar el motivo) */
  usaGeneros() {
    return true;
  }

  /** ¿Esta estrategia mira lo que el usuario ya vio? */
  usaHistorial() {
    return false;
  }

  /** @returns {number} puntaje entre 0 y 1 para ese nodo del catálogo */
  // eslint-disable-next-line no-unused-vars
  puntuar(nodo, ctx) {
    throw new Error('puntuar() debe ser implementado por la subclase.');
  }
}

export default EstrategiaPuntuacion;
