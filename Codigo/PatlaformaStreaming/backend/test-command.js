/**
 * test-command.js — pruebas del patrón Command SIN PostgreSQL:  npm run test:command
 */
import assert from 'node:assert/strict';
import { Command } from './commands/Command.js';
import { CommandInvoker } from './commands/CommandInvoker.js';
import { CambiarPlanCommand, AgregarAFavoritosCommand, RegistrarProgresoCommand } from './commands/UserCommands.js';

let ok = 0;
const prueba = async (nombre, fn) => { await fn(); ok++; console.log(`  ✔ ${nombre}`); };
const nuevoReceptor = (inicial = 'free') => {
  const estado = { plan: inicial };
  return {
    estado,
    obtenerPlan: async () => ({ planTipo: estado.plan }),
    cambiarPlan: async (id, t) => { estado.plan = t; return { id, planTipo: t }; },
  };
};

console.log('\n== Command: cambio de plan reversible ==');

await prueba('Command es abstracta', async () => {
  assert.throws(() => new Command(), /abstracta/);
});

await prueba('execute cambia el plan y undo lo restaura', async () => {
  const r = nuevoReceptor('basico');
  const inv = new CommandInvoker();
  const user = await inv.ejecutarComando(new CambiarPlanCommand(r, 1, 'premium'), 1);
  assert.equal(user.planTipo, 'premium');
  const res = await inv.deshacerUltimoComando(1);
  assert.equal(res.deshecho, true);
  assert.equal(r.estado.plan, 'basico');
});

await prueba('undo en orden inverso con varios cambios', async () => {
  const r = nuevoReceptor('free');
  const inv = new CommandInvoker();
  await inv.ejecutarComando(new CambiarPlanCommand(r, 1, 'basico'), 1);
  await inv.ejecutarComando(new CambiarPlanCommand(r, 1, 'premium'), 1);
  await inv.deshacerUltimoComando(1);
  assert.equal(r.estado.plan, 'basico');
  await inv.deshacerUltimoComando(1);
  assert.equal(r.estado.plan, 'free');
});

await prueba('sin historial no hay nada que deshacer', async () => {
  const res = await new CommandInvoker().deshacerUltimoComando(99);
  assert.equal(res.deshecho, false);
});

await prueba('el historial es por usuario', async () => {
  const inv = new CommandInvoker();
  await inv.ejecutarComando(new CambiarPlanCommand(nuevoReceptor(), 1, 'basico'), 1);
  assert.equal(inv.historialDe(1).length, 1);
  assert.equal(inv.historialDe(2).length, 0);
  assert.equal((await inv.deshacerUltimoComando(2)).deshecho, false);
});

await prueba('si execute falla, el comando NO entra al historial', async () => {
  const r = nuevoReceptor();
  r.cambiarPlan = async () => { throw new Error('plan inválido'); };
  const inv = new CommandInvoker();
  await assert.rejects(inv.ejecutarComando(new CambiarPlanCommand(r, 1, 'platino'), 1), /plan inválido/);
  assert.equal(inv.historialDe(1).length, 0);
});

await prueba('si undo falla, el comando se conserva para reintentar', async () => {
  const r = nuevoReceptor('free');
  const inv = new CommandInvoker();
  await inv.ejecutarComando(new CambiarPlanCommand(r, 1, 'premium'), 1);
  const original = r.cambiarPlan;
  r.cambiarPlan = async () => { throw new Error('BD caída'); };
  await assert.rejects(inv.deshacerUltimoComando(1), /BD caída/);
  assert.equal(inv.historialDe(1).length, 1);
  r.cambiarPlan = original;
  assert.equal((await inv.deshacerUltimoComando(1)).deshecho, true);
  assert.equal(r.estado.plan, 'free');
});

await prueba('el historial tiene tope', async () => {
  const inv = new CommandInvoker({ limite: 2 });
  const r = nuevoReceptor();
  for (const t of ['basico', 'premium', 'familiar']) await inv.ejecutarComando(new CambiarPlanCommand(r, 1, t), 1);
  assert.equal(inv.historialDe(1).length, 2);
});

await prueba('receptor sin el método -> error claro (no finge éxito)', async () => {
  await assert.rejects(new AgregarAFavoritosCommand({}, 1, 'x').execute(), /no implementa agregarFavorito/);
});

await prueba('RegistrarProgreso restaura el progreso anterior', async () => {
  let seg = 120;
  const h = { obtenerProgreso: async () => seg, actualizarProgreso: async (u, c, s) => { seg = s; } };
  const inv = new CommandInvoker();
  await inv.ejecutarComando(new RegistrarProgresoCommand(h, 1, 'peli', 1450), 1);
  assert.equal(seg, 1450);
  await inv.deshacerUltimoComando(1);
  assert.equal(seg, 120);
});

console.log(`\n🎉 ${ok} comprobaciones OK`);
