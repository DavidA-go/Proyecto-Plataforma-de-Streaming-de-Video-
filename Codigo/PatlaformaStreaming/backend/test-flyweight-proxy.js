/**
 * test-flyweight-proxy.js
 * ------------------------------------------------------------------
 * Prueba de extremo a extremo de Flyweight + Proxy SIN PostgreSQL:
 * sustituye el pool de pg por una "BD" en memoria, levanta el servidor
 * real (index.js) y le hace peticiones HTTP como invitado, usuario y admin.
 *
 *     cd backend && npm run test:patrones
 * ------------------------------------------------------------------
 */
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import db from './db/DatabaseSingleton.js';

// ---- BD falsa (solo entiende las consultas que usa el proyecto) ----
const hash = await bcrypt.hash('clave123', 4);
const base = { plan_tipo: 'basico', precio_mensual: 15900, calidad_maxima: 'HD (720p)', pantallas_simultaneas: 1, descargas_offline: false };
const tabla = [
  { id: 1, nombre: 'Ana Admin', correo: 'admin@x.com', password: hash, rol: 'admin', ...base, plan_tipo: 'premium' },
  { id: 2, nombre: 'Uma Usuaria', correo: 'uma@x.com', password: hash, rol: 'usuario', ...base },
  { id: 3, nombre: 'Ulises', correo: 'ulises@x.com', password: hash, rol: 'usuario', ...base },
];
db.pool.query = async (sql, p = []) => {
  const q = sql.replace(/\s+/g, ' ');
  if (q.startsWith('SELECT * FROM usuarios WHERE correo')) return { rows: tabla.filter((u) => u.correo === p[0]) };
  if (q.startsWith('SELECT * FROM usuarios WHERE id')) return { rows: tabla.filter((u) => u.id === Number(p[0])) };
  if (q.startsWith('SELECT * FROM usuarios ORDER')) return { rows: tabla };
  if (q.startsWith('UPDATE usuarios SET rol')) {
    const u = tabla.find((x) => x.id === Number(p[1])); if (u) u.rol = p[0]; return { rows: u ? [u] : [] };
  }
  if (q.startsWith('UPDATE usuarios SET plan_tipo')) {
    const u = tabla.find((x) => x.id === Number(p[5]));
    if (u) Object.assign(u, { plan_tipo: p[0], precio_mensual: p[1], calidad_maxima: p[2], pantallas_simultaneas: p[3], descargas_offline: p[4] });
    return { rows: u ? [u] : [] };
  }
  if (q.startsWith('INSERT INTO usuarios')) {
    const u = { id: tabla.length + 1, nombre: p[0], correo: p[1], password: p[2], rol: 'usuario', plan_tipo: p[3], precio_mensual: p[4], calidad_maxima: p[5], pantallas_simultaneas: p[6], descargas_offline: p[7] };
    tabla.push(u); return { rows: [u] };
  }
  throw new Error(`SQL no soportado por la BD falsa: ${q}`);
};

await import('./index.js');
const URL = 'http://localhost:5000';
const llamar = async (metodo, ruta, { token, body } = {}) => {
  const r = await fetch(URL + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
};
const login = async (email) => (await llamar('POST', '/api/login', { body: { email, password: 'clave123' } })).data;

let ok = 0;
const caso = (nombre, cond) => { assert.ok(cond, nombre); ok++; console.log(`  ✔ ${nombre}`); };

console.log('\n== Login: token + rol ==');
const A = await login('admin@x.com');
const U = await login('uma@x.com');
caso('login devuelve token y rol admin', A.token && A.user.rol === 'admin');
caso('login devuelve token y rol usuario', U.token && U.user.rol === 'usuario');
caso('credenciales malas -> 400', (await llamar('POST', '/api/login', { body: { email: 'uma@x.com', password: 'x' } })).status === 400);

console.log('\n== Proxy: invitado (sin sesión) ==');
caso('invitado ve /api/planes (público)', (await llamar('GET', '/api/planes')).status === 200);
caso('invitado NO ve catálogo -> 401', (await llamar('GET', '/api/catalogo')).status === 401);
caso('token falso -> 401', (await llamar('GET', '/api/catalogo', { token: 'a.b' })).status === 401);

console.log('\n== Proxy: usuario normal ==');
caso('usuario ve catálogo', (await llamar('GET', '/api/catalogo', { token: U.token })).status === 200);
caso('usuario ve catálogo filtrado por perfil', (await llamar('GET', '/api/catalogo?perfil=familiar', { token: U.token })).status === 200);
caso('usuario genera perfil de recomendación', (await llamar('POST', '/api/recomendaciones/perfil', { token: U.token, body: { categoriaBase: 'familiar' } })).status === 200);
const ent = await llamar('POST', '/api/stream/entrega', { token: U.token, body: { contenidoId: 'ambar', tipoEntrega: 'vod', protocolo: 'hls' } });
caso('usuario pide entrega de streaming', ent.status === 200 && ent.data.manifest.calidades.length === 3);
const aut = await llamar('POST', '/api/stream/autorizar', { token: U.token, body: { contenidoId: 'ambar', proveedorExterno: 'auto', dispositivoId: 'D1', pais: 'CO' } });
caso('usuario autoriza DRM (a su nombre)', aut.status === 200 && aut.data.licencia.licenciaId);
caso('usuario NO ve auditoría DRM -> 403', (await llamar('GET', '/api/stream/auditoria', { token: U.token })).status === 403);
caso('usuario NO lista usuarios -> 403', (await llamar('GET', '/api/admin/usuarios', { token: U.token })).status === 403);
caso('usuario NO cambia roles -> 403', (await llamar('PUT', '/api/admin/usuarios/3/rol', { token: U.token, body: { rol: 'admin' } })).status === 403);
caso('usuario NO ve accesos -> 403', (await llamar('GET', '/api/admin/accesos', { token: U.token })).status === 403);
caso('usuario NO ve estadísticas Flyweight -> 403', (await llamar('GET', '/api/admin/flyweight', { token: U.token })).status === 403);
caso('usuario cambia SU plan', (await llamar('PUT', '/api/usuarios/2/plan', { token: U.token, body: { tipoPlan: 'familiar' } })).status === 200);
caso('usuario NO cambia el plan de otro -> 403', (await llamar('PUT', '/api/usuarios/3/plan', { token: U.token, body: { tipoPlan: 'free' } })).status === 403);
caso('usuario NO libera sesiones de otro -> 403', (await llamar('POST', '/api/stream/detener', { token: U.token, body: { usuarioId: 3, sesionId: 'x' } })).status === 403);
caso('usuario libera su propia sesión', (await llamar('POST', '/api/stream/detener', { token: U.token, body: { sesionId: aut.data.licencia.sesionId } })).status === 200);

console.log('\n== Proxy: administrador ==');
caso('admin ve auditoría DRM', (await llamar('GET', '/api/stream/auditoria', { token: A.token })).data.eventos.length >= 1);
caso('admin lista usuarios', (await llamar('GET', '/api/admin/usuarios', { token: A.token })).data.usuarios.length === 3);
caso('admin cambia el plan de otro', (await llamar('PUT', '/api/usuarios/3/plan', { token: A.token, body: { tipoPlan: 'free' } })).status === 200);
caso('admin ve el catálogo (hereda permisos de usuario)', (await llamar('GET', '/api/catalogo', { token: A.token })).status === 200);
caso('admin NO puede cambiarse su propio rol -> 403', (await llamar('PUT', '/api/admin/usuarios/1/rol', { token: A.token, body: { rol: 'usuario' } })).status === 403);
caso('rol inválido -> 400', (await llamar('PUT', '/api/admin/usuarios/3/rol', { token: A.token, body: { rol: 'root' } })).status === 400);
caso('admin asciende a Ulises', (await llamar('PUT', '/api/admin/usuarios/3/rol', { token: A.token, body: { rol: 'admin' } })).data.user.rol === 'admin');
caso('el ascenso aplica al instante (token viejo de Ulises)', (await llamar('GET', '/api/admin/usuarios', { token: (await login('ulises@x.com')).token })).status === 200);

console.log('\n== Registro: el rol no se puede elegir ==');
const reg = await llamar('POST', '/api/register', { body: { username: 'Hacker', email: 'h@x.com', password: 'p', confirmPassword: 'p', tipoPlan: 'free', rol: 'admin' } });
caso('registro crea siempre rol "usuario"', reg.status === 201 && tabla.at(-1).rol === 'usuario');

console.log('\n== Flyweight ==');
// Una serie completa = decenas de manifiestos que reutilizan las mismas 3 calidades.
await llamar('POST', '/api/stream/entrega', { token: U.token, body: { contenidoId: 'horizonte-nocturno', tipoEntrega: 'vod', protocolo: 'dash' } });
const fw = (await llamar('GET', '/api/admin/flyweight', { token: A.token })).data;
caso(`roles: ${fw.roles.solicitudes} solicitudes -> solo ${fw.roles.instanciasCreadas} instancias`, fw.roles.instanciasCreadas <= 3 && fw.roles.solicitudes > 20);
caso(`calidades: ${fw.calidades.solicitudes} solicitudes -> solo ${fw.calidades.instanciasCreadas} instancias`, fw.calidades.instanciasCreadas === 3 && fw.calidades.solicitudes > 3);
const { default: F } = await import('./flyweight/RolFlyweightFactory.js');
caso('pedir "admin" dos veces devuelve el MISMO objeto', F.obtener('admin') === F.obtener('ADMIN '));
caso('rol desconocido cae en "invitado"', F.obtener('root').nombre === 'invitado');
caso('el flyweight es inmutable', Object.isFrozen(F.obtener('usuario')));

console.log('\n== Registro de accesos del Proxy ==');
const acc = (await llamar('GET', '/api/admin/accesos', { token: A.token })).data.eventos;
caso('quedan registradas decisiones PERMITIDO y DENEGADO', acc.some((e) => e.resultado === 'DENEGADO') && acc.some((e) => e.resultado === 'PERMITIDO'));

console.log(`\n🎉 ${ok} comprobaciones OK`);
process.exit(0);
