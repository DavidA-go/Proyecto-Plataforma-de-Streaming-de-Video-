/**
 * Permisos.js
 * ------------------------------------------------------------------
 * Catálogo único de permisos del sistema. Formato "servicio:accion".
 * Los proxies exigen estos permisos; los roles (flyweights) los agrupan.
 * ------------------------------------------------------------------
 */
export const P = Object.freeze({
  // Suscripciones
  PLANES_VER: 'suscripcion:ver-planes',
  PLAN_CAMBIAR_PROPIO: 'suscripcion:cambiar-plan-propio',
  PLAN_CAMBIAR_AJENO: 'suscripcion:cambiar-plan-ajeno',
  // Catálogo
  CATALOGO_VER: 'catalogo:ver',
  // Recomendación
  RECOMENDACION_VER: 'recomendacion:ver',
  // Streaming
  STREAMING_REPRODUCIR: 'streaming:reproducir',
  STREAMING_MANIFEST_BASICO: 'streaming:manifest-basico',
  // DRM
  DRM_AUTORIZAR: 'drm:autorizar',
  DRM_DETENER_PROPIO: 'drm:detener-propio',
  DRM_DETENER_AJENO: 'drm:detener-ajeno',
  DRM_AUDITORIA: 'drm:auditoria',
  // Administración
  USUARIOS_LISTAR: 'usuarios:listar',
  USUARIOS_CAMBIAR_ROL: 'usuarios:cambiar-rol',
  SISTEMA_ACCESOS: 'sistema:ver-accesos',
  SISTEMA_ESTADISTICAS: 'sistema:ver-estadisticas',
});
