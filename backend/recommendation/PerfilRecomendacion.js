/**
 * PerfilRecomendacion.js
 * ------------------------------------------------------------------
 * PROTOTYPE: objeto "clonable" que representa un perfil de preferencias
 * usado por el sistema de recomendación (géneros favoritos, tipo de
 * contenido preferido, peso que se le da al historial, etc.)
 *
 * El método clonar() es el corazón del patrón: en vez de construir un
 * perfil desde cero cada vez (recalculando pesos, listas de géneros,
 * etc.), se parte de una PLANTILLA ya armada y se copia. Después esa
 * copia se personaliza libremente sin afectar a la plantilla original.
 * ------------------------------------------------------------------
 */
class PerfilRecomendacion {
  constructor({ nombre, generosFavoritos = [], tipoContenidoPreferido = 'mixto', pesoHistorial = 0.5 }) {
    this.nombre = nombre;
    this.generosFavoritos = generosFavoritos;
    this.tipoContenidoPreferido = tipoContenidoPreferido;
    this.pesoHistorial = pesoHistorial; // 0 = ignora historial, 1 = se basa solo en historial
  }

  /**
   * clonar(): devuelve una COPIA INDEPENDIENTE del perfil.
   * Importante: se copia también el arreglo generosFavoritos (no la
   * misma referencia), para que modificar el clon nunca modifique la
   * plantilla original guardada en el registro.
   */
  clonar() {
    console.log(`🧬 [Prototype] Clonando perfil "${this.nombre}"...`);
    return new PerfilRecomendacion({
      nombre: this.nombre,
      generosFavoritos: [...this.generosFavoritos],
      tipoContenidoPreferido: this.tipoContenidoPreferido,
      pesoHistorial: this.pesoHistorial,
    });
  }

  toJSON() {
    return {
      nombre: this.nombre,
      generosFavoritos: this.generosFavoritos,
      tipoContenidoPreferido: this.tipoContenidoPreferido,
      pesoHistorial: this.pesoHistorial,
    };
  }
}

export default PerfilRecomendacion;