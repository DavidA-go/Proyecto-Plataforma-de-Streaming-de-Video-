import StreamManifestBuilder from './StreamManifestBuilder.js';
import FuenteSimulada from '../catalog/media/FuenteSimulada.js';

/**
 * StreamDelivery.js
 * ------------------------------------------------------------------
 * ABSTRACCIÓN del patrón Bridge.
 *
 * Representa un TIPO de entrega de contenido (bajo demanda, en vivo,
 * etc.) y se apoya en un protocolo (this.protocolo, un
 * StreamingProtocol) para saber CÓMO construir las URLs del
 * manifiesto. Esta clase no sabe si el protocolo es HLS o DASH: ese
 * es justamente el punto del Bridge, separar "qué tipo de entrega es"
 * de "en qué protocolo se sirve", para poder combinar ambos ejes
 * libremente sin necesitar una clase por cada combinación
 * (VodHLS, VodDASH, LiveHLS, LiveDASH...).
 *
 * Internamente reutiliza el Builder ya existente (StreamManifestBuilder)
 * para ensamblar el StreamManifest: el Bridge decide QUÉ calidades y
 * URLs van al manifiesto, y el Builder sigue encargándose de CÓMO se
 * arma el objeto paso a paso. Es decir, aquí Bridge y Builder trabajan
 * juntos.
 * ------------------------------------------------------------------
 */
class StreamDelivery {
  /**
   * @param {StreamingProtocol} protocolo  el "puente" hacia la implementación concreta
   * @param {object} [opciones]
   * @param {FuenteMedia} [opciones.fuente]  origen del video (por defecto, la simulada de siempre)
   * @param {string|null} [opciones.techoCalidad]  calidad máxima que permite el plan (null = sin límite)
   * @param {boolean} [opciones.calidadUnica]  el plan no permite elegir calidad: se ofrece solo una
   */
  constructor(protocolo, { fuente = FuenteSimulada.INSTANCIA, techoCalidad = null, calidadUnica = false } = {}) {
    if (new.target === StreamDelivery) {
      throw new Error('StreamDelivery es abstracta, usa VODDelivery o LiveDelivery.');
    }
    this.protocolo = protocolo;
    this.fuente = fuente;
    this.techoCalidad = techoCalidad;
    this.calidadUnica = calidadUnica;
  }

  /** Debe ser sobrescrito: qué calidades ofrece este tipo de entrega. */
  calidadesDisponibles() {
    throw new Error('calidadesDisponibles() debe ser implementado por la subclase.');
  }

  /** Debe ser sobrescrito: identifica el tipo de entrega en el manifiesto. */
  tipoEntrega() {
    throw new Error('tipoEntrega() debe ser implementado por la subclase.');
  }

  /**
   * generarManifest(): usa el protocolo (this.protocolo) para construir
   * la URL de cada calidad, y delega el ensamblado final al Builder.
   */
  generarManifest(contenidoId, tokenDRM) {
    console.log(`🌉 [Bridge] ${this.constructor.name} generando manifiesto con protocolo ${this.protocolo.nombre()}`);

    const builder = new StreamManifestBuilder().setContenido(contenidoId);

    // Flyweight: cada calidad es un objeto compartido; solo la URL es propia de este contenido.
    for (const calidad of this.calidadesDisponibles()) {
      const url = this.protocolo.construirUrl(contenidoId, calidad.resolucion, this.fuente);
      builder.agregarCalidadCompartida(calidad, url);
    }

    builder.asignarTokenDRM(tokenDRM || null);

    const manifest = builder.build();
    return {
      ...manifest.toJSON(),
      tipoEntrega: this.tipoEntrega(),
      protocolo: this.protocolo.nombre(),
      formatoManifiesto: this.protocolo.infoManifiesto(),
      // El Builder marca "adaptativo" si hay 2+ calidades; además el PROTOCOLO tiene que poder adaptarse solo.
      adaptativo: manifest.adaptativo && this.protocolo.esAdaptativo(),
      reproduccionReal: this.fuente.esReal(),
      ...(this.fuente.esReal() ? { creditos: this.fuente.creditos() } : {}),
    };
  }
}

export default StreamDelivery;
