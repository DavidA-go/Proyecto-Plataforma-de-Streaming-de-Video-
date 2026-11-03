/**
 * Command.js
 * ------------------------------------------------------------------
 * COMMAND: interfaz / clase base ABSTRACTA de todos los comandos.
 *
 * Un comando es una acción convertida en objeto: lleva dentro el
 * receptor (quien hace el trabajo real) y los datos necesarios.
 *  - execute(): realiza la acción y devuelve su resultado.
 *  - undo():    la revierte (si el comando la soporta).
 *  - descripcion: texto legible para el historial.
 *
 * Ambos métodos son ASYNC porque los receptores reales (servicios con
 * PostgreSQL) son asíncronos.
 * ------------------------------------------------------------------
 */
export class Command {
  constructor() {
    if (new.target === Command) {
      throw new Error('Command es abstracta: usa un comando concreto.');
    }
  }

  get descripcion() {
    return this.constructor.name;
  }

  // eslint-disable-next-line no-unused-vars
  async execute() {
    throw new Error('El método execute() debe ser implementado.');
  }

  async undo() {
    throw new Error('El método undo() no está soportado para este comando.');
  }
}
