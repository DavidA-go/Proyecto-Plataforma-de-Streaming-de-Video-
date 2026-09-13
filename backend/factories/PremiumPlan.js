import SubscriptionPlan from './SubscriptionPlan.js';

/**
 * PremiumPlan (Producto concreto)
 * Full HD, 2 pantallas simultáneas, con descargas offline.
 */
class PremiumPlan extends SubscriptionPlan {
  getTipo() {
    return 'premium';
  }

  getPrecioMensual() {
    return 34900;
  }

  getCalidadMaxima() {
    return 'Full HD (1080p)';
  }

  getPantallasSimultaneas() {
    return 2;
  }

  permiteDescargasOffline() {
    return true;
  }
}

export default PremiumPlan;
