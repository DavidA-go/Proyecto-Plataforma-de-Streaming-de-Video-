import StreamingProtocol from './StreamingProtocol.js';

/**
 * DASHProtocol.js
 * ------------------------------------------------------------------
 * Implementación CONCRETA del protocolo MPEG-DASH, usado por
 * Android/Chrome y reproductores no-Apple. A diferencia de HLS, todas
 * las calidades suelen convivir dentro del mismo manifiesto .mpd
 * como distintos "Representation".
 * ------------------------------------------------------------------
 */
class DASHProtocol extends StreamingProtocol {
  nombre() {
    return 'DASH';
  }

  infoManifiesto() {
    return { extension: 'mpd', mimeType: 'application/dash+xml' };
  }

  construirUrl(contenidoId, resolucion) {
    // Simulamos el manifiesto único de DASH con un query param "rep"
    // (representation) en vez de un archivo por calidad, como en HLS.
    const url = `https://cdn.ejemplo.com/${contenidoId}/manifest.mpd?rep=${resolucion}`;
    console.log(`🌉 [Bridge:DASH] construirUrl(${contenidoId}, ${resolucion}) -> ${url}`);
    return url;
  }
}

export default DASHProtocol;
