import StreamManifestBuilder from './StreamManifestBuilder.js';

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
  constructor(protocolo) {
    if (new.target === StreamDelivery) {
      throw new Error('StreamDelivery es abstracta, usa VODDelivery o LiveDelivery.');
    }
    this.protocolo = protocolo; // el "puente" hacia la implementación concreta
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

    for (const { resolucion, bitrateKbps } of this.calidadesDisponibles()) {
      const url = this.protocolo.construirUrl(contenidoId, resolucion);
      builder.agregarCalidad(resolucion, bitrateKbps, url);
    }

    builder.asignarTokenDRM(tokenDRM || null);

    const manifest = builder.build();
    return {
      ...manifest.toJSON(),
      tipoEntrega: this.tipoEntrega(),
      protocolo: this.protocolo.nombre(),
      formatoManifiesto: this.protocolo.infoManifiesto(),
    };
  }
}

export default StreamDelivery;
