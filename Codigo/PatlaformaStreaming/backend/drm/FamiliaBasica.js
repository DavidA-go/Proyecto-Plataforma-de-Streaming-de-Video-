import { TokenValidator, LicenseManager, Watermarker } from './ProductosDRM.js';

/**
 * FamiliaBasica.js
 * ------------------------------------------------------------------
 * Familia CONCRETA de productos DRM para los planes Free y Básico.
 * Los tres componentes están pensados para ser "livianos": validación
 * simple, licencias de corta duración y marca de agua básica.
 *
 * Importante: estas 3 clases SIEMPRE se usan juntas (nunca se mezcla
 * un TokenValidatorBasico con un LicenseManagerPremium). Esa es
 * justamente la garantía que da el Abstract Factory: consistencia
 * entre los miembros de una misma familia.
 * ------------------------------------------------------------------
 */

export class TokenValidatorBasico extends TokenValidator {
  validarToken(usuario, contenidoId) {
    console.log(`🔑 [Familia Básica] TokenValidatorBasico.validarToken(usuario=${usuario.id}, contenido=${contenidoId})`);
    // Validación simple: solo confirma que el usuario tenga un plan activo.
    const autorizado = Boolean(usuario?.planTipo);
    return {
      autorizado,
      nivel: 'basico',
      detalle: autorizado
        ? `Token válido (nivel básico) para el contenido ${contenidoId}.`
        : 'Usuario sin plan activo.',
    };
  }
}

export class LicenseManagerBasico extends LicenseManager {
  emitirLicencia(usuario, contenidoId) {
    console.log(`📄 [Familia Básica] LicenseManagerBasico.emitirLicencia(usuario=${usuario.id}, contenido=${contenidoId})`);
    // Licencias cortas: 2 horas, sin reproducción offline.
    return {
      licenciaId: `LIC-BASICO-${usuario.id}-${contenidoId}-${Date.now()}`,
      duracionMinutos: 120,
      permiteOffline: false,
    };
  }
}

export class WatermarkerBasico extends Watermarker {
  aplicarMarcaDeAgua(usuario, contenidoId) {
    console.log(`💧 [Familia Básica] WatermarkerBasico.aplicarMarcaDeAgua(usuario=${usuario.id}, contenido=${contenidoId})`);
    // Marca de agua textual simple superpuesta en la esquina del video.
    return {
      tipo: 'texto',
      contenido: `Usuario #${usuario.id} · ${new Date().toISOString()}`,
    };
  }
}