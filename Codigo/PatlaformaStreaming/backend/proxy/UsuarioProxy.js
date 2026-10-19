import ProxyProtegido from './ProxyProtegido.js';
import { P } from '../flyweight/Permisos.js';
import { PermisoDenegadoError } from './errores.js';

/** PROXY DE PROTECCIÓN de cuentas (listar, cambiarRol): solo admin. */
class UsuarioProxy extends ProxyProtegido {
  constructor(real, actor) {
    super('usuarios', real, actor);
  }

  listar() {
    this.exigir('listar usuarios', P.USUARIOS_LISTAR);
    return this.real.listar();
  }

  cambiarRol(usuarioId, rol) {
    this.exigir('cambiar rol', P.USUARIOS_CAMBIAR_ROL);
    // Regla extra del proxy: un admin no puede quitarse a sí mismo el rol
    // (evita dejar el sistema sin administradores).
    if (String(usuarioId) === String(this.actor.id)) {
      throw new PermisoDenegadoError({
        rol: this.actor.rol,
        permiso: P.USUARIOS_CAMBIAR_ROL,
        servicio: this.nombreServicio,
        operacion: 'cambiar rol',
        motivo: 'No puedes cambiar tu propio rol.',
      });
    }
    return this.real.cambiarRol(usuarioId, rol);
  }
}

export default UsuarioProxy;
