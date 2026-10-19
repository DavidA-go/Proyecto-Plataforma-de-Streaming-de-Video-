import RolFlyweight from './RolFlyweight.js';
import { P } from './Permisos.js';

/**
 * RolFlyweightFactory.js
 * ------------------------------------------------------------------
 * FLYWEIGHT FACTORY de roles. Garantiza UNA sola instancia por rol:
 * pedir "admin" mil veces devuelve siempre el mismo objeto.
 *
 * Roles:
 *   invitado -> sin sesión (solo puede ver los planes en el registro)
 *   usuario  -> cliente normal de la plataforma
 *   admin    -> usuario + administración, auditoría y gestión de cuentas
 * ------------------------------------------------------------------
 */
const PERMISOS_INVITADO = [P.PLANES_VER];

const PERMISOS_USUARIO = [
  ...PERMISOS_INVITADO,
  P.PLAN_CAMBIAR_PROPIO,
  P.CATALOGO_VER,
  P.RECOMENDACION_VER,
  P.STREAMING_REPRODUCIR,
  P.STREAMING_MANIFEST_BASICO,
  P.DRM_AUTORIZAR,
  P.DRM_DETENER_PROPIO,
];

const PERMISOS_ADMIN = [
  ...PERMISOS_USUARIO,
  P.PLAN_CAMBIAR_AJENO,
  P.DRM_DETENER_AJENO,
  P.DRM_AUDITORIA,
  P.USUARIOS_LISTAR,
  P.USUARIOS_CAMBIAR_ROL,
  P.SISTEMA_ACCESOS,
  P.SISTEMA_ESTADISTICAS,
];

const DEFINICIONES = {
  invitado: { etiqueta: 'Invitado', permisos: PERMISOS_INVITADO },
  usuario: { etiqueta: 'Usuario', permisos: PERMISOS_USUARIO },
  admin: { etiqueta: 'Administrador', permisos: PERMISOS_ADMIN },
};

class RolFlyweightFactory {
  static ROLES_ASIGNABLES = ['usuario', 'admin'];
  static #pool = new Map();
  static #solicitudes = 0;

  /** Devuelve el flyweight del rol (lo crea la primera vez). Rol desconocido -> invitado. */
  static obtener(nombre) {
    RolFlyweightFactory.#solicitudes++;
    const clave = DEFINICIONES[String(nombre || '').toLowerCase().trim()] ? String(nombre).toLowerCase().trim() : 'invitado';
    let rol = RolFlyweightFactory.#pool.get(clave);
    if (!rol) {
      const { etiqueta, permisos } = DEFINICIONES[clave];
      rol = new RolFlyweight(clave, etiqueta, permisos);
      RolFlyweightFactory.#pool.set(clave, rol);
      console.log(`🪶 [Flyweight] Rol "${clave}" creado (nueva instancia en el pool)`);
    }
    return rol;
  }

  static esRolValido(nombre) {
    return RolFlyweightFactory.ROLES_ASIGNABLES.includes(String(nombre || '').toLowerCase().trim());
  }

  static estadisticas() {
    return {
      instanciasCreadas: RolFlyweightFactory.#pool.size,
      solicitudes: RolFlyweightFactory.#solicitudes,
      reutilizadas: RolFlyweightFactory.#solicitudes - RolFlyweightFactory.#pool.size,
      claves: [...RolFlyweightFactory.#pool.keys()],
    };
  }
}

export default RolFlyweightFactory;
