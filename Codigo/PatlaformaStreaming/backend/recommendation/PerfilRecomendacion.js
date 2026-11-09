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
 *
 * MEMENTO (ORIGINADOR): el mismo perfil sabe sacarse una "foto" de su
 * estado (crearMemento) y volver a ella (restaurar). Ver recommendation/memento/.
 * ------------------------------------------------------------------
 */
import PerfilMemento from './memento/PerfilMemento.js';

export const TIPOS_CONTENIDO = ['pelicula', 'serie', 'mixto'];
const MAX_GENEROS = 12;

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

  /**
   * Cambia el perfil con validación. Solo se tocan los campos presentes en `cambios`.
   * Valida TODO antes de aplicar: si algo es inválido lanza y el perfil queda intacto.
   * @returns {string[]} nombres de los campos modificados
   */
  actualizar({ generosFavoritos, tipoContenidoPreferido, pesoHistorial } = {}) {
    const nuevo = {};
    if (generosFavoritos !== undefined) {
      if (!Array.isArray(generosFavoritos) || generosFavoritos.some((g) => typeof g !== 'string')) {
        throw new Error('"generosFavoritos" debe ser un arreglo de textos.');
      }
      const limpios = [...new Set(generosFavoritos.map((g) => g.toLowerCase().trim()).filter(Boolean))];
      if (limpios.length === 0) throw new Error('"generosFavoritos" no puede quedar vacío.');
      if (limpios.length > MAX_GENEROS) throw new Error(`Máximo ${MAX_GENEROS} géneros favoritos.`);
      nuevo.generosFavoritos = limpios;
    }
    if (tipoContenidoPreferido !== undefined) {
      if (!TIPOS_CONTENIDO.includes(tipoContenidoPreferido)) {
        throw new Error(`"tipoContenidoPreferido" inválido. Válidos: ${TIPOS_CONTENIDO.join(', ')}.`);
      }
      nuevo.tipoContenidoPreferido = tipoContenidoPreferido;
    }
    if (pesoHistorial !== undefined) {
      if (typeof pesoHistorial !== 'number' || !Number.isFinite(pesoHistorial) || pesoHistorial < 0 || pesoHistorial > 1) {
        throw new Error('"pesoHistorial" debe ser un número entre 0 y 1.');
      }
      nuevo.pesoHistorial = pesoHistorial;
    }
    Object.assign(this, nuevo);
    return Object.keys(nuevo);
  }

  /** MEMENTO: foto inmutable del estado actual (copia profunda). */
  crearMemento(etiqueta = '') {
    return new PerfilMemento(
      {
        nombre: this.nombre,
        generosFavoritos: [...this.generosFavoritos],
        tipoContenidoPreferido: this.tipoContenidoPreferido,
        pesoHistorial: this.pesoHistorial,
      },
      etiqueta
    );
  }
  /** MEMENTO: vuelve al estado de una foto. Copia los datos (no comparte el arreglo con el memento). */
  restaurar(memento) {
    if (!(memento instanceof PerfilMemento)) throw new Error('Solo se puede restaurar desde un PerfilMemento.');
    const e = memento.getEstado();
    this.nombre = e.nombre;
    this.generosFavoritos = [...e.generosFavoritos];
    this.tipoContenidoPreferido = e.tipoContenidoPreferido;
    this.pesoHistorial = e.pesoHistorial;
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