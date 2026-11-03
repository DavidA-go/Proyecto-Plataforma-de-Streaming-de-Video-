import db from '../db/DatabaseSingleton.js';
import PlanFactory from '../factories/PlanFactory.js';
import { ErrorNegocio } from '../proxy/errores.js';

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

/** SUJETO REAL (Proxy) — suscripciones. Interfaz: listarPlanes(), obtenerPlan(), cambiarPlan(). */
class SuscripcionServicio {
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

    const updated = await db.query(
      `UPDATE usuarios
         SET plan_tipo = $1, precio_mensual = $2, calidad_maxima = $3,
             pantallas_simultaneas = $4, descargas_offline = $5
       WHERE id = $6
       RETURNING id, nombre, correo, rol, plan_tipo, precio_mensual, calidad_maxima, pantallas_simultaneas, descargas_offline`,
      [plan.getTipo(), plan.getPrecioMensual(), plan.getCalidadMaxima(), plan.getPantallasSimultaneas(), plan.permiteDescargasOffline(), usuarioId]
    );
    if (updated.rows.length === 0) throw new ErrorNegocio('Usuario no encontrado.', 404);
    return usuarioPublico(updated.rows[0]);
  }
}

export default SuscripcionServicio;
