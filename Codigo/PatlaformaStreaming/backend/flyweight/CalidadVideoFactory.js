import CalidadVideoFlyweight from './CalidadVideoFlyweight.js';

/**
 * CalidadVideoFactory.js
 * ------------------------------------------------------------------
 * FLYWEIGHT FACTORY de calidades de video. Mantiene el pool: si la
 * calidad ya existe la devuelve, si no la crea UNA vez y la guarda.
 * Los clientes (VODDelivery, LiveDelivery, index.js) nunca hacen
 * "new CalidadVideoFlyweight()".
 * ------------------------------------------------------------------
 */
const CATALOGO = {
  '360p': { resolucion: '360p', bitrateKbps: 800, ancho: 640, alto: 360, codec: 'h264' },
  '480p': { resolucion: '480p', bitrateKbps: 1200, ancho: 854, alto: 480, codec: 'h264' },
  '720p': { resolucion: '720p', bitrateKbps: 2500, ancho: 1280, alto: 720, codec: 'h264' },
  '1080p': { resolucion: '1080p', bitrateKbps: 5000, ancho: 1920, alto: 1080, codec: 'h264' },
};

class CalidadVideoFactory {
  static #pool = new Map();
  static #solicitudes = 0;

  static obtener(resolucion) {
    CalidadVideoFactory.#solicitudes++;
    let calidad = CalidadVideoFactory.#pool.get(resolucion);
    if (!calidad) {
      const datos = CATALOGO[resolucion];
      if (!datos) throw new Error(`Calidad desconocida: "${resolucion}". Válidas: ${Object.keys(CATALOGO).join(', ')}`);
      calidad = new CalidadVideoFlyweight(datos);
      CalidadVideoFactory.#pool.set(resolucion, calidad);
      console.log(`🪶 [Flyweight] Calidad "${resolucion}" creada (nueva instancia en el pool)`);
    }
    return calidad;
  }

  static estadisticas() {
    return {
      instanciasCreadas: CalidadVideoFactory.#pool.size,
      solicitudes: CalidadVideoFactory.#solicitudes,
      reutilizadas: CalidadVideoFactory.#solicitudes - CalidadVideoFactory.#pool.size,
      claves: [...CalidadVideoFactory.#pool.keys()],
    };
  }
}

export default CalidadVideoFactory;
