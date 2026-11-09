/**
 * PerfilMemento.js
 * ------------------------------------------------------------------
 * MEMENTO — subservicio de SISTEMA DE RECOMENDACIÓN.
 *
 * "Foto" INMUTABLE del estado de un PerfilRecomendacion en un momento.
 * Reglas del patrón:
 *  - Solo el ORIGINADOR (PerfilRecomendacion) lo crea y lo lee
 *    (getEstado()): para el resto es una caja cerrada.
 *  - El CUIDADOR (HistorialPerfil) únicamente lo guarda y lo devuelve;
 *    solo ve los metadatos públicos (version, etiqueta, fecha).
 *  - Se guarda una COPIA PROFUNDA y se congela: cambiar luego el perfil
 *    no altera la foto, y nadie puede alterar la foto por fuera.
 * ------------------------------------------------------------------
 */
class PerfilMemento {
  #estado;

  constructor(estado, etiqueta = '') {
    this.#estado = Object.freeze({ ...estado, generosFavoritos: Object.freeze([...estado.generosFavoritos]) });
    this.etiqueta = etiqueta; // metadato: qué estado guarda ("Antes de cambiar pesoHistorial")
    this.fecha = new Date().toISOString(); // metadato: cuándo se tomó
    Object.freeze(this);
  }

  /** Interfaz "ancha": SOLO la usa el originador al restaurar. El cuidador no debe llamarla. */
  getEstado() {
    return this.#estado;
  }

  /** Lo único que el resto del sistema puede ver. */
  resumen() {
    return { etiqueta: this.etiqueta, fecha: this.fecha, generosFavoritos: [...this.#estado.generosFavoritos] };
  }
}

export default PerfilMemento;
