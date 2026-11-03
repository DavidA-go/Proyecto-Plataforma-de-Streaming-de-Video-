/**
 * test-chain.js
 * ------------------------------------------------------------------
 * Prueba del patrón Chain of Responsibility SIN PostgreSQL: la consulta
 * de "correo existente" se inyecta como una función en memoria.
 *
 *     cd backend && npm run test:chain
 * ------------------------------------------------------------------
 */
import assert from 'node:assert/strict';
import CadenaRegistro from './chain/CadenaRegistro.js';
import ManejadorValidacion from './chain/ManejadorValidacion.js';

const registrados = new Set(['ya@existe.com']);
const opciones = { existeCorreo: async (correo) => registrados.has(correo) };
const base = { username: 'Ana', email: 'ana@x.com', password: 'clave123', confirmPassword: 'clave123', tipoPlan: 'premium' };
let ok = 0;
const prueba = async (nombre, fn) => { await fn(); ok++; console.log(`  ✔ ${nombre}`); };

console.log('\n== Chain of Responsibility: validación del registro ==');

await prueba('solicitud válida recorre toda la cadena y deja el plan de la fábrica', async () => {
  const r = await CadenaRegistro.validar(base, opciones);
  assert.equal(r.valido, true);
  assert.equal(r.solicitud.plan.getTipo(), 'premium');
});

await prueba('sin tipoPlan, la fábrica asigna "free"', async () => {
  const r = await CadenaRegistro.validar({ ...base, tipoPlan: undefined }, opciones);
  assert.equal(r.valido, true);
  assert.equal(r.solicitud.plan.getTipo(), 'free');
});

await prueba('campos faltantes -> corta en CamposObligatoriosHandler', async () => {
  const r = await CadenaRegistro.validar({ ...base, username: '' }, opciones);
  assert.deepEqual([r.valido, r.regla, r.status], [false, 'CamposObligatoriosHandler', 400]);
});

await prueba('contraseñas distintas -> corta en PasswordsCoincidenHandler', async () => {
  const r = await CadenaRegistro.validar({ ...base, confirmPassword: 'otra' }, opciones);
  assert.deepEqual([r.valido, r.regla, r.message], [false, 'PasswordsCoincidenHandler', 'Las contraseñas no coinciden.']);
});

await prueba('plan inválido -> corta en PlanValidoHandler', async () => {
  const r = await CadenaRegistro.validar({ ...base, tipoPlan: 'platino' }, opciones);
  assert.equal(r.regla, 'PlanValidoHandler');
  assert.match(r.message, /Tipo de plan inválido/);
});

await prueba('correo repetido -> corta en CorreoDisponibleHandler', async () => {
  const r = await CadenaRegistro.validar({ ...base, email: 'ya@existe.com' }, opciones);
  assert.deepEqual([r.valido, r.regla, r.message], [false, 'CorreoDisponibleHandler', 'El correo ya está registrado.']);
});

await prueba('la cadena corta: si falla una regla temprana NO se consulta la BD', async () => {
  let consultas = 0;
  const r = await CadenaRegistro.validar({ ...base, confirmPassword: 'x' }, { existeCorreo: async () => { consultas++; return false; } });
  assert.equal(r.valido, false);
  assert.equal(consultas, 0);
});

await prueba('se puede extender con un eslabón nuevo sin tocar los existentes', async () => {
  class SinCorreoGratisHandler extends ManejadorValidacion {
    async validar({ email }) { return email.endsWith('@spam.com') ? { message: 'Dominio no permitido.' } : null; }
  }
  const cadena = CadenaRegistro.crear(opciones);
  cadena.setSiguiente(new SinCorreoGratisHandler()); // se engancha tras el primero (solo demostración)
  const r = await cadena.manejar({ ...base, email: 'x@spam.com' });
  assert.equal(r.regla, 'SinCorreoGratisHandler');
});

await prueba('ManejadorValidacion es abstracta', async () => {
  assert.throws(() => new ManejadorValidacion(), /abstracta/);
});

console.log(`\n🎉 ${ok} comprobaciones OK`);
