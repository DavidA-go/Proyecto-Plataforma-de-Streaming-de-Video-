import SubscriptionPlan from './SubscriptionPlan.js';

/**
 * FamiliarPlan (Producto concreto)
 * 4K, hasta 4 pantallas simultáneas, con descargas offline.
 */
class FamiliarPlan extends SubscriptionPlan {
  getTipo() {
    return 'familiar';
  }

  getPrecioMensual() {
    return 49900;
  }

  getCalidadMaxima() {
    return '4K Ultra HD';
  }

  getPantallasSimultaneas() {
    return 4;
  }

  permiteDescargasOffline() {
    return true;
  }
}

export default FamiliarPlan;
