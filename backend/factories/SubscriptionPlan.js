/**
 * SubscriptionPlan (Producto abstracto)
 * ------------------------------------
 * Define la interfaz común que deben cumplir todos los planes
 * de suscripción concretos (Free, Básico, Premium, Familiar).
 *
 * Esta clase no debe instanciarse directamente: se usa como
 * "contrato" para que el código cliente (rutas de Express, etc.)
 * pueda trabajar con cualquier plan sin conocer su clase concreta.
 */
class SubscriptionPlan {
  constructor() {
    if (this.constructor === SubscriptionPlan) {
    throw   new Error('SubscriptionPlan es abstracta y no puede instanciarse directamente.');
    }
  }

  getTipo() {
    throw new Error('getTipo() debe ser implementado por la subclase.');
  }

  getPrecioMensual() {
    throw new Error('getPrecioMensual() debe ser implementado por la subclase.');
  }

  getCalidadMaxima() {
    throw new Error('getCalidadMaxima() debe ser implementado por la subclase.');
  }

  getPantallasSimultaneas() {
    throw new Error('getPantallasSimultaneas() debe ser implementado por la subclase.');
  }

  permiteDescargasOffline() {
    throw new Error('permiteDescargasOffline() debe ser implementado por la subclase.');
  }

  // Método de conveniencia: serializa el plan para guardarlo en BD o enviarlo al frontend
  toJSON() {
    return {
      tipo: this.getTipo(),
      precioMensual: this.getPrecioMensual(),
      calidadMaxima: this.getCalidadMaxima(),
      pantallasSimultaneas: this.getPantallasSimultaneas(),
      descargasOffline: this.permiteDescargasOffline(),
    };
  }
}

export default SubscriptionPlan;
