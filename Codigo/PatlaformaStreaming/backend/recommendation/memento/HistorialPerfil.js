/**
 * HistorialPerfil.js
 * ------------------------------------------------------------------
 * MEMENTO — CUIDADOR (Caretaker). Guarda los mementos de UN perfil en
 * dos pilas y permite deshacer / rehacer / volver a una versión, SIN
 * saber qué hay dentro de cada memento (no toca el estado del perfil;
 * solo se lo devuelve al originador para que se restaure).
 *
 *   pasado: estados anteriores (el último es el más reciente)
 *   futuro: estados deshechos, para poder rehacer
 *
 * Al guardar un cambio nuevo el "futuro" se descarta (igual que un editor
 * de texto). Tiene tope para que la memoria no crezca sin límite.
 * ------------------------------------------------------------------
 */
class HistorialPerfil {
  constructor({ limite = 20 } = {}) {
    this.limite = limite;
    this.pasado = [];
    this.futuro = [];
  }

  /** Guarda la foto del estado ANTES de un cambio. */
  guardar(memento) {
    this.pasado.push(memento);
    if (this.pasado.length > this.limite) this.pasado.shift();
    this.futuro = []; // un cambio nuevo invalida lo que se podía rehacer
  }

  puedeDeshacer() {
    return this.pasado.length > 0;
  }

  puedeRehacer() {
    return this.futuro.length > 0;
  }

  /** Restaura el estado anterior en el originador. Devuelve el memento aplicado o null. */
  deshacer(originador) {
    const anterior = this.pasado.pop();
    if (!anterior) return null;
    this.futuro.push(originador.crearMemento('Antes de deshacer'));
    originador.restaurar(anterior);
    return anterior;
  }

  rehacer(originador) {
    const siguiente = this.futuro.pop();
    if (!siguiente) return null;
    this.pasado.push(originador.crearMemento('Antes de rehacer'));
    originador.restaurar(siguiente);
    return siguiente;
  }

  /**
   * Vuelve a la versión N (1 = la más antigua guardada). El estado actual
   * se guarda primero, así que también se puede volver atrás de esta restauración.
   */
  restaurarVersion(originador, version) {
    const memento = this.pasado[version - 1];
    if (!memento) return null;
    this.pasado.push(originador.crearMemento(`Antes de volver a la versión ${version}`));
    if (this.pasado.length > this.limite) this.pasado.shift();
    this.futuro = [];
    originador.restaurar(memento);
    return memento;
  }

  /** Metadatos de las versiones guardadas (más antigua primero), numeradas desde 1. */
  listar() {
    return this.pasado.map((m, i) => ({ version: i + 1, ...m.resumen() }));
  }
}

export default HistorialPerfil;
