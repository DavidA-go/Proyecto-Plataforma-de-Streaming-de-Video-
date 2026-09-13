import StreamManifest from './StreamManifest.js';

/**
 * StreamManifestBuilder.js
 * ------------------------------------------------------------------
 * BUILDER: construye un StreamManifest paso a paso mediante una API
 * fluida (cada método devuelve `this`, permitiendo encadenar llamadas).
 *
 * Ventaja frente a un constructor tradicional: el código cliente solo
 * llama a los métodos que realmente necesita (no todos los manifiestos
 * llevan subtítulos, no todos llevan las 3 calidades), y el orden de
 * las llamadas no importa. Al final, build() valida que el objeto
 * quedó en un estado consistente antes de entregarlo.
 * ------------------------------------------------------------------
 */
class StreamManifestBuilder {
  constructor() {
    this.manifest = new StreamManifest();
  }

  setContenido(contenidoId) {
    console.log(`🧱 [Builder] setContenido("${contenidoId}")`);
    this.manifest.contenidoId = contenidoId;
    return this;
  }

  agregarCalidad(resolucion, bitrateKbps, url) {
    console.log(`🧱 [Builder] agregarCalidad("${resolucion}")`);
    this.manifest.calidades.push({ resolucion, bitrateKbps, url });
    return this;
  }

  agregarPistaAudio(idioma, url) {
    console.log(`🧱 [Builder] agregarPistaAudio("${idioma}")`);
    this.manifest.pistasAudio.push({ idioma, url });
    return this;
  }

  agregarSubtitulo(idioma, url) {
    console.log(`🧱 [Builder] agregarSubtitulo("${idioma}")`);
    this.manifest.subtitulos.push({ idioma, url });
    return this;
  }

  habilitarAdaptativo(valor = true) {
    this.manifest.adaptativo = valor;
    return this;
  }

  asignarTokenDRM(token) {
    console.log(`🧱 [Builder] asignarTokenDRM(${token ? 'token presente' : 'sin token'})`);
    this.manifest.tokenDRM = token;
    return this;
  }

  build() {
    // Validación mínima antes de entregar el producto terminado.
    if (!this.manifest.contenidoId) {
      throw new Error('No se puede construir el manifiesto sin contenidoId.');
    }
    if (this.manifest.calidades.length === 0) {
      throw new Error('El manifiesto necesita al menos una calidad de video.');
    }
    // El streaming adaptativo solo tiene sentido si hay 2+ calidades entre las que elegir.
    this.manifest.adaptativo = this.manifest.calidades.length > 1;

    console.log(`✅ [Builder] build() -> manifiesto listo con ${this.manifest.calidades.length} calidad(es), adaptativo=${this.manifest.adaptativo}`);
    return this.manifest;
  }
}

export default StreamManifestBuilder;