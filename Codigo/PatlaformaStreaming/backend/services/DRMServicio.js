import db from '../db/DatabaseSingleton.js';
import DRMFacade from '../drm/DRMFacade.js';
import { ErrorNegocio } from '../proxy/errores.js';

/**
 * SUJETO REAL (Proxy) — DRM. Interfaz: autorizar(), detener(), auditoria().
 * Es el único que habla con DRMFacade; los errores de la fachada
 * (ContenidoNoEncontrado, AccesoDenegado, LicenciaDenegada) suben tal cual.
 */
class DRMServicio {
  async autorizar({ usuarioId, contenidoId, proveedorExterno, dispositivoId, pais }) {
    const result = await db.query('SELECT * FROM usuarios WHERE id = $1', [usuarioId]);
    if (result.rows.length === 0) throw new ErrorNegocio('Usuario no encontrado.', 404);
    const row = result.rows[0];
    const usuario = { id: row.id, planTipo: row.plan_tipo, activo: true };
    return DRMFacade.autorizarReproduccion({ usuario, contenidoId, proveedorExterno, dispositivoId, pais });
  }

  detener({ usuarioId, sesionId }) {
    return DRMFacade.detener(usuarioId, sesionId);
  }

  auditoria(cantidad = 50) {
    return DRMFacade.auditoria(cantidad);
  }
}

export default DRMServicio;
