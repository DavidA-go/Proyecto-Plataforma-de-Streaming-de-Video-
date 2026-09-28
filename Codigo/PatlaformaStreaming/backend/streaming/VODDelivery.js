import StreamDelivery from './StreamDelivery.js';

/**
 * VODDelivery.js
 * ------------------------------------------------------------------
 * Refinamiento CONCRETO de la abstracción StreamDelivery para
 * contenido bajo demanda (películas, series): ofrece varias calidades
 * (360p/720p/1080p) para que el reproductor elija según la conexión,
 * igual que hacía el ejemplo original del Builder.
 * ------------------------------------------------------------------
 */
class VODDelivery extends StreamDelivery {
  calidadesDisponibles() {
    return [
      { resolucion: '360p', bitrateKbps: 800 },
      { resolucion: '720p', bitrateKbps: 2500 },
      { resolucion: '1080p', bitrateKbps: 5000 },
    ];
  }

  tipoEntrega() {
    return 'vod';
  }
}

export default VODDelivery;
