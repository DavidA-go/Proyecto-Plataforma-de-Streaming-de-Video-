import { BasicoDRMFactory, PremiumDRMFactory } from './DRMFactory.js';

/**
 * DRMFactoryProvider.js
 * ------------------------------------------------------------------
 * Punto único donde se decide QUÉ FAMILIA de fábrica usar, según el
 * plan de suscripción del usuario (reutiliza plan_tipo, el mismo dato
 * que ya produce PlanFactory). El resto del sistema (index.js) solo
 * pide "dame la fábrica DRM que corresponde a este usuario" y nunca
 * hace "new BasicoDRMFactory()" ni "new PremiumDRMFactory()" a mano.
 * ------------------------------------------------------------------
 */
class DRMFactoryProvider {
  static PLANES_PREMIUM = ['premium', 'familiar'];

  static obtenerFactory(planTipo) {
    const tipo = (planTipo || 'free').toLowerCase().trim();
    console.log(`🛡️  DRMFactoryProvider.obtenerFactory("${tipo}") -> seleccionando familia DRM`);

    if (DRMFactoryProvider.PLANES_PREMIUM.includes(tipo)) {
      return new PremiumDRMFactory();
    }
    return new BasicoDRMFactory();
  }
}

export default DRMFactoryProvider;
