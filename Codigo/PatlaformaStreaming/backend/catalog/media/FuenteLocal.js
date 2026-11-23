import path from 'path';
import FuenteMedia from './FuenteMedia.js';

/**
 * FuenteLocal
 * ------------------------------------------------------------------
 * Video REAL guardado en disco: backend/media/<id>/<archivo>.mp4, un archivo
 * por resolución (p. ej. 360p.mp4 y 720p.mp4). Solo se pueden servir los
 * archivos DECLARADOS aquí (lista blanca): nada de rutas arbitrarias.
 * ------------------------------------------------------------------
 */
class FuenteLocal extends FuenteMedia {
  /**
   * @param {object} p
   * @param {string} p.directorio  carpeta absoluta del contenido (backend/media/<id>)
   * @param {{resolucion:string, archivo:string}[]} p.archivos  renditions que SÍ existen en disco
   * @param {string} p.baseUrl     origen público del backend, ej. http://localhost:5000
   * @param {object} [p.creditos]  { autor, licencia, url }
   */
  constructor({ directorio, archivos, baseUrl, creditos = null }) {
    super();
    if (!Array.isArray(archivos) || archivos.length === 0) {
      throw new Error('FuenteLocal necesita al menos un archivo de video.');
    }
    for (const a of archivos) {
      if (!FuenteMedia.ESCALERA.includes(a.resolucion)) {
        throw new Error(`Resolución inválida "${a.resolucion}". Válidas: ${FuenteMedia.ESCALERA.join(', ')}.`);
      }
      if (!/^[\w.-]+\.mp4$/i.test(a.archivo)) {
        throw new Error(`Nombre de archivo inválido "${a.archivo}" (solo letras, números, "-", "_" y extensión .mp4).`);
      }
    }
    this.directorio = directorio;
    this.archivos = archivos;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this._creditos = creditos;
  }

  esReal() {
    return true;
  }

  protocolosSoportados() {
    return ['mp4'];
  }

  todasLasCalidades() {
    return this.archivos.map((a) => a.resolucion);
  }

  urlArchivo(contenidoId, resolucion) {
    const a = this.archivos.find((x) => x.resolucion === resolucion);
    return a ? `${this.baseUrl}/media/${encodeURIComponent(contenidoId)}/${encodeURIComponent(a.archivo)}` : null;
  }

  /** Ruta absoluta de un archivo DECLARADO (null si no lo está: así no hay path traversal). */
  rutaAbsoluta(archivo) {
    const a = this.archivos.find((x) => x.archivo === archivo);
    return a ? path.join(this.directorio, a.archivo) : null;
  }

  creditos() {
    return this._creditos;
  }
}

export default FuenteLocal;
