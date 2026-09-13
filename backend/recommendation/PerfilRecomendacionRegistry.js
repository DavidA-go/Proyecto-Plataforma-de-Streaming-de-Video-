import PerfilRecomendacion from './PerfilRecomendacion.js';

/**
 * PerfilRecomendacionRegistry.js
 * ------------------------------------------------------------------
 * Registro de PLANTILLAS (prototipos) ya configuradas. Guarda una sola
 * vez cada perfil base y, cada vez que alguien pide una plantilla,
 * entrega un CLON de ella (nunca la instancia original), para que el
 * registro nunca quede "contaminado" con personalizaciones de un
 * usuario en particular.
 * ------------------------------------------------------------------
 */
class PerfilRecomendacionRegistry {
  static plantillas = {
    accionAventura: new PerfilRecomendacion({
      nombre: 'Acción y Aventura',
      generosFavoritos: ['accion', 'aventura', 'thriller'],
      tipoContenidoPreferido: 'pelicula',
      pesoHistorial: 0.6,
    }),
    familiar: new PerfilRecomendacion({
      nombre: 'Familiar',
      generosFavoritos: ['familiar', 'animacion', 'comedia'],
      tipoContenidoPreferido: 'mixto',
      pesoHistorial: 0.3,
    }),
    documental: new PerfilRecomendacion({
      nombre: 'Documentales',
      generosFavoritos: ['documental', 'ciencia', 'historia'],
      tipoContenidoPreferido: 'serie',
      pesoHistorial: 0.8,
    }),
  };

  /**
   * obtenerPlantilla(): este es el uso real del Prototype.
   * En vez de "new PerfilRecomendacion({...})" con todos los valores
   * escritos de nuevo, se clona la plantilla ya armada.
   */
  static obtenerPlantilla(categoria) {
    const plantilla = PerfilRecomendacionRegistry.plantillas[categoria];
    if (!plantilla) {
      throw new Error(
        `Categoría de perfil inválida: "${categoria}". Válidas: ${Object.keys(
          PerfilRecomendacionRegistry.plantillas
        ).join(', ')}`
      );
    }
    console.log(`🧬 PerfilRecomendacionRegistry.obtenerPlantilla("${categoria}") -> clonando prototipo`);
    return plantilla.clonar();
  }
}

export default PerfilRecomendacionRegistry;
