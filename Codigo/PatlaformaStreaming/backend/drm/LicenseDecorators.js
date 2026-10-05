import { LicenseManager } from './ProductosDRM.js';
import SesionesRegistry from './SesionesRegistry.js';
import AuditoriaLog from './AuditoriaLog.js';

/**
 * LicenseDecorators.js
 * ------------------------------------------------------------------
 * DECORATOR: añade reglas y comportamiento a CUALQUIER LicenseManager
 * envolviéndolo, sin modificar sus clases.
 *
 * Todos los decorators:
 *  - IMPLEMENTAN la misma interfaz (extienden LicenseManager), así que
 *    el endpoint los usa exactamente igual que a un gestor "normal".
 *  - RECIBEN otro LicenseManager en el constructor (el objeto envuelto):
 *    puede ser LicenseManagerBasico, LicenseManagerPremium, un Adapter
 *    de Widevine/PlayReady... o incluso otro decorator. Por eso se
 *    pueden apilar como capas de cebolla.
 *
 * emitirLicencia() es ASYNC a propósito: los gestores actuales son
 * síncronos, pero un servidor de licencias real (Widevine, PlayReady)
 * responderá por red. Como "await" funciona igual con valores síncronos,
 * los decorators ya están listos para ese cambio.
 * ------------------------------------------------------------------
 */

/** Error de negocio: la licencia fue denegada por una regla (HTTP 403). */
export class LicenciaDenegadaError extends Error {
  constructor(mensaje, codigo) {
    super(mensaje);
    this.name = 'LicenciaDenegadaError';
    this.codigo = codigo; // 'LIMITE_DISPOSITIVOS' | 'REGION_NO_PERMITIDA'
  }
}

/**
 * Decorator BASE: guarda el objeto envuelto y, por defecto, solo delega.
 * Cada decorator concreto sobrescribe emitirLicencia() para hacer algo
 * ANTES y/o DESPUÉS de delegar.
 */
export class LicenseManagerDecorator extends LicenseManager {
  constructor(licenseManager) {
    super();
    if (!(licenseManager instanceof LicenseManager)) {
      throw new Error('El decorator solo puede envolver un LicenseManager.');
    }
    this.envuelto = licenseManager;
  }

  async emitirLicencia(usuario, contenidoId) {
    return this.envuelto.emitirLicencia(usuario, contenidoId);
  }
}

/**
 * Regla ANTES de emitir: bloquea la licencia si el usuario ya usa todas
 * las pantallas que permite su plan (plan.getPantallasSimultaneas(), dato
 * que viene de PlanFactory). Si pasa, DESPUÉS registra la sesión y añade
 * a la licencia cuántas pantallas lleva en uso.
 */
export class LimiteDispositivosDecorator extends LicenseManagerDecorator {
  constructor(licenseManager, plan, dispositivoId) {
    super(licenseManager);
    this.plan = plan;
    this.dispositivoId = dispositivoId;
  }

  async emitirLicencia(usuario, contenidoId) {
    const maximo = this.plan.getPantallasSimultaneas();
    const activas = SesionesRegistry.activas(usuario.id);
    const esMismoDispositivo = activas.some((s) => s.dispositivoId === this.dispositivoId);

    console.log(`🧅 [Decorator:Límite] usuario=${usuario.id} pantallas en uso=${activas.length}/${maximo} dispositivo=${this.dispositivoId}`);

    if (!esMismoDispositivo && activas.length >= maximo) {
      throw new LicenciaDenegadaError(
        `Límite de pantallas alcanzado: tu plan ${this.plan.getTipo()} permite ${maximo} simultánea(s).`,
        'LIMITE_DISPOSITIVOS'
      );
    }

    const licencia = await super.emitirLicencia(usuario, contenidoId);
    const sesion = SesionesRegistry.registrar(usuario.id, this.dispositivoId, contenidoId);

    return {
      ...licencia,
      sesionId: sesion.id,
      pantallasEnUso: SesionesRegistry.activas(usuario.id).length,
      pantallasMaximas: maximo,
    };
  }
}

/**
 * Regla ANTES de emitir: solo se emiten licencias en los países donde
 * hay derechos de distribución (los derechos de un contenido suelen
 * depender del territorio).
 */
export class RestriccionGeograficaDecorator extends LicenseManagerDecorator {
  static PAISES_PERMITIDOS = ['CO', 'MX', 'AR', 'CL', 'PE', 'EC', 'ES', 'US'];

  constructor(licenseManager, pais, paisesPermitidos = RestriccionGeograficaDecorator.PAISES_PERMITIDOS) {
    super(licenseManager);
    this.pais = (pais || '').toUpperCase();
    this.paisesPermitidos = paisesPermitidos;
  }

  async emitirLicencia(usuario, contenidoId) {
    console.log(`🧅 [Decorator:Geo] país=${this.pais || '(no informado)'} permitidos=${this.paisesPermitidos.join(',')}`);

    if (!this.paisesPermitidos.includes(this.pais)) {
      throw new LicenciaDenegadaError(
        `Contenido no disponible en tu región (${this.pais || 'desconocida'}).`,
        'REGION_NO_PERMITIDA'
      );
    }

    const licencia = await super.emitirLicencia(usuario, contenidoId);
    return { ...licencia, region: this.pais };
  }
}

/**
 * Comportamiento DESPUÉS de emitir: deja constancia en la bitácora de cada
 * licencia emitida... y también de las denegadas por las capas internas.
 * Va como capa más externa para poder observar el resultado de todas.
 */
export class AuditoriaDecorator extends LicenseManagerDecorator {
  async emitirLicencia(usuario, contenidoId) {
    try {
      const licencia = await super.emitirLicencia(usuario, contenidoId);
      const registro = AuditoriaLog.registrar({
        resultado: 'EMITIDA',
        usuarioId: usuario.id,
        contenidoId,
        licenciaId: licencia.licenciaId,
      });
      console.log(`🧅 [Decorator:Auditoría] ${registro.id} EMITIDA usuario=${usuario.id} contenido=${contenidoId}`);
      return { ...licencia, auditoriaId: registro.id };
    } catch (error) {
      if (error instanceof LicenciaDenegadaError) {
        const registro = AuditoriaLog.registrar({
          resultado: 'DENEGADA',
          usuarioId: usuario.id,
          contenidoId,
          motivo: error.codigo,
        });
        console.log(`🧅 [Decorator:Auditoría] ${registro.id} DENEGADA (${error.codigo}) usuario=${usuario.id}`);
      }
      throw error; // la auditoría observa, no se traga el error
    }
  }
}
