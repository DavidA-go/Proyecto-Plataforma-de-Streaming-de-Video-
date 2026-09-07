import SubscriptionPlan from './SubscriptionPlan.js';

/**
 * BasicoPlan (Producto concreto)
 * Plan de entrada de pago: sin anuncios, calidad HD, 1 pantalla.
 */
class BasicoPlan extends SubscriptionPlan {
  getTipo() {
    return 'basico';
  }

  getPrecioMensual() {
    return 19900; 
  }

  getCalidadMaxima() {
    return 'HD (720p)';
  }

  getPantallasSimultaneas() {
    return 1;
  }

  permiteDescargasOffline() {
    return false;
  }
}

export default BasicoPlan;
