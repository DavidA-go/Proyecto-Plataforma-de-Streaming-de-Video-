import RolFlyweightFactory from '../flyweight/RolFlyweightFactory.js';
import AccesoLog from './AccesoLog.js';
import { PermisoDenegadoError, NoAutenticadoError } from './errores.js';

/**
 * ProxyProtegido.js
 * ------------------------------------------------------------------
 * Base de todos los PROXIES DE PROTECCIÓN. Cada proxy se crea para UN
 * actor (el usuario de la petición) y tiene la misma interfaz que su
 * servicio real; antes de delegar, llama a exigir():
 *
 *   1. Obtiene el ROL del usuario desde el Flyweight (objeto compartido).
 *   2. Comprueba que el rol incluya el permiso de la operación.
 *   3. Registra la decisión en AccesoLog (PERMITIDO o DENEGADO).
 *   4. Si no hay permiso lanza PermisoDenegadoError y el servicio real
 *      NI SIQUIERA se ejecuta.
 *
 * Aquí se ve la colaboración Proxy + Flyweight: el proxy es el cliente
 * del flyweight (usuario = estado extrínseco; rol = estado intrínseco).
 * ------------------------------------------------------------------
 */
class ProxyProtegido {
  constructor(nombreServicio, servicioReal, actor) {
    this.nombreServicio = nombreServicio;
    this.real = servicioReal;
    this.actor = actor || null; // quien hace la petición (null = sin sesión)
  }

  /**
   * @param {string} operacion  nombre legible de la operación
   * @param {string} permiso    permiso requerido (ver flyweight/Permisos.js)
   */
  exigir(operacion, permiso) {
    const usuario = this.actor;
    const rol = RolFlyweightFactory.obtener(usuario?.rol);
    const base = {
      servicio: this.nombreServicio,
      operacion,
      permiso,
      usuarioId: usuario?.id ?? null,
      rol: rol.nombre,
    };

    if (rol.tiene(permiso)) {
      AccesoLog.registrar({ ...base, resultado: 'PERMITIDO' });
      return rol;
    }

    AccesoLog.registrar({ ...base, resultado: 'DENEGADO' });
    console.log(`🛡️  [Proxy:${this.nombreServicio}] DENEGADO ${operacion} a rol "${rol.nombre}" (requiere ${permiso})`);
    if (!usuario) throw new NoAutenticadoError();
    throw new PermisoDenegadoError({ rol: rol.nombre, permiso, servicio: this.nombreServicio, operacion });
  }

  /** Variante para operaciones "propias o ajenas": elige el permiso según el dueño del recurso. */
  exigirPropioOAjeno(operacion, propietarioId, permisoPropio, permisoAjeno) {
    const esPropio = this.actor && String(this.actor.id) === String(propietarioId);
    return this.exigir(operacion, esPropio ? permisoPropio : permisoAjeno);
  }
}

export default ProxyProtegido;
