import db from '../db/DatabaseSingleton.js';
import RolFlyweightFactory from '../flyweight/RolFlyweightFactory.js';
import { ErrorNegocio } from '../proxy/errores.js';
import { usuarioPublico } from './SuscripcionServicio.js';

/** SUJETO REAL (Proxy) — gestión de cuentas. Interfaz: listar(), cambiarRol(). */
class UsuarioServicio {
  async listar() {
    const r = await db.query('SELECT * FROM usuarios ORDER BY id');
    return r.rows.map(usuarioPublico);
  }

  async cambiarRol(usuarioId, rol) {
    if (!RolFlyweightFactory.esRolValido(rol)) {
      throw new ErrorNegocio(`Rol inválido: "${rol}". Válidos: ${RolFlyweightFactory.ROLES_ASIGNABLES.join(', ')}`);
    }
    const r = await db.query('UPDATE usuarios SET rol = $1 WHERE id = $2 RETURNING *', [rol, usuarioId]);
    if (r.rows.length === 0) throw new ErrorNegocio('Usuario no encontrado.', 404);
    return usuarioPublico(r.rows[0]);
  }
}

export default UsuarioServicio;
