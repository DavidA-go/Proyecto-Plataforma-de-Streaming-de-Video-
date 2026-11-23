/**
 * HistorialVisualizacionStore.js
 * ------------------------------------------------------------------
 * Lo que cada usuario ya vio (ids de títulos), en memoria, igual que PerfilesUsuarioStore.
 * Lo consumen la estrategia por historial y el paso "filtrar" del generador (no recomendar lo ya visto).
 * ------------------------------------------------------------------
 */
const MAX_POR_USUARIO = 200;

class HistorialVisualizacionStore {
  static #porUsuario = new Map(); // usuarioId -> [{ contenidoId, fecha }]

  static registrar(usuarioId, contenidoId) {
    const lista = HistorialVisualizacionStore.#porUsuario.get(String(usuarioId)) ?? [];
    lista.push({ contenidoId, fecha: new Date().toISOString() });
    if (lista.length > MAX_POR_USUARIO) lista.shift();
    HistorialVisualizacionStore.#porUsuario.set(String(usuarioId), lista);
    return lista.length;
  }

  /** Vistas del usuario, de la más antigua a la más reciente (copia). */
  static listar(usuarioId) {
    return [...(HistorialVisualizacionStore.#porUsuario.get(String(usuarioId)) ?? [])];
  }

  static limpiar(usuarioId) {
    HistorialVisualizacionStore.#porUsuario.delete(String(usuarioId));
  }
}

export default HistorialVisualizacionStore;
