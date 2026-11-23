import ProxyProtegido from './ProxyProtegido.js';
import { P } from '../flyweight/Permisos.js';

/** PROXY DE PROTECCIÓN de recomendación (generarPerfil + perfil propio con historial: Memento + recomendaciones: Strategy y Template Method). */
class RecomendacionProxy extends ProxyProtegido {
  constructor(real, actor) {
    super('recomendacion', real, actor);
  }

  generarPerfil(datos) {
    this.exigir('generar perfil de recomendación', P.RECOMENDACION_VER);
    return this.real.generarPerfil(datos);
  }

  // ---- Memento: el perfil propio. Siempre el del actor (no se acepta usuarioId del cliente). ----
  miPerfil() {
    this.exigir('ver mi perfil de recomendación', P.RECOMENDACION_VER);
    return this.real.miPerfil({ usuarioId: this.actor.id });
  }

  guardarMiPerfil(datos) {
    this.exigir('modificar mi perfil de recomendación', P.RECOMENDACION_PERSONALIZAR);
    return this.real.guardarMiPerfil({ ...datos, usuarioId: this.actor.id });
  }

  deshacerMiPerfil() {
    this.exigir('deshacer cambio de mi perfil', P.RECOMENDACION_PERSONALIZAR);
    return this.real.deshacerMiPerfil({ usuarioId: this.actor.id });
  }

  rehacerMiPerfil() {
    this.exigir('rehacer cambio de mi perfil', P.RECOMENDACION_PERSONALIZAR);
    return this.real.rehacerMiPerfil({ usuarioId: this.actor.id });
  }

  restaurarMiPerfil({ version }) {
    this.exigir('restaurar versión de mi perfil', P.RECOMENDACION_PERSONALIZAR);
    return this.real.restaurarMiPerfil({ version, usuarioId: this.actor.id });
  }

  // ---- Strategy + Template Method: recomendaciones del catálogo (siempre para el actor). ----
  opciones() {
    this.exigir('ver opciones de recomendación', P.RECOMENDACION_VER);
    return this.real.opciones();
  }

  recomendar(datos) {
    this.exigir('recomendar títulos', P.RECOMENDACION_VER);
    return this.real.recomendar({ ...datos, usuarioId: this.actor.id });
  }

  miHistorial() {
    this.exigir('ver mi historial de visualización', P.RECOMENDACION_VER);
    return this.real.miHistorial({ usuarioId: this.actor.id });
  }

  registrarVisto({ contenidoId }) {
    this.exigir('registrar título visto', P.RECOMENDACION_PERSONALIZAR);
    return this.real.registrarVisto({ contenidoId, usuarioId: this.actor.id });
  }

  limpiarMiHistorial() {
    this.exigir('borrar mi historial de visualización', P.RECOMENDACION_PERSONALIZAR);
    return this.real.limpiarMiHistorial({ usuarioId: this.actor.id });
  }
}

export default RecomendacionProxy;
