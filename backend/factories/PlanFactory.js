import FreePlan from './FreePlan.js';
import BasicoPlan from './BasicoPlan.js';
import PremiumPlan from './PremiumPlan.js';
import FamiliarPlan from './FamiliarPlan.js';


class PlanFactory {
  static TIPOS_VALIDOS = ['free', 'basico', 'premium', 'familiar'];
  /**
   * Factory Method: crea y devuelve la instancia concreta del plan
   * solicitado. Este es el único punto del sistema donde se hace
   * el "new" de cada tipo de plan.
   */
  static crearPlan(tipo) {
    const tipoNormalizado = (tipo || 'free').toLowerCase().trim();
    console.log(`🏭 PlanFactory.crearPlan("${tipoNormalizado}") -> creando instancia concreta`);

    switch (tipoNormalizado) {
      case 'free':
        return new FreePlan();
      case 'basico':
        return new BasicoPlan();
      case 'premium':
        return new PremiumPlan();
      case 'familiar':
        return new FamiliarPlan();
      default:
        throw new Error(
          `Tipo de plan inválido: "${tipo}". Tipos válidos: ${PlanFactory.TIPOS_VALIDOS.join(', ')}`
        );
    }
  }

  static tiposDisponibles() {
    return PlanFactory.TIPOS_VALIDOS.map((tipo) => PlanFactory.crearPlan(tipo).toJSON());
  }
}

export default PlanFactory;
