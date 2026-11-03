import ManejadorValidacion from './ManejadorValidacion.js';
import PlanFactory from '../factories/PlanFactory.js';
import db from '../db/DatabaseSingleton.js';

/**
 * ManejadoresRegistro.js
 * ------------------------------------------------------------------
 * CHAIN OF RESPONSIBILITY: manejadores CONCRETOS de la validación del
 * registro (POST /api/register). Cada clase tiene UNA sola regla.
 * Los mensajes y códigos HTTP son los mismos que antes vivían como
 * `if` sueltos dentro de index.js.
 * ------------------------------------------------------------------
 */

/** Regla 1: los datos mínimos deben venir en la solicitud. */
export class CamposObligatoriosHandler extends ManejadorValidacion {
  async validar({ username, email, password }) {
    if (!username || !email || !password) {
      return { message: 'Nombre, correo y contraseña son obligatorios.', status: 400 };
    }
    return null;
  }
}

/** Regla 2: contraseña y confirmación deben coincidir. */
export class PasswordsCoincidenHandler extends ManejadorValidacion {
  async validar({ password, confirmPassword }) {
    if (password !== confirmPassword) {
      return { message: 'Las contraseñas no coinciden.', status: 400 };
    }
    return null;
  }
}

/**
 * Regla 3: el tipo de plan debe existir. Colabora con el Factory Method:
 * si es válido, deja el plan creado en `solicitud.plan` para el endpoint.
 */
export class PlanValidoHandler extends ManejadorValidacion {
  async validar(solicitud) {
    try {
      solicitud.plan = PlanFactory.crearPlan(solicitud.tipoPlan);
      return null;
    } catch (error) {
      return { message: error.message, status: 400 };
    }
  }
}

/**
 * Regla 4: el correo no debe estar registrado. La consulta es INYECTABLE
 * (por defecto usa el Singleton de la BD) para poder probar la cadena
 * sin PostgreSQL.
 */
export class CorreoDisponibleHandler extends ManejadorValidacion {
  constructor(existeCorreo = CorreoDisponibleHandler.consultarEnBD) {
    super();
    this.existeCorreo = existeCorreo;
  }

  static async consultarEnBD(email) {
    const r = await db.query('SELECT * FROM usuarios WHERE correo = $1', [email]);
    return r.rows.length > 0;
  }

  async validar({ email }) {
    if (await this.existeCorreo(email)) {
      return { message: 'El correo ya está registrado.', status: 400 };
    }
    return null;
  }
}
