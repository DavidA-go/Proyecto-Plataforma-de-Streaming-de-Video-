/**
 * StreamingProtocol.js
 * ------------------------------------------------------------------
 * IMPLEMENTOR del patrón Bridge.
 *
 * Define el contrato que debe cumplir cualquier protocolo de entrega
 * de video (HLS, DASH, o cualquiera que se agregue después). Las
 * abstracciones (StreamDelivery y sus subclases) usan este contrato
 * sin saber si por debajo hay HLS o DASH: solo conocen estos métodos.
 * ------------------------------------------------------------------
 */
class StreamingProtocol {
  /** Nombre corto del protocolo, ej. "HLS" o "DASH". */
  nombre() {
    throw new Error('nombre() debe ser implementado por la subclase.');
  }

  /** Extensión y mime type del manifiesto propio de este protocolo. */
  infoManifiesto() {
    throw new Error('infoManifiesto() debe ser implementado por la subclase.');
  }

  /**
   * ¿El reproductor puede cambiar de calidad SOLO según la red? HLS y DASH sí (trabajan con
   * segmentos); una descarga progresiva (MP4) no: ahí la calidad la elige la persona.
   */
  esAdaptativo() {
    return true;
  }

  /**
   * Construye la URL de reproducción para una calidad concreta.
   * `fuente` (FuenteMedia) es opcional: HLS y DASH la ignoran (URLs de ejemplo);
   * MP4 la usa para saber qué archivo real corresponde a la resolución.
   */
  // eslint-disable-next-line no-unused-vars
  construirUrl(contenidoId, resolucion, fuente) {
    throw new Error('construirUrl() debe ser implementado por la subclase.');
  }
}

export default StreamingProtocol;
