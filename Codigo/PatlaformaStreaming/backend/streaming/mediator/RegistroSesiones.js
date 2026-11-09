import { randomUUID } from 'node:crypto';

/**
 * RegistroSesiones.js
 * ------------------------------------------------------------------
 * Guarda en MEMORIA las sesiones de reproducción activas (cada una es un
 * Mediator con sus colegas). Una sesión solo es visible para su dueño:
 * pedir la de otro usuario responde igual que si no existiera.
 * Tiene tope: al llenarse descarta la sesión más antigua.
 * ------------------------------------------------------------------
 */
class RegistroSesiones {
  static #sesiones = new Map(); // id -> { usuarioId, sesion }
  static MAXIMO = 500;

  static crear(sesion, usuarioId) {
    if (RegistroSesiones.#sesiones.size >= RegistroSesiones.MAXIMO) {
      RegistroSesiones.#sesiones.delete(RegistroSesiones.#sesiones.keys().next().value);
    }
    const id = randomUUID();
    RegistroSesiones.#sesiones.set(id, { usuarioId: String(usuarioId), sesion });
    return id;
  }

  /** Devuelve la sesión o null (no existe, o es de otro usuario). */
  static obtener(id, usuarioId) {
    const entrada = RegistroSesiones.#sesiones.get(String(id));
    return entrada && entrada.usuarioId === String(usuarioId) ? entrada.sesion : null;
  }

  static cerrar(id, usuarioId) {
    return RegistroSesiones.obtener(id, usuarioId) ? RegistroSesiones.#sesiones.delete(String(id)) : false;
  }

  static total() {
    return RegistroSesiones.#sesiones.size;
  }
}

export default RegistroSesiones;
