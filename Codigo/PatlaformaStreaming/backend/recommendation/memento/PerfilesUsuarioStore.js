import PerfilRecomendacion from '../PerfilRecomendacion.js';
import HistorialPerfil from './HistorialPerfil.js';

/**
 * PerfilesUsuarioStore.js
 * ------------------------------------------------------------------
 * Guarda en MEMORIA el perfil de recomendación activo de cada usuario
 * (el ORIGINADOR) junto con su historial (el CUIDADOR). Cada usuario
 * solo accede al suyo: la clave es el id del usuario autenticado.
 * Como el resto de registros en memoria, se pierde al reiniciar el servidor.
 * ------------------------------------------------------------------
 */
class PerfilesUsuarioStore {
  static #porUsuario = new Map(); // usuarioId -> { perfil, historial }

  static obtener(usuarioId) {
    return PerfilesUsuarioStore.#porUsuario.get(String(usuarioId)) ?? null;
  }

  /** Crea (o reemplaza) el perfil del usuario con un historial vacío. */
  static iniciar(usuarioId, perfil) {
    if (!(perfil instanceof PerfilRecomendacion)) throw new Error('Se esperaba un PerfilRecomendacion.');
    const entrada = { perfil, historial: new HistorialPerfil() };
    PerfilesUsuarioStore.#porUsuario.set(String(usuarioId), entrada);
    return entrada;
  }

  static eliminar(usuarioId) {
    return PerfilesUsuarioStore.#porUsuario.delete(String(usuarioId));
  }
}

export default PerfilesUsuarioStore;
