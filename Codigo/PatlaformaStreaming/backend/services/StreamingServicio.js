import StreamManifestBuilder from '../streaming/StreamManifestBuilder.js';
import HLSProtocol from '../streaming/HLSProtocol.js';
import DASHProtocol from '../streaming/DASHProtocol.js';
import VODDelivery from '../streaming/VODDelivery.js';
import LiveDelivery from '../streaming/LiveDelivery.js';
import CatalogoService from '../catalog/CatalogoService.js';
import CalidadVideoFactory from '../flyweight/CalidadVideoFactory.js';
import { ErrorNegocio } from '../proxy/errores.js';

/**
 * SUJETO REAL (Proxy) — streaming. Interfaz: generarManifestBasico(), generarEntrega().
 * Aquí vive la lógica que antes estaba dentro de los endpoints de index.js
 * (Builder + Bridge + Composite + Flyweight).
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
}

export default StreamingServicio;
