import StreamManifestBuilder from '../streaming/StreamManifestBuilder.js';
import { crearProtocolo, elegirProtocolo, NOMBRES_VALIDOS } from '../streaming/crearProtocolo.js';
import VODDelivery from '../streaming/VODDelivery.js';
import LiveDelivery from '../streaming/LiveDelivery.js';
import CatalogoService from '../catalog/CatalogoService.js';
import CalidadVideoFactory from '../flyweight/CalidadVideoFactory.js';
import SesionReproduccion from '../streaming/mediator/SesionReproduccion.js';
import RegistroSesiones from '../streaming/mediator/RegistroSesiones.js';
import SelectorCalidad from '../streaming/mediator/SelectorCalidad.js';
import TokenService from '../auth/TokenService.js';
import DRMFacade from '../drm/DRMFacade.js';
import { LicenciaDenegadaError } from '../drm/LicenseDecorators.js';
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

/**
 * ¿El plan NO permite elegir calidad? Es el caso del plan gratuito ("SD (480p)"): recibe una sola
 * versión, la más alta que cabe en su techo, y el selector del reproductor queda bloqueado.
 */
export function planCalidadUnica(textoPlan) {
  return /^\s*SD\b/i.test(String(textoPlan || ''));
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

  /**
   * Bridge (tipo de entrega x protocolo) + Composite (resolver reproducibles) + Factory (protocolo).
   * El protocolo se elige POR TÍTULO según su fuente de video: los reales salen en MP4 y los
   * de demostración en HLS/DASH, aunque se pida "auto" (o "hls") sobre una colección mezclada.
   *
   * @param {string} [usuarioId]      quien reproduce (lo pone el proxy); firma el acceso a los videos reales
   * @param {string} [sesionId]       sesión DRM (licencia) que autorizó esta reproducción; obligatoria para videos reales
   * @param {string} [calidadMaxima]  texto del plan ("SD (480p)"); recorta las calidades de los títulos REALES
   */
  generarEntrega({ contenidoId, tokenDRM, tipoEntrega, protocolo, usuarioId, sesionId, calidadMaxima }) {
    if (!NOMBRES_VALIDOS.includes(protocolo)) {
      throw new ErrorNegocio(`protocolo inválido. Usa ${NOMBRES_VALIDOS.map((n) => `"${n}"`).join(', ')}.`);
    }
    if (tipoEntrega !== 'live' && tipoEntrega !== 'vod') throw new ErrorNegocio('tipoEntrega inválido. Usa "vod" o "live".');

    const contenido = CatalogoService.buscar(contenidoId);
    if (!contenido) throw new ErrorNegocio(`Contenido "${contenidoId}" no encontrado en el catálogo.`, 404);

    const techo = calidadMaxima ? techoDesdePlan(calidadMaxima) : null;

    const reproducibles = contenido.obtenerReproducibles().map((elemento) => {
      const fuente = elemento.getFuente();
      if (tipoEntrega === 'live' && fuente.esReal()) {
        throw new ErrorNegocio(`"${elemento.titulo}" tiene video real y solo se entrega bajo demanda (vod).`);
      }

      const protocoloConcreto = crearProtocolo(elegirProtocolo(protocolo, fuente));
      // El plan solo recorta lo que de verdad existe en disco; los títulos simulados no cambian.
      const opciones = { fuente, techoCalidad: fuente.esReal() ? techo : null, calidadUnica: fuente.esReal() && planCalidadUnica(calidadMaxima) };
      const entrega = tipoEntrega === 'live' ? new LiveDelivery(protocoloConcreto, opciones) : new VODDelivery(protocoloConcreto, opciones);

      const manifest = entrega.generarManifest(elemento.id, tokenDRM);
      return {
        id: elemento.id,
        titulo: elemento.titulo,
        tipo: elemento.tipo(),
        manifest: fuente.esReal() ? this.#firmarAcceso(manifest, usuarioId, sesionId, tokenDRM, elemento) : manifest,
      };
    });

    return {
      message: 'Manifiesto generado con Bridge',
      manifest: reproducibles[0].manifest,
      reproducibles,
      contenido: CatalogoService.resumir(contenido),
    };
  }

  /**
   * Un video real SOLO se entrega si hay una licencia DRM vigente que lo cubra: la sesión que
   * abrió /api/stream/autorizar (Facade) debe seguir viva, ser del mismo usuario y haber
   * autorizado este título (o la colección/serie que lo contiene). Sin eso no hay ticket.
   */
  #exigirLicencia(usuarioId, sesionId, tokenDRM, elemento) {
    if (!sesionId) {
      throw new LicenciaDenegadaError('Para ver este video primero debes autorizar la reproducción (licencia DRM).', 'SIN_LICENCIA');
    }
    const sesion = DRMFacade.sesionVigente(usuarioId, sesionId);
    if (!sesion) {
      throw new LicenciaDenegadaError('Tu sesión de reproducción terminó o venció. Pulsa ▶ para autorizar de nuevo.', 'SESION_EXPIRADA');
    }
    const autorizado = CatalogoService.buscar(sesion.contenidoId);
    const cubre = autorizado?.obtenerReproducibles().some((r) => r.id === elemento.id);
    if (!cubre) {
      throw new LicenciaDenegadaError(`Tu licencia no cubre "${elemento.titulo}".`, 'LICENCIA_OTRO_CONTENIDO');
    }
    if (tokenDRM !== sesion.licenciaId) {
      throw new LicenciaDenegadaError('El identificador de licencia no corresponde a esta sesión.', 'LICENCIA_INVALIDA');
    }
    return sesion;
  }

  /**
   * Agrega a cada URL de un video real un TICKET firmado (usuario + contenido + sesión DRM +
   * vencimiento). El <video> del navegador no puede mandar la cabecera Authorization, así que el
   * permiso viaja en la URL; el MediaProxy lo verifica en cada petición a /media.
   */
  #firmarAcceso(manifest, usuarioId, sesionId, tokenDRM, elemento) {
    if (usuarioId === undefined || usuarioId === null) {
      throw new ErrorNegocio('Se necesita un usuario autenticado para acceder a un video real.', 401);
    }
    const sesion = this.#exigirLicencia(usuarioId, sesionId, tokenDRM, elemento);
    // El acceso al video dura lo que le quede a la LICENCIA (1440 min Premium, 120 min Básica...).
    const minutos = sesion.expiraEn ? Math.max(1, Math.ceil((sesion.expiraEn - Date.now()) / 60000)) : undefined;
    const { ticket, expiraEnMin } = TokenService.emitirTicket(usuarioId, elemento.id, sesionId, { minutos, offline: sesion.permiteOffline });
    return {
      ...manifest,
      calidades: manifest.calidades.map((c) => ({ ...c, url: `${c.url}?ticket=${ticket}` })),
      ticketExpiraEnMin: expiraEnMin,
      permiteDescarga: sesion.permiteOffline, // la licencia incluye descarga offline
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
