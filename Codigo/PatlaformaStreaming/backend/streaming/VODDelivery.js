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
    // Las resoluciones las dicta la FUENTE (3 simuladas, o los archivos reales que existan),
    // recortadas al techo del plan. Flyweight: las calidades son objetos COMPARTIDOS.
    return this.fuente.calidades(this.techoCalidad, this.calidadUnica).map((r) => CalidadVideoFactory.obtener(r));
  }

  tipoEntrega() {
    return 'vod';
  }
}

export default VODDelivery;
