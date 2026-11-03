/**
 * CommandInvoker.js
 * ------------------------------------------------------------------
 * COMMAND: INVOCADOR. Ejecuta comandos y guarda su historial para poder
 * deshacerlos. No conoce el detalle de ninguna acción: solo llama a
 * execute() / undo().
 *
 * El historial es POR CLAVE (en el proyecto, el id del usuario afectado)
 * y tiene un tope, para que un usuario no vea ni deshaga acciones de otro
 * y la memoria no crezca sin límite.
 * ------------------------------------------------------------------
 */
export class CommandInvoker {
  constructor({ limite = 20 } = {}) {
    this.limite = limite;
    this.historiales = new Map(); // clave -> Command[]
  }

  _pila(clave) {
    const k = String(clave);
    if (!this.historiales.has(k)) this.historiales.set(k, []);
    return this.historiales.get(k);
  }

  /** Ejecuta el comando; solo si NO falla lo guarda en el historial. Devuelve lo que devuelve execute(). */
  async ejecutarComando(comando, clave = 'global') {
    const resultado = await comando.execute();
    const pila = this._pila(clave);
    pila.push(comando);
    if (pila.length > this.limite) pila.shift();
    return resultado;
  }

  /**
   * Deshace el último comando de esa clave. Si undo() falla, el comando
   * SE QUEDA en el historial para poder reintentar.
   * Devuelve { deshecho: boolean, comando?, resultado? }.
   */
  async deshacerUltimoComando(clave = 'global') {
    const pila = this._pila(clave);
    const comando = pila[pila.length - 1];
    if (!comando) {
      console.log('[Invoker] No hay comandos para deshacer.');
      return { deshecho: false };
    }
    const resultado = await comando.undo();
    pila.pop();
    return { deshecho: true, comando: comando.descripcion, resultado };
  }

  /** Descripciones del historial (más antiguo primero). */
  historialDe(clave = 'global') {
    return this._pila(clave).map((c) => c.descripcion);
  }
}

/** Instancia compartida por el backend (un historial por clave dentro de ella). */
export default new CommandInvoker();
