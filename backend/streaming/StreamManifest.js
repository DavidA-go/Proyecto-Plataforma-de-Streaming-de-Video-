/**
 * StreamManifest.js
 * ------------------------------------------------------------------
 * PRODUCTO del patrón Builder.
 *
 * Representa el "manifiesto" de reproducción que el reproductor de
 * video necesita: qué calidades hay disponibles, qué pistas de audio
 * y subtítulos existen, si el streaming adaptativo está activo, y el
 * token DRM que autoriza la reproducción.
 *
 * Es un objeto con MUCHAS partes opcionales, lo que lo hace un mal
 * candidato para un constructor tradicional (terminaría con 6-8
 * parámetros, muchos de ellos opcionales y difíciles de recordar en
 * qué orden van). Por eso se construye con StreamManifestBuilder.
 * ------------------------------------------------------------------
 */
class StreamManifest {
  constructor() {
    this.contenidoId = null;
    this.calidades = [];       // [{ resolucion, bitrateKbps, url }]
    this.pistasAudio = [];     // [{ idioma, url }]
    this.subtitulos = [];      // [{ idioma, url }]
    this.adaptativo = false;   // ¿el reproductor puede cambiar de calidad solo?
    this.tokenDRM = null;
  }

  toJSON() {
    return {
      contenidoId: this.contenidoId,
      calidades: this.calidades,
      pistasAudio: this.pistasAudio,
      subtitulos: this.subtitulos,
      adaptativo: this.adaptativo,
      tokenDRM: this.tokenDRM,
    };
  }
}

export default StreamManifest;
