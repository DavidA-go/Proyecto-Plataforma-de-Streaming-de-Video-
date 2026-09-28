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

  /** Construye la URL de reproducción para una calidad concreta. */
  construirUrl(contenidoId, resolucion) {
    throw new Error('construirUrl() debe ser implementado por la subclase.');
  }
}

export default StreamingProtocol;
