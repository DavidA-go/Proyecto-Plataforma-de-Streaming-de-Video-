import StreamDelivery from './StreamDelivery.js';
import CalidadVideoFactory from '../flyweight/CalidadVideoFactory.js'; // Patrón Flyweight

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
    // Flyweight: las calidades son objetos COMPARTIDOS (una sola instancia por resolución).
    return ['360p', '720p', '1080p'].map((r) => CalidadVideoFactory.obtener(r));
  }

  tipoEntrega() {
    return 'vod';
  }
}

export default VODDelivery;
