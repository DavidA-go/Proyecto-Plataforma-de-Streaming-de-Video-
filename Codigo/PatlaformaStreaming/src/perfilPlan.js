// El PLAN (suscripción: Free, Básico, Premium, Familiar) y el PERFIL de recomendación (gustos: géneros
// favoritos, tipo de contenido, peso del historial) son cosas distintas. Lo único que los une es esta
// tabla: al entrar por primera vez, el plan SUGIERE la plantilla con la que se clona el perfil inicial
// (Prototype). Después el perfil es del usuario: se edita en el Memento y NO cambia si cambia de plan.
export const NOMBRE_CATEGORIA = {
  accionAventura: 'Acción y Aventura',
  familiar: 'Familiar',
  documental: 'Documentales',
};

export const CATEGORIA_POR_PLAN = {
  free: 'documental',
  basico: 'documental',
  premium: 'accionAventura',
  familiar: 'familiar',
};

export const categoriaSugerida = (planTipo) => CATEGORIA_POR_PLAN[planTipo] || 'accionAventura';
