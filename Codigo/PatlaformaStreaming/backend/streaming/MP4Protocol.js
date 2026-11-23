import StreamingProtocol from './StreamingProtocol.js';

/**
 * MP4Protocol.js
 * ------------------------------------------------------------------
 * Nuevo IMPLEMENTOR del Bridge: descarga progresiva de un archivo MP4.
 * Es el protocolo de los títulos con video REAL (backend/media): el
 * navegador pide el archivo con peticiones "Range" y puede adelantar sin
 * bajarlo completo (el MP4 lleva el índice "moov" al inicio).
 *
 * Fíjate en lo que NO hubo que tocar para agregarlo: ni StreamDelivery,
 * ni VODDelivery, ni LiveDelivery, ni HLS/DASH. Ese es el valor del Bridge.
 * ------------------------------------------------------------------
 */
class MP4Protocol extends StreamingProtocol {
  nombre() {
    return 'MP4';
  }

  infoManifiesto() {
    return { extension: 'mp4', mimeType: 'video/mp4' };
  }

  /** Descarga progresiva: no hay cambio automático de calidad (la elige la persona). */
  esAdaptativo() {
    return false;
  }

  /** A diferencia de HLS/DASH, la URL depende de la fuente: ella sabe qué archivo hay para cada resolución. */
  construirUrl(contenidoId, resolucion, fuente) {
    const url = fuente?.urlArchivo(contenidoId, resolucion);
    if (!url) throw new Error(`"${contenidoId}" no tiene un archivo MP4 en ${resolucion}.`);
    console.log(`🌉 [Bridge:MP4] construirUrl(${contenidoId}, ${resolucion}) -> ${url}`);
    return url;
  }
}

export default MP4Protocol;
