import { Command } from './Command.js';

/** Falla con un error claro si el receptor no tiene el método (en vez de "fingir" que hizo algo). */
const exigirMetodo = (receptor, metodo) => {
  if (!receptor || typeof receptor[metodo] !== 'function') {
    throw new Error(`El receptor no implementa ${metodo}().`);
  }
};

// ------------------------------------------------------------------
// COMANDO INTEGRADO EN LA APP: cambio de plan de suscripción.
// Receptor: SuscripcionProxy/SuscripcionServicio (obtenerPlan, cambiarPlan).
// Lo usan PUT /api/usuarios/:id/plan y POST /api/usuarios/:id/plan/deshacer.
// ------------------------------------------------------------------
export class CambiarPlanCommand extends Command {
  constructor(suscripcion, usuarioId, tipoPlan) {
    super();
    this.suscripcion = suscripcion;
    this.usuarioId = usuarioId;
    this.tipoPlan = tipoPlan;
    this.planAnterior = null;
  }

  get descripcion() {
    return `Cambiar plan del usuario ${this.usuarioId}: ${this.planAnterior ?? '?'} -> ${this.tipoPlan}`;
  }

  async execute() {
    exigirMetodo(this.suscripcion, 'obtenerPlan');
    exigirMetodo(this.suscripcion, 'cambiarPlan');
    // Se guarda el estado previo ANTES de cambiar: es lo que permite el undo.
    this.planAnterior = (await this.suscripcion.obtenerPlan(this.usuarioId)).planTipo;
    const usuario = await this.suscripcion.cambiarPlan(this.usuarioId, this.tipoPlan);
    console.log(`[Command] Plan del usuario ${this.usuarioId}: ${this.planAnterior} -> ${this.tipoPlan}.`);
    return usuario;
  }

  async undo() {
    exigirMetodo(this.suscripcion, 'cambiarPlan');
    if (this.planAnterior === null) throw new Error('El comando aún no se ha ejecutado.');
    const usuario = await this.suscripcion.cambiarPlan(this.usuarioId, this.planAnterior);
    console.log(`[Command Undo] Plan del usuario ${this.usuarioId} restaurado a ${this.planAnterior}.`);
    return usuario;
  }
}

// ------------------------------------------------------------------
// COMANDOS DE DEMOSTRACIÓN (demo-command.js / test-command.js).
// Sus receptores (favoritos e historial de reproducción) todavía no
// existen como servicios del backend.
// ------------------------------------------------------------------

// Agrega contenido a la lista de favoritos del usuario
export class AgregarAFavoritosCommand extends Command {
  constructor(usuarioService, usuarioId, contenidoId) {
    super();
    this.usuarioService = usuarioService;
    this.usuarioId = usuarioId;
    this.contenidoId = contenidoId;
  }

  get descripcion() {
    return `Agregar ${this.contenidoId} a favoritos del usuario ${this.usuarioId}`;
  }

  async execute() {
    exigirMetodo(this.usuarioService, 'agregarFavorito');
    await this.usuarioService.agregarFavorito(this.usuarioId, this.contenidoId);
    console.log(`[Command] Contenido ${this.contenidoId} agregado a favoritos del usuario ${this.usuarioId}.`);
  }

  async undo() {
    exigirMetodo(this.usuarioService, 'eliminarFavorito');
    await this.usuarioService.eliminarFavorito(this.usuarioId, this.contenidoId);
    console.log(`[Command Undo] Contenido ${this.contenidoId} removido de favoritos del usuario ${this.usuarioId}.`);
  }
}

// Registra el progreso de visualización de un video
export class RegistrarProgresoCommand extends Command {
  constructor(historialService, usuarioId, contenidoId, segundoActual) {
    super();
    this.historialService = historialService;
    this.usuarioId = usuarioId;
    this.contenidoId = contenidoId;
    this.segundoActual = segundoActual;
    this.progresoAnterior = null;
  }

  get descripcion() {
    return `Registrar progreso de ${this.contenidoId} en ${this.segundoActual}s (usuario ${this.usuarioId})`;
  }

  async execute() {
    exigirMetodo(this.historialService, 'obtenerProgreso');
    exigirMetodo(this.historialService, 'actualizarProgreso');
    this.progresoAnterior = (await this.historialService.obtenerProgreso(this.usuarioId, this.contenidoId)) ?? 0;
    await this.historialService.actualizarProgreso(this.usuarioId, this.contenidoId, this.segundoActual);
    console.log(`[Command] Progreso de ${this.contenidoId} actualizado a ${this.segundoActual}s.`);
  }

  async undo() {
    exigirMetodo(this.historialService, 'actualizarProgreso');
    await this.historialService.actualizarProgreso(this.usuarioId, this.contenidoId, this.progresoAnterior ?? 0);
    console.log(`[Command Undo] Progreso de ${this.contenidoId} revertido a ${this.progresoAnterior ?? 0}s.`);
  }
}
