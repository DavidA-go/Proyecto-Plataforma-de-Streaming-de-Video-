import StreamDelivery from './StreamDelivery.js';

/**
 * LiveDelivery.js
 * ------------------------------------------------------------------
 * Refinamiento CONCRETO de la abstracción StreamDelivery para
 * transmisiones en vivo: menos calidades disponibles, ya que generar
 * varias resoluciones en tiempo real es más costoso y no siempre
 * tiene sentido ofrecer 1080p en una transmisión en directo.
 * ------------------------------------------------------------------
 */
class LiveDelivery extends StreamDelivery {
  calidadesDisponibles() {
    return [
      { resolucion: '480p', bitrateKbps: 1200 },
      { resolucion: '720p', bitrateKbps: 2500 },
    ];
  }

  tipoEntrega() {
    return 'live';
  }
}

export default LiveDelivery;
