import ProxyProtegido from './ProxyProtegido.js';
import AccesoLog from './AccesoLog.js';
import TokenService from '../auth/TokenService.js';
import DRMFacade from '../drm/DRMFacade.js';
import { NoAutenticadoError, PermisoDenegadoError } from './errores.js';

/**
 * PROXY DE PROTECCIÓN de los archivos de video (misma interfaz que MediaServicio: abrir()).
 *
 * El navegador pide el video con <video src="..."> y NO puede mandar la cabecera
 * Authorization, así que la única llave es un TICKET firmado en la URL (?ticket=...), emitido
 * al generar la entrega y solo si había una licencia DRM vigente. Para dejar pasar la petición:
 *   1. El ticket es auténtico, no venció y es de ESE título.
 *   2. La SESIÓN DRM a la que está ligado sigue vigente. Si el usuario pulsa "Detener", baja de
 *      plan (Observer) o la sesión vence por inactividad, el ticket muere al instante.
 * Cada petición válida cuenta como actividad y renueva la sesión.
 * La descarga (?descargar=1) exige además que la licencia permita uso offline.
 * Una sesión con Authorization pero SIN ticket NO sirve: así nadie se salta la licencia.
 *
 * Un video genera decenas de peticiones "Range" (cada adelantada, cada tramo): solo se registra
 * el PRIMER tramo de cada reproducción (rango que empieza en 0) para no inundar la bitácora;
 * las denegaciones se registran siempre.
 */
class MediaProxy extends ProxyProtegido {
  constructor(real, actor) {
    super('media', real, actor);
  }

  abrir({ contenidoId, archivo, ticket, rango, descarga = false }) {
    const operacion = `${descarga ? 'descargar' : 'abrir'} video ${contenidoId}/${archivo}`;
    const base = { servicio: this.nombreServicio, operacion, permiso: 'media:ticket', usuarioId: this.actor?.id ?? null, rol: this.actor?.rol ?? 'invitado' };
    const denegar = (motivo, usuarioId = base.usuarioId) => {
      AccesoLog.registrar({ ...base, usuarioId, resultado: 'DENEGADO' });
      console.log(`🛡️  [Proxy:media] DENEGADO ${operacion}: ${motivo}`);
      throw new PermisoDenegadoError({ rol: base.rol, permiso: base.permiso, servicio: 'media', operacion, motivo });
    };

    if (!ticket) {
      if (this.actor) denegar('falta el ticket de reproducción (genera uno con ▶).');
      AccesoLog.registrar({ ...base, resultado: 'DENEGADO' });
      throw new NoAutenticadoError();
    }

    const datos = TokenService.verificarTicket(String(ticket), contenidoId);
    if (datos === null) denegar('ticket inválido, vencido o de otro contenido.');

    const { usuarioId, sesionId } = datos;
    // Facade: renueva la sesión si sigue viva; si ya no existe (Detener, cambio de plan, vencida) avisa.
    if (!DRMFacade.latido(usuarioId, sesionId).vigente) denegar(`la sesión DRM ${sesionId} ya no está vigente.`, usuarioId);

    // Descarga offline: solo si la LICENCIA lo permite (Premium sí, Básica no).
    if (descarga && !datos.offline) denegar('tu licencia no incluye descarga offline.', usuarioId);

    if (!rango || /^bytes=0-/.test(rango)) AccesoLog.registrar({ ...base, usuarioId, resultado: 'PERMITIDO' });
    return this.real.abrir({ contenidoId, archivo });
  }
}

export default MediaProxy;
