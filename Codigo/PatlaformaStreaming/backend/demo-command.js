/**
 * demo-command.js
 * Demostración del patrón Command (sin base de datos):  npm run demo:command
 */
import { CommandInvoker } from './commands/CommandInvoker.js';
import { CambiarPlanCommand, AgregarAFavoritosCommand, RegistrarProgresoCommand } from './commands/UserCommands.js';

console.log('=== DEMOSTRACIÓN DEL PATRÓN COMMAND ===');
const invoker = new CommandInvoker();

// Receptores simulados (en la app real, el de planes es SuscripcionServicio vía proxy)
const planes = { 7: 'free' };
const suscripcionMock = {
  obtenerPlan: async (id) => ({ id, planTipo: planes[id] }),
  cambiarPlan: async (id, tipo) => { planes[id] = tipo; console.log(`  -> [BD Mock] Usuario ${id} ahora tiene plan "${tipo}"`); return { id, planTipo: tipo }; },
};
const favoritos = new Set();
const usuarioMock = {
  agregarFavorito: async (u, c) => { favoritos.add(c); console.log(`  -> [BD Mock] Favorito guardado: ${c}`); },
  eliminarFavorito: async (u, c) => { favoritos.delete(c); console.log(`  -> [BD Mock] Favorito eliminado: ${c}`); },
};
let segundo = 120;
const historialMock = {
  obtenerProgreso: async () => segundo,
  actualizarProgreso: async (u, c, s) => { segundo = s; console.log(`  -> [BD Mock] Progreso: ${s}s`); },
};

const U = 'usr_101';
console.log('\n1. Ejecutando comandos:');
await invoker.ejecutarComando(new CambiarPlanCommand(suscripcionMock, 7, 'premium'), 7);
await invoker.ejecutarComando(new AgregarAFavoritosCommand(usuarioMock, U, 'pelicula-inception'), U);
await invoker.ejecutarComando(new RegistrarProgresoCommand(historialMock, U, 'pelicula-inception', 1450), U);

console.log('\nHistorial del usuario 7:', invoker.historialDe(7));
console.log(`Historial de ${U}:`, invoker.historialDe(U));

console.log('\n2. Deshaciendo (orden inverso):');
await invoker.deshacerUltimoComando(U); // progreso
await invoker.deshacerUltimoComando(U); // favoritos
await invoker.deshacerUltimoComando(7); // plan
console.log('\n3. Sin nada que deshacer:');
await invoker.deshacerUltimoComando(7);
