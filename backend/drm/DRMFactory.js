import { TokenValidatorBasico, LicenseManagerBasico, WatermarkerBasico } from './FamiliaBasica.js';
import { TokenValidatorPremium, LicenseManagerPremium, WatermarkerPremium } from './FamiliaPremium.js';

/**
 * DRMFactory.js
 * ------------------------------------------------------------------
 * ABSTRACT FACTORY: define la interfaz que agrupa los 3 "Factory
 * Methods" (uno por producto) que toda fábrica concreta debe implementar.
 * Esto es lo que la diferencia de un Factory Method simple: aquí no se
 * crea un solo objeto, sino una FAMILIA completa y coherente.
 * ------------------------------------------------------------------
 */
export class DRMFactory {
  crearValidadorToken() {
    throw new Error('crearValidadorToken() debe ser implementado por la subclase.');
  }

  crearGestorLicencia() {
    throw new Error('crearGestorLicencia() debe ser implementado por la subclase.');
  }

  crearWatermarker() {
    throw new Error('crearWatermarker() debe ser implementado por la subclase.');
  }
}

/**
 * Fábrica concreta 1: produce siempre la familia "Básica".
 * Nótese que cada método interno SÍ es, individualmente, un Factory
 * Method (crea un único objeto). Lo que hace a esta clase una Abstract
 * Factory es que agrupa los 3 y garantiza que siempre viajen juntos.
 */
export class BasicoDRMFactory extends DRMFactory {
  crearValidadorToken() {
    return new TokenValidatorBasico();
  }

  crearGestorLicencia() {
    return new LicenseManagerBasico();
  }

  crearWatermarker() {
    return new WatermarkerBasico();
  }
}

/**
 * Fábrica concreta 2: produce siempre la familia "Premium".
 */
export class PremiumDRMFactory extends DRMFactory {
  crearValidadorToken() {
    return new TokenValidatorPremium();
  }

  crearGestorLicencia() {
    return new LicenseManagerPremium();
  }

  crearWatermarker() {
    return new WatermarkerPremium();
  }
}
