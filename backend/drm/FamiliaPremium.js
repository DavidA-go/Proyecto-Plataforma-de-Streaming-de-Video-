import { TokenValidator, LicenseManager, Watermarker } from './ProductosDRM.js';

/**
 * FamiliaPremium.js
 * ------------------------------------------------------------------
 * Familia CONCRETA de productos DRM para los planes Premium y Familiar.
 * Validación más estricta, licencias más largas y con soporte offline,
 * y marca de agua "forense" (incluye más metadatos por si hay fuga
 * de contenido con descargas offline habilitadas).
 * ------------------------------------------------------------------
 */

export class TokenValidatorPremium extends TokenValidator {
  validarToken(usuario, contenidoId) {
    console.log(`🔑 [Familia Premium] TokenValidatorPremium.validarToken(usuario=${usuario.id}, contenido=${contenidoId})`);
    // Validación estricta: exige plan activo Y rol/estado válido.
    const autorizado = Boolean(usuario?.planTipo) && usuario?.activo !== false;
    return {
      autorizado,
      nivel: 'premium',
      detalle: autorizado
        ? `Token validado con verificación reforzada para el contenido ${contenidoId}.`
        : 'Usuario no autorizado (plan inactivo o inválido).',
    };
  }
}

export class LicenseManagerPremium extends LicenseManager {
  emitirLicencia(usuario, contenidoId) {
    console.log(`📄 [Familia Premium] LicenseManagerPremium.emitirLicencia(usuario=${usuario.id}, contenido=${contenidoId})`);
    // Licencias largas y con permiso de descarga offline.
    return {
      licenciaId: `LIC-PREMIUM-${usuario.id}-${contenidoId}-${Date.now()}`,
      duracionMinutos: 1440, // 24 horas
      permiteOffline: true,
    };
  }
}

export class WatermarkerPremium extends Watermarker {
  aplicarMarcaDeAgua(usuario, contenidoId) {
    console.log(`💧 [Familia Premium] WatermarkerPremium.aplicarMarcaDeAgua(usuario=${usuario.id}, contenido=${contenidoId})`);
    // Marca de agua forense: guarda más datos para poder rastrear
    // filtraciones si el usuario descargó el contenido offline.
    return {
      tipo: 'forense',
      contenido: `Usuario #${usuario.id} · Contenido ${contenidoId} · ${new Date().toISOString()}`,
      rastreoOffline: true,
    };
  }
}