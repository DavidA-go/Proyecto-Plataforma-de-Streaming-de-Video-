import StreamingProtocol from './StreamingProtocol.js';

/**
 * HLSProtocol.js
 * ------------------------------------------------------------------
 * Implementación CONCRETA del protocolo HLS (HTTP Live Streaming),
 * usado por Apple/Safari y ampliamente soportado por otros
 * reproductores. Cada calidad se expone como un archivo .m3u8
 * independiente.
 * ------------------------------------------------------------------
 */
class HLSProtocol extends StreamingProtocol {
  nombre() {
    return 'HLS';
  }

  infoManifiesto() {
    return { extension: 'm3u8', mimeType: 'application/vnd.apple.mpegurl' };
  }

  construirUrl(contenidoId, resolucion) {
    const url = `https://cdn.ejemplo.com/${contenidoId}/${resolucion}.m3u8`;
    console.log(`🌉 [Bridge:HLS] construirUrl(${contenidoId}, ${resolucion}) -> ${url}`);
    return url;
  }
}

export default HLSProtocol;
