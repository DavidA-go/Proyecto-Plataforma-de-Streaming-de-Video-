import SubscriptionPlan from './SubscriptionPlan.js';

/**
 * FreePlan (Producto concreto)
 * Plan gratuito con anuncios, calidad limitada y sin descargas.
 */
class FreePlan extends SubscriptionPlan {
  getTipo() {
    return 'free';
  }

  getPrecioMensual() {
    return 0;
  }

  getCalidadMaxima() {
    return 'SD (480p)';
  }

  getPantallasSimultaneas() {
    return 1;
  }

  permiteDescargasOffline() {
    return false;
  }
}

export default FreePlan;
