import CatalogoService from '../catalog/CatalogoService.js';
import { ErrorNegocio } from '../proxy/errores.js';

/**
 * SUJETO REAL (Proxy) — archivos de video. Interfaz: abrir().
 * Solo sabe resolver "qué archivo del disco corresponde a este contenido"; quién puede
 * pedirlo lo decide el MediaProxy. Solo entrega archivos DECLARADOS por la fuente del título
 * (lista blanca), así que ninguna ruta rara ("..", otro título, otro archivo) llega al disco.
 */
class MediaServicio {
  abrir({ contenidoId, archivo }) {
    const nodo = CatalogoService.buscar(contenidoId);
    const fuente = nodo?.esReproducible() ? nodo.getFuente() : null;
    const rutaAbsoluta = fuente?.esReal() ? fuente.rutaAbsoluta(archivo) : null;
    if (!rutaAbsoluta) throw new ErrorNegocio('Archivo de video no encontrado.', 404);
    return { rutaAbsoluta, mime: 'video/mp4', nombreDescarga: `${nodo.id}-${archivo}` };
  }
}

export default MediaServicio;
