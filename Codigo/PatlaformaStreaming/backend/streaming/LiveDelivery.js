import StreamDelivery from './StreamDelivery.js';
import CalidadVideoFactory from '../flyweight/CalidadVideoFactory.js'; // Patrón Flyweight

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
    // Flyweight: la calidad 720p es EXACTAMENTE la misma instancia que usa VODDelivery.
    return ['480p', '720p'].map((r) => CalidadVideoFactory.obtener(r));
  }

  tipoEntrega() {
    return 'live';
  }
}

export default LiveDelivery;
