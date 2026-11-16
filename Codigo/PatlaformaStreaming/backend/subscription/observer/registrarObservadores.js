import SujetoPlan from './SujetoPlan.js';
import ObservadorNotificacion from './ObservadorNotificacion.js';
import ObservadorPlanDRM from '../../drm/ObservadorPlanDRM.js';
import ObservadorPlanStreaming from '../../streaming/ObservadorPlanStreaming.js';

/**
 * Raíz de composición del Observer: crea el sujeto y le suscribe a los
 * interesados. Es el ÚNICO lugar que conoce a la vez la suscripción y los
 * observadores concretos; SuscripcionServicio no los importa.
 * Para que otro subservicio reaccione a los cambios de plan basta con
 * agregar una línea aquí.
 */
export function crearSujetoPlan() {
  const sujeto = new SujetoPlan();
  sujeto.suscribir(new ObservadorPlanDRM());
  sujeto.suscribir(new ObservadorPlanStreaming());
  sujeto.suscribir(new ObservadorNotificacion());
  return sujeto;
}
