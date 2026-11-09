import StreamManifestBuilder from '../streaming/StreamManifestBuilder.js';
import HLSProtocol from '../streaming/HLSProtocol.js';
import DASHProtocol from '../streaming/DASHProtocol.js';
import VODDelivery from '../streaming/VODDelivery.js';
import LiveDelivery from '../streaming/LiveDelivery.js';
import CatalogoService from '../catalog/CatalogoService.js';
import CalidadVideoFactory from '../flyweight/CalidadVideoFactory.js';
import SesionReproduccion from '../streaming/mediator/SesionReproduccion.js';
import RegistroSesiones from '../streaming/mediator/RegistroSesiones.js';
import SelectorCalidad from '../streaming/mediator/SelectorCalidad.js';
import { ErrorNegocio } from '../proxy/errores.js';

/**
 * Convierte el texto de calidad del plan ("SD (480p)", "Full HD (1080p)", "4K Ultra HD")
 * en la calidad máxima que el reproductor sabe servir (el catálogo llega hasta 1080p).
 */
export function techoDesdePlan(textoPlan) {
  const m = /(\d{3,4})p/.exec(String(textoPlan || ''));
  if (m && SelectorCalidad.ESCALERA.includes(`${m[1]}p`)) return `${m[1]}p`;
  if (/4k/i.test(String(textoPlan))) return SelectorCalidad.ESCALERA.at(-1);
  return SelectorCalidad.ESCALERA[0];
}

const ACCIONES_SESION = ['reproducir', 'pausar', 'buscar', 'red', 'avanzar', 'audio', 'subtitulo'];

/**
 * SUJETO REAL (Proxy) — streaming. Interfaz: generarManifestBasico(), generarEntrega(),
 * crearSesion(), accionSesion(), estadoSesion(), cerrarSesion().
 * Aquí vive la lógica que antes estaba dentro de los endpoints de index.js
 * (Builder + Bridge + Composite + Flyweight) y las sesiones de reproducción (Mediator).
 */
class StreamingServicio {
  /** Builder + Flyweight: las 3 calidades son instancias compartidas. */
  generarManifestBasico({ contenidoId, tokenDRM }) {
    try {
      const builder = new StreamManifestBuilder().setContenido(contenidoId);
      for (const r of ['360p', '720p', '1080p']) {
        builder.agregarCalidadCompartida(CalidadVideoFactory.obtener(r), `https://cdn.ejemplo.com/${contenidoId}/${r}.m3u8`);
      }
      return builder
        .agregarPistaAudio('es', `https://cdn.ejemplo.com/${contenidoId}/audio-es.m3u8`)
        .agregarSubtitulo('es', `https://cdn.ejemplo.com/${contenidoId}/subs-es.vtt`)
        .asignarTokenDRM(tokenDRM || null)
        .build()
        .toJSON();
    } catch (e) {
      throw new ErrorNegocio(e.message);
    }
  }

  /** Bridge (tipo de entrega x protocolo) + Composite (resolver reproducibles). */
  generarEntrega({ contenidoId, tokenDRM, tipoEntrega, protocolo }) {
    let protocoloConcreto;
    if (protocolo === 'dash') protocoloConcreto = new DASHProtocol();
    else if (protocolo === 'hls') protocoloConcreto = new HLSProtocol();
    else throw new ErrorNegocio('protocolo inválido. Usa "hls" o "dash".');

    let entrega;
    if (tipoEntrega === 'live') entrega = new LiveDelivery(protocoloConcreto);
    else if (tipoEntrega === 'vod') entrega = new VODDelivery(protocoloConcreto);
    else throw new ErrorNegocio('tipoEntrega inválido. Usa "vod" o "live".');

    const contenido = CatalogoService.buscar(contenidoId);
    if (!contenido) throw new ErrorNegocio(`Contenido "${contenidoId}" no encontrado en el catálogo.`, 404);

    const reproducibles = contenido.obtenerReproducibles().map((elemento) => ({
      id: elemento.id,
      titulo: elemento.titulo,
      tipo: elemento.tipo(),
      manifest: entrega.generarManifest(elemento.id, tokenDRM),
    }));

    return {
      message: 'Manifiesto generado con Bridge',
      manifest: reproducibles[0].manifest,
      reproducibles,
      contenido: CatalogoService.resumir(contenido),
    };
  }

  // ------------------------------------------------------------------
  // MEDIATOR: sesiones de reproducción adaptativa
  // ------------------------------------------------------------------

  /**
   * Abre una sesión (un SesionReproduccion = mediador con sus 5 colegas).
   * Si `contenidoId` es un grupo (serie, colección) se reproduce su primer
   * reproducible, obtenido con el ITERATOR del catálogo.
   * @param {string} calidadMaxima  texto de calidad del plan del usuario (ej. "Full HD (1080p)")
   */
  crearSesion({ usuarioId, contenidoId, calidadMaxima, anchoBandaKbps }) {
    const nodo = CatalogoService.buscar(contenidoId);
    if (!nodo) throw new ErrorNegocio(`Contenido "${contenidoId}" no encontrado en el catálogo.`, 404);

    const primero = nodo.crearIterador('reproducibles'); // Iterator
    if (!primero.hasNext()) throw new ErrorNegocio(`"${contenidoId}" no tiene contenido reproducible.`);
    const reproducible = primero.next();

    const kbps = anchoBandaKbps === undefined || anchoBandaKbps === null ? 3000 : Number(anchoBandaKbps);
    if (!Number.isFinite(kbps) || kbps <= 0) throw new ErrorNegocio('"anchoBandaKbps" debe ser un número mayor que 0.');

    const sesion = new SesionReproduccion({
      contenido: { id: reproducible.id, titulo: reproducible.titulo, tipo: reproducible.tipo(), duracionMin: reproducible.getDuracion() },
      techoCalidad: techoDesdePlan(calidadMaxima),
      anchoBandaKbps: kbps,
    });
    const sesionId = RegistroSesiones.crear(sesion, usuarioId);
    return { sesionId, estado: sesion.estado(), eventos: sesion.bitacora() };
  }

  #sesionDe(usuarioId, sesionId) {
    const sesion = RegistroSesiones.obtener(sesionId, usuarioId);
    if (!sesion) throw new ErrorNegocio('Sesión de reproducción no encontrada.', 404);
    return sesion;
  }

  /**
   * Una acción del usuario sobre la sesión. Devuelve el estado resultante y
   * los eventos que el mediador procesó EN ESTA acción (se ve la coordinación).
   * Acciones: reproducir | pausar | buscar(seg) | red(kbps) | avanzar(seg) | audio(idioma) | subtitulo(idioma|ninguno)
   */
  accionSesion({ usuarioId, sesionId, accion, valor }) {
    const sesion = this.#sesionDe(usuarioId, sesionId);
    if (!ACCIONES_SESION.includes(accion)) {
      throw new ErrorNegocio(`Acción inválida: "${accion}". Válidas: ${ACCIONES_SESION.join(', ')}.`);
    }
    const desde = sesion.ultimaSecuencia;
    try {
      switch (accion) {
        case 'reproducir': sesion.reproducir(); break;
        case 'pausar': sesion.pausar(); break;
        case 'buscar': sesion.buscar(Number(valor)); break;
        case 'red': sesion.reportarRed(Number(valor)); break;
        case 'avanzar': sesion.avanzar(Number(valor)); break;
        case 'audio': sesion.cambiarAudio(valor); break;
        case 'subtitulo': sesion.cambiarSubtitulo(valor); break;
        default: break;
      }
    } catch (e) {
      throw new ErrorNegocio(e.message);
    }
    return { estado: sesion.estado(), eventos: sesion.bitacora({ desdeN: desde, ultimos: 100 }) };
  }

  estadoSesion({ usuarioId, sesionId }) {
    const sesion = this.#sesionDe(usuarioId, sesionId);
    return { estado: sesion.estado(), eventos: sesion.bitacora({ ultimos: 30 }) };
  }

  cerrarSesion({ usuarioId, sesionId }) {
    this.#sesionDe(usuarioId, sesionId);
    RegistroSesiones.cerrar(sesionId, usuarioId);
    return { cerrada: true };
  }
}

export default StreamingServicio;
