import DRMFactoryProvider from './DRMFactoryProvider.js';
import { WidevineLicenseAdapter, PlayReadyLicenseAdapter } from './DRMAdapters.js';
import {
  AuditoriaDecorator,
  LimiteDispositivosDecorator,
  RestriccionGeograficaDecorator,
} from './LicenseDecorators.js';
import SesionesRegistry from './SesionesRegistry.js';
import AuditoriaLog from './AuditoriaLog.js';
import PlanFactory from '../factories/PlanFactory.js';
import CatalogoService from '../catalog/CatalogoService.js';

/**
 * DRMFacade.js
 * ------------------------------------------------------------------
 * FACADE: interfaz única y simple sobre todo el subsistema de DRM.
 *
 * Antes, el endpoint POST /api/stream/autorizar (index.js) tenía que
 * conocer y coordinar, en este orden:
 *   - CatalogoService ............ (Composite)  ¿existe el contenido?
 *   - DRMFactoryProvider + fábrica (Abstract Factory) validador, gestor
 *                                  de licencias y watermarker de la familia
 *   - WidevineLicenseAdapter /
 *     PlayReadyLicenseAdapter .... (Adapter)    proveedor DRM comercial
 *   - PlanFactory ................ (Factory Method) pantallas del plan
 *   - 3 Decorators apilados ...... (Decorator)  región -> límite -> auditoría
 *   - SesionesRegistry / AuditoriaLog           estado en memoria
 *
 * Ahora el cliente (index.js, la demo de consola, o un futuro servicio)
 * solo habla con DRMFacade. Los patrones siguen existiendo igual por
 * debajo: la fachada NO los reemplaza, los OCULTA y los coordina.
 *
 * Importante: la fachada no accede a la base de datos. Recibe el
 * `usuario` ya resuelto ({ id, planTipo, activo }), por eso se puede
 * usar y probar sin PostgreSQL.
 * ------------------------------------------------------------------
 */

/** El contenido pedido no existe en el catálogo (HTTP 404). */
export class ContenidoNoEncontradoError extends Error {
  constructor(contenidoId) {
    super(`Contenido "${contenidoId}" no encontrado en el catálogo.`);
    this.name = 'ContenidoNoEncontradoError';
    this.contenidoId = contenidoId;
  }
}

/** El validador de token rechazó al usuario (HTTP 403). */
export class AccesoDenegadoError extends Error {
  constructor(validacion) {
    super('Acceso denegado.');
    this.name = 'AccesoDenegadoError';
    this.validacion = validacion;
  }
}

class DRMFacade {
  /** Planes que usan Widevine cuando el proveedor se pide en modo 'auto'. */
  static PLANES_WIDEVINE = ['premium', 'familiar'];

  /**
   * Elige el LicenseManager base de la licencia.
   *   'widevine' | 'playready' -> el Adapter correspondiente
   *   'auto'                   -> Widevine si el plan es premium/familiar,
   *                               PlayReady en los demás (esta decisión antes
   *                               vivía en el Dashboard del frontend)
   *   cualquier otro valor     -> el gestor propio de la familia DRM
   */
  static #elegirGestorBase(proveedorExterno, planTipo, gestorDeFamilia) {
    let proveedor = proveedorExterno;
    if (proveedor === 'auto') {
      const tipo = (planTipo || 'free').toLowerCase().trim();
      proveedor = DRMFacade.PLANES_WIDEVINE.includes(tipo) ? 'widevine' : 'playready';
    }

    if (proveedor === 'widevine') return new WidevineLicenseAdapter();
    if (proveedor === 'playready') return new PlayReadyLicenseAdapter();
    return gestorDeFamilia;
  }

  /**
   * Apila los Decorators. La llamada entra por la capa de afuera:
   *   Auditoría -> Límite de dispositivos -> Región -> gestor base
   * El orden importa: la auditoría va afuera para ver también las
   * licencias que deniegan las capas internas.
   */
  static #decorar(gestorBase, plan, dispositivoId, pais) {
    let gestor = new RestriccionGeograficaDecorator(gestorBase, pais || 'CO');
    gestor = new LimiteDispositivosDecorator(gestor, plan, dispositivoId || 'dispositivo-por-defecto');
    return new AuditoriaDecorator(gestor);
  }

  /**
   * Operación principal: autoriza la reproducción de un contenido.
   *
   * @param {object} p
   * @param {{id:number, planTipo:string, activo?:boolean}} p.usuario
   * @param {string} p.contenidoId       id de cualquier nodo del catálogo
   * @param {string} [p.proveedorExterno] 'widevine' | 'playready' | 'auto'
   * @param {string} [p.dispositivoId]
   * @param {string} [p.pais]            código ISO, ej. 'CO'
   * @returns {Promise<{validacion, licencia, marcaDeAgua, contenido}>}
   * @throws {ContenidoNoEncontradoError} contenido inexistente
   * @throws {AccesoDenegadoError}        el validador rechazó al usuario
   * @throws {LicenciaDenegadaError}      región no permitida o límite de pantallas
   */
  static async autorizarReproduccion({ usuario, contenidoId, proveedorExterno, dispositivoId, pais }) {
    console.log(`🏛️  [Facade] DRMFacade.autorizarReproduccion(usuario=${usuario.id}, contenido=${contenidoId})`);

    // Composite: el contenido puede ser película, episodio, serie o colección.
    const contenido = CatalogoService.buscar(contenidoId);
    if (!contenido) throw new ContenidoNoEncontradoError(contenidoId);

    // Abstract Factory: una familia completa y coherente según el plan.
    const drmFactory = DRMFactoryProvider.obtenerFactory(usuario.planTipo);
    const validador = drmFactory.crearValidadorToken();
    const watermarker = drmFactory.crearWatermarker();
    const gestorBase = DRMFacade.#elegirGestorBase(
      proveedorExterno,
      usuario.planTipo,
      drmFactory.crearGestorLicencia()
    );

    // Factory Method: el plan aporta el máximo de pantallas simultáneas.
    const plan = PlanFactory.crearPlan(usuario.planTipo);

    // Decorator: reglas de negocio apiladas sobre el gestor (propio o Adapter).
    const gestor = DRMFacade.#decorar(gestorBase, plan, dispositivoId, pais);

    const validacion = validador.validarToken(usuario, contenidoId);
    if (!validacion.autorizado) throw new AccesoDenegadoError(validacion);

    const licencia = await gestor.emitirLicencia(usuario, contenidoId);
    const marcaDeAgua = watermarker.aplicarMarcaDeAgua(usuario, contenidoId);

    return { validacion, licencia, marcaDeAgua, contenido: CatalogoService.resumir(contenido) };
  }

  /** Libera la pantalla en uso cuando el usuario deja de reproducir. */
  static detener(usuarioId, sesionId) {
    const liberada = SesionesRegistry.liberar(usuarioId, sesionId);
    return { liberada, pantallasEnUso: SesionesRegistry.activas(usuarioId).length };
  }

  /** Últimas licencias EMITIDAS y DENEGADAS (la más reciente primero). */
  static auditoria(cantidad = 50) {
    return AuditoriaLog.ultimos(cantidad);
  }
}

export default DRMFacade;
