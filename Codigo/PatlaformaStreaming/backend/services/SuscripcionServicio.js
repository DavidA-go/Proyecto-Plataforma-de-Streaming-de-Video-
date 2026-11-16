import db from '../db/DatabaseSingleton.js';
import PlanFactory from '../factories/PlanFactory.js';
import { ErrorNegocio } from '../proxy/errores.js';
import SujetoPlan from '../subscription/observer/SujetoPlan.js';

export const usuarioPublico = (row) => ({
  id: row.id,
  nombre: row.nombre,
  correo: row.correo,
  rol: row.rol,
  planTipo: row.plan_tipo,
  precioMensual: row.precio_mensual,
  calidadMaxima: row.calidad_maxima,
  pantallasSimultaneas: row.pantallas_simultaneas,
  descargasOffline: row.descargas_offline,
});

/**
 * SUJETO REAL (Proxy) — suscripciones. Interfaz: listarPlanes(), obtenerPlan(), cambiarPlan(), eventosPlan().
 * Además es el SUJETO del patrón Observer: cuando el plan de un usuario cambia, avisa a quien esté
 * suscrito (DRM, Streaming, notificaciones...) sin conocerlos. Ver subscription/observer/.
 */
class SuscripcionServicio {
  /** @param {SujetoPlan} sujeto  quien reparte los eventos (por defecto, uno vacío; ServiciosProxy le suscribe los observadores) */
  constructor({ sujeto = new SujetoPlan() } = {}) {
    this.sujeto = sujeto;
  }

  listarPlanes() {
    return PlanFactory.tiposDisponibles();
  }

  /** Plan actual del usuario (lo necesita Command para poder deshacer un cambio). */
  async obtenerPlan(usuarioId) {
    const r = await db.query('SELECT * FROM usuarios WHERE id = $1', [usuarioId]);
    if (r.rows.length === 0) throw new ErrorNegocio('Usuario no encontrado.', 404);
    return usuarioPublico(r.rows[0]);
  }

  async cambiarPlan(usuarioId, tipoPlan) {
    let plan;
    try {
      plan = PlanFactory.crearPlan(tipoPlan);
    } catch (e) {
      throw new ErrorNegocio(e.message);
    }

    const antes = await this.obtenerPlan(usuarioId); // plan anterior: el evento lo necesita (404 si no existe)

    const updated = await db.query(
      `UPDATE usuarios
         SET plan_tipo = $1, precio_mensual = $2, calidad_maxima = $3,
             pantallas_simultaneas = $4, descargas_offline = $5
       WHERE id = $6
       RETURNING id, nombre, correo, rol, plan_tipo, precio_mensual, calidad_maxima, pantallas_simultaneas, descargas_offline`,
      [plan.getTipo(), plan.getPrecioMensual(), plan.getCalidadMaxima(), plan.getPantallasSimultaneas(), plan.permiteDescargasOffline(), usuarioId]
    );
    if (updated.rows.length === 0) throw new ErrorNegocio('Usuario no encontrado.', 404);
    const usuario = usuarioPublico(updated.rows[0]);

    // OBSERVER: si el plan realmente cambió, se avisa a los observadores. Esto cubre también el
    // "deshacer" del Command, porque ambos pasan por aquí. Un observador que falle no revierte el cambio.
    if (antes.planTipo !== usuario.planTipo) {
      this.sujeto.notificar({
        tipo: 'PLAN_CAMBIADO',
        usuarioId: usuario.id, // id numérico de la BD (es la llave que usan DRM y Streaming)
        planAnterior: antes.planTipo,
        planNuevo: usuario.planTipo,
        calidadMaxima: usuario.calidadMaxima,
        pantallasMaximas: usuario.pantallasSimultaneas,
      });
    }
    return usuario;
  }

  /** Observer: observadores registrados y últimas notificaciones del usuario (con lo que hizo cada uno). */
  eventosPlan(usuarioId) {
    return { observadores: this.sujeto.nombresObservadores(), eventos: this.sujeto.historialDe(usuarioId, 20) };
  }
}

export default SuscripcionServicio;
