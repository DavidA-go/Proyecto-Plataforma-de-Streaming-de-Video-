import bcrypt from 'bcryptjs';
import db from '../db/DatabaseSingleton.js';
import RolFlyweightFactory from '../flyweight/RolFlyweightFactory.js';
import CadenaRegistro from '../chain/CadenaRegistro.js'; // Chain of Responsibility: las mismas reglas del registro
import { ErrorNegocio } from '../proxy/errores.js';
import { usuarioPublico } from './SuscripcionServicio.js';

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * SUJETO REAL (Proxy) — gestión de cuentas.
 * Interfaz: listar(), cambiarRol(), crear(), editar(), eliminar().
 * El cambio de PLAN no está aquí: sigue siendo PUT /api/usuarios/:id/plan (Command + Observer).
 */
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

  /**
   * Crea una cuenta desde el panel. Pasa por la MISMA cadena de validación que el registro
   * (campos, plan por Factory Method, correo disponible); el admin además puede elegir el rol.
   */
  async crear({ nombre, correo, password, tipoPlan = 'free', rol = 'usuario' } = {}) {
    if (!RolFlyweightFactory.esRolValido(rol)) {
      throw new ErrorNegocio(`Rol inválido: "${rol}". Válidos: ${RolFlyweightFactory.ROLES_ASIGNABLES.join(', ')}`);
    }
    const username = String(nombre ?? '').trim();
    const email = String(correo ?? '').trim().toLowerCase();
    if (email && !CORREO_VALIDO.test(email)) throw new ErrorNegocio('El correo no tiene un formato válido.');

    const { valido, message, status, solicitud } = await CadenaRegistro.validar({
      username, email, password, confirmPassword: password, tipoPlan,
    });
    if (!valido) throw new ErrorNegocio(message, status);

    const plan = solicitud.plan;
    const hash = await bcrypt.hash(password, 10);
    const r = await db.query(
      `INSERT INTO usuarios
        (nombre, correo, password, rol, plan_tipo, precio_mensual, calidad_maxima, pantallas_simultaneas, descargas_offline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [username, email, hash, RolFlyweightFactory.obtener(rol).nombre, plan.getTipo(), plan.getPrecioMensual(), plan.getCalidadMaxima(), plan.getPantallasSimultaneas(), plan.permiteDescargasOffline()]
    );
    return usuarioPublico(r.rows[0]);
  }

  /** Edita nombre, correo y/o contraseña (lo que venga). El plan y el rol tienen sus propios endpoints. */
  async editar(usuarioId, { nombre, correo, password } = {}) {
    const actual = await db.query('SELECT * FROM usuarios WHERE id = $1', [usuarioId]);
    if (actual.rows.length === 0) throw new ErrorNegocio('Usuario no encontrado.', 404);

    const campos = [];
    const valores = [];
    const agregar = (columna, valor) => { valores.push(valor); campos.push(`${columna} = $${valores.length}`); };

    if (nombre !== undefined) {
      const limpio = String(nombre).trim();
      if (!limpio) throw new ErrorNegocio('El nombre no puede estar vacío.');
      agregar('nombre', limpio);
    }
    if (correo !== undefined) {
      const email = String(correo).trim().toLowerCase();
      if (!CORREO_VALIDO.test(email)) throw new ErrorNegocio('El correo no tiene un formato válido.');
      const repetido = await db.query('SELECT * FROM usuarios WHERE LOWER(TRIM(correo)) = $1', [email]);
      if (repetido.rows.some((u) => String(u.id) !== String(usuarioId))) throw new ErrorNegocio('El correo ya está registrado.');
      agregar('correo', email);
    }
    if (password !== undefined && password !== '') {
      if (String(password).length < 6) throw new ErrorNegocio('La contraseña debe tener al menos 6 caracteres.');
      agregar('password', await bcrypt.hash(String(password), 10));
    }
    if (campos.length === 0) throw new ErrorNegocio('No hay nada que actualizar.');

    valores.push(usuarioId);
    const r = await db.query(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = $${valores.length} RETURNING *`, valores);
    return usuarioPublico(r.rows[0]);
  }

  /** Elimina la cuenta. Nunca deja el sistema sin administradores. */
  async eliminar(usuarioId) {
    const actual = await db.query('SELECT * FROM usuarios WHERE id = $1', [usuarioId]);
    if (actual.rows.length === 0) throw new ErrorNegocio('Usuario no encontrado.', 404);

    if (actual.rows[0].rol === 'admin') {
      const todos = await db.query('SELECT * FROM usuarios ORDER BY id');
      if (todos.rows.filter((u) => u.rol === 'admin').length <= 1) {
        throw new ErrorNegocio('No se puede eliminar al único administrador.', 409);
      }
    }

    try {
      const r = await db.query('DELETE FROM usuarios WHERE id = $1 RETURNING *', [usuarioId]);
      return usuarioPublico(r.rows[0]);
    } catch (e) {
      if (e?.code === '23503') throw new ErrorNegocio('No se puede eliminar: la cuenta tiene datos asociados en la base de datos.', 409);
      throw e;
    }
  }
}

export default UsuarioServicio;
  