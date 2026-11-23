/**
 * test-strategy-template.js
 * ------------------------------------------------------------------
 * Pruebas de los patrones Strategy y Template Method (subservicio de Recomendación).
 * NO necesita PostgreSQL: las de extremo a extremo reemplazan el pool de pg por una BD en memoria.
 *
 *     cd backend && npm run test:strategy-template
 *     (o por patrón: npm run test:strategy · npm run test:template)
 * ------------------------------------------------------------------
 */
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import db from './db/DatabaseSingleton.js';
import CatalogoService from './catalog/CatalogoService.js';
import PerfilRecomendacion from './recommendation/PerfilRecomendacion.js';
import HistorialVisualizacionStore from './recommendation/HistorialVisualizacionStore.js';
import EstrategiaPuntuacion from './recommendation/strategy/EstrategiaPuntuacion.js';
import PuntuacionPorGeneros from './recommendation/strategy/PuntuacionPorGeneros.js';
import PuntuacionPorHistorial from './recommendation/strategy/PuntuacionPorHistorial.js';
import PuntuacionHibrida from './recommendation/strategy/PuntuacionHibrida.js';
import { crearEstrategia } from './recommendation/strategy/crearEstrategia.js';
import GeneradorRecomendaciones from './recommendation/template/GeneradorRecomendaciones.js';
import RecomendacionParaTi from './recommendation/template/RecomendacionParaTi.js';
import RecomendacionSimilares from './recommendation/template/RecomendacionSimilares.js';
import RecomendacionDescubrir from './recommendation/template/RecomendacionDescubrir.js';
import { crearGenerador } from './recommendation/template/crearGenerador.js';

// Filtro opcional: `node test-strategy-template.js strategy|template`.
const filtro = process.argv[2]?.toLowerCase();
if (filtro) {
  const log = console.log.bind(console);
  let activa = false;
  console.log = (...args) => {
    const msg = args.join(' ');
    if (msg.startsWith('\n== ')) { activa = msg.slice(4).toLowerCase().startsWith(filtro); if (activa) log(msg); return; }
    if (activa && msg.trimStart().startsWith('✔')) log(msg);
    else if (msg.startsWith('\n🎉')) log(`\n(filtrado por "${filtro}": ver arriba)`);
  };
}

let ok = 0;
const caso = (nombre, fn) => { fn(); ok++; console.log(`  ✔ ${nombre}`); };
const casoAsync = async (nombre, fn) => { await fn(); ok++; console.log(`  ✔ ${nombre}`); };
const silencio = (fn) => { const l = console.log; console.log = () => {}; try { return fn(); } finally { console.log = l; } };

const raiz = CatalogoService.raiz;
const perfil = (o = {}) => new PerfilRecomendacion({ nombre: 'Prueba', generosFavoritos: ['accion', 'thriller'], tipoContenidoPreferido: 'mixto', pesoHistorial: 0.5, ...o });
const contexto = (o = {}) => ({ perfil: perfil(), historial: [], estrategia: crearEstrategia('generos'), limite: 50, raiz, ...o });
const ids = (r) => r.recomendaciones.map((x) => x.id);

// ====================================================================
console.log('\n== Strategy (algoritmos de puntuación intercambiables) ==');
// ====================================================================
const pelicula = raiz.buscar('el-ultimo-vuelo'); // accion, thriller
const ctxBase = (o) => { const g = new RecomendacionParaTi(); const c = contexto(o); silencio(() => g.prepararContexto(c)); return c; };

caso('EstrategiaPuntuacion es abstracta y exige id(), descripcion() y puntuar()', () => {
  assert.throws(() => new EstrategiaPuntuacion(), /abstracta/);
  class Incompleta extends EstrategiaPuntuacion {}
  const e = new Incompleta();
  assert.throws(() => e.id(), /implementado/);
  assert.throws(() => e.puntuar(pelicula, {}), /implementado/);
});

caso('PorGeneros: fracción de géneros del título que coinciden con el interés', () => {
  const e = new PuntuacionPorGeneros();
  assert.equal(e.puntuar(pelicula, ctxBase()), 1); // accion+thriller ⊂ favoritos
  assert.equal(e.puntuar(raiz.buscar('ciudad-de-vidrio'), ctxBase()), 0.5); // thriller sí, drama no
  assert.equal(e.puntuar(raiz.buscar('raices-de-cobre'), ctxBase()), 0);
});

caso('PorHistorial: sin historial puntúa 0; con historial prefiere los géneros más vistos', () => {
  const e = new PuntuacionPorHistorial();
  assert.equal(e.puntuar(pelicula, ctxBase()), 0);
  const c = ctxBase({ historial: ['raices-de-cobre', 'selva-digital', 'raices-de-cobre'] }); // documental x3, historia x2, ciencia x1
  assert.equal(c.afinidad.get('documental'), 1);
  assert.ok(e.puntuar(raiz.buscar('raices-de-cobre'), c) > e.puntuar(raiz.buscar('selva-digital'), c)); // historia > ciencia
  assert.equal(e.puntuar(pelicula, c), 0);
});

caso('Hibrida: peso 0 = solo géneros · peso 1 = solo historial · intermedio = mezcla', () => {
  const h = new PuntuacionHibrida();
  const hist = ['ciudad-de-vidrio', 'ambar']; // drama x2, thriller 1, aventura 1
  const nodo = raiz.buscar('ciudad-de-vidrio'); // thriller, drama
  const g = new PuntuacionPorGeneros().puntuar(nodo, ctxBase({ historial: hist }));
  const hi = new PuntuacionPorHistorial().puntuar(nodo, ctxBase({ historial: hist }));
  assert.equal(h.puntuar(nodo, ctxBase({ historial: hist, perfil: perfil({ pesoHistorial: 0 }) })), g);
  assert.equal(h.puntuar(nodo, ctxBase({ historial: hist, perfil: perfil({ pesoHistorial: 1 }) })), hi);
  const mezcla = h.puntuar(nodo, ctxBase({ historial: hist, perfil: perfil({ pesoHistorial: 0.5 }) }));
  assert.ok(Math.abs(mezcla - (0.5 * g + 0.5 * hi)) < 1e-9);
});

caso('Hibrida: sin historial ignora el peso (no se fía de un historial vacío)', () => {
  const h = new PuntuacionHibrida();
  const c = ctxBase({ perfil: perfil({ pesoHistorial: 1 }) });
  assert.equal(h.pesoEfectivo(c), 0);
  assert.equal(h.puntuar(pelicula, c), 1);
});

caso('Hibrida se compone con otras estrategias por constructor (mismo contrato)', () => {
  const fija = new (class extends EstrategiaPuntuacion { id() { return 'fija'; } descripcion() { return 'x'; } puntuar() { return 0.2; } })();
  const h = new PuntuacionHibrida(fija, fija);
  assert.ok(Math.abs(h.puntuar(pelicula, ctxBase({ historial: ['ambar'] })) - 0.2) < 1e-9);
});

caso('crearEstrategia: por id, por defecto "hibrida" y error con id inválido', () => {
  assert.ok(crearEstrategia('generos') instanceof PuntuacionPorGeneros);
  assert.ok(crearEstrategia('HISTORIAL ') instanceof PuntuacionPorHistorial);
  assert.ok(crearEstrategia() instanceof PuntuacionHibrida);
  assert.throws(() => crearEstrategia('azar'), /Estrategia inválida/);
});

caso('Cambiar de estrategia cambia el resultado SIN tocar el generador (misma plantilla)', () => {
  const g = new RecomendacionParaTi();
  const hist = ['raices-de-cobre', 'selva-digital', 'raices-de-cobre'];
  const porGeneros = silencio(() => g.generar(contexto({ historial: hist, estrategia: crearEstrategia('generos') })));
  const porHistorial = silencio(() => g.generar(contexto({ historial: hist, estrategia: crearEstrategia('historial') })));
  assert.notDeepEqual(ids(porGeneros), ids(porHistorial));
  assert.equal(porGeneros.estrategia, 'generos');
  assert.equal(porHistorial.estrategia, 'historial');
  assert.equal(porGeneros.plantilla, porHistorial.plantilla);
});

// ====================================================================
console.log('\n== Template Method (esqueleto de la recomendación) ==');
// ====================================================================
caso('GeneradorRecomendaciones es abstracta y exige tipo(), descripcion() y obtenerCandidatos()', () => {
  assert.throws(() => new GeneradorRecomendaciones(), /abstracta/);
  class Incompleta extends GeneradorRecomendaciones {}
  const g = new Incompleta();
  assert.throws(() => g.tipo(), /implementado/);
  assert.throws(() => g.obtenerCandidatos({}), /implementado/);
});

caso('El método plantilla es "final": una subclase no puede sobrescribir generar()', () => {
  class Tramposa extends RecomendacionParaTi { generar() { return []; } }
  assert.throws(() => new Tramposa(), /no puede sobrescribir generar/);
  for (const C of [RecomendacionParaTi, RecomendacionSimilares, RecomendacionDescubrir]) assert.equal(Object.hasOwn(C.prototype, 'generar'), false);
});

caso('Las tres plantillas ejecutan los MISMOS pasos y en el MISMO orden', () => {
  const ordenEsperado = ['prepararContexto', 'obtenerCandidatos', 'filtrar', 'puntuar', 'descartarIrrelevantes', 'ordenar+limitar', 'explicar'];
  const ref = raiz.buscar('ambar');
  for (const g of [new RecomendacionParaTi(), new RecomendacionSimilares(), new RecomendacionDescubrir()]) {
    const r = silencio(() => g.generar(contexto({ nodoReferencia: ref })));
    assert.deepEqual(r.pasos.map((p) => p.paso), ordenEsperado, g.constructor.name);
  }
});

caso('Ordena de mayor a menor puntaje; el empate se resuelve por título; respeta el límite', () => {
  const r = silencio(() => new RecomendacionParaTi().generar(contexto({ limite: 3 })));
  assert.equal(r.recomendaciones.length, 3);
  const p = r.recomendaciones.map((x) => x.puntaje);
  assert.deepEqual(p, [...p].sort((a, b) => b - a));
  const grupo = r.recomendaciones.filter((x) => x.puntaje === p[0]).map((x) => x.titulo);
  assert.deepEqual(grupo, [...grupo].sort((a, b) => a.localeCompare(b, 'es')));
});

caso('Solo recomienda títulos (película, documental, serie): nunca episodios, temporadas ni colecciones', () => {
  const r = silencio(() => new RecomendacionParaTi().generar(contexto()));
  assert.ok(r.recomendaciones.length > 0);
  assert.ok(r.recomendaciones.every((x) => ['pelicula', 'documental', 'serie'].includes(x.tipo)));
});

caso('Gancho filtrar() por defecto: no recomienda lo ya visto', () => {
  const sin = silencio(() => new RecomendacionParaTi().generar(contexto()));
  assert.ok(ids(sin).includes('el-ultimo-vuelo'));
  const con = silencio(() => new RecomendacionParaTi().generar(contexto({ historial: ['el-ultimo-vuelo'] })));
  assert.ok(!ids(con).includes('el-ultimo-vuelo'));
});

caso('ParaTi extiende el gancho filtrar(): respeta tipoContenidoPreferido (pelicula / serie / mixto)', () => {
  const tipos = (pref) => new Set(silencio(() => new RecomendacionParaTi().generar(contexto({ perfil: perfil({ generosFavoritos: ['accion', 'thriller', 'drama', 'aventura', 'documental', 'historia', 'misterio'], tipoContenidoPreferido: pref }) }))).recomendaciones.map((x) => x.tipo));
  assert.ok(!tipos('pelicula').has('serie') && tipos('pelicula').size > 0);
  assert.deepEqual([...tipos('serie')], ['serie']);
  assert.ok(tipos('mixto').has('serie') && tipos('mixto').has('pelicula'));
});

caso('Similares: cambia el gancho de géneros (usa los del título de referencia) y excluye al propio título', () => {
  const ref = raiz.buscar('ambar'); // drama, aventura
  const r = silencio(() => new RecomendacionSimilares().generar(contexto({ nodoReferencia: ref, perfil: perfil({ generosFavoritos: ['terror'] }) })));
  assert.ok(r.recomendaciones.length > 0);
  assert.ok(!ids(r).includes('ambar'));
  assert.ok(r.recomendaciones.every((x) => x.generos.some((g) => ['drama', 'aventura'].includes(g))));
  assert.match(r.recomendaciones[0].motivo, /Parecido a "Ámbar"/);
});

caso('Similares sobrescribe filtrar(): permite títulos ya vistos', () => {
  const ref = raiz.buscar('ambar');
  const r = silencio(() => new RecomendacionSimilares().generar(contexto({ nodoReferencia: ref, historial: ['ciudad-de-vidrio'] })));
  assert.ok(ids(r).includes('ciudad-de-vidrio'));
});

caso('Descubrir: solo propone títulos con algún género fuera de los favoritos y usa gustos emergentes', () => {
  const hist = ['raices-de-cobre', 'selva-digital']; // documental/historia/ciencia: ninguno es favorito
  const c = contexto({ historial: hist });
  const r = silencio(() => new RecomendacionDescubrir().generar(c));
  assert.ok(c.generosInteres.includes('documental') && !c.generosInteres.includes('accion'));
  assert.ok(r.recomendaciones.every((x) => x.generos.some((g) => !c.perfil.generosFavoritos.includes(g))));
  assert.ok(!ids(r).includes('raices-de-cobre')); // ya visto
});

caso('Gancho puntajeMinimo(): lo que no tiene ninguna relación (puntaje 0) no se recomienda', () => {
  const r = silencio(() => new RecomendacionParaTi().generar(contexto({ perfil: perfil({ generosFavoritos: ['terror'] }) })));
  assert.equal(r.recomendaciones.length, 0); // ningún título de terror
});

caso('Gancho alFinalizar(): una subclase puede engancharse sin cambiar el esqueleto', () => {
  const llamadas = [];
  class Medida extends RecomendacionParaTi { alFinalizar(res) { llamadas.push(res.recomendaciones.length); } }
  silencio(() => new Medida().generar(contexto({ limite: 2 })));
  assert.deepEqual(llamadas, [2]);
});

caso('crearGenerador: por tipo, por defecto "para-ti" y error con tipo inválido', () => {
  assert.ok(crearGenerador('similares') instanceof RecomendacionSimilares);
  assert.ok(crearGenerador() instanceof RecomendacionParaTi);
  assert.throws(() => crearGenerador('azar'), /Tipo de recomendación inválido/);
});

caso('Template Method + Strategy colaboran: el paso fijo puntuar() delega en la estrategia del contexto', () => {
  let llamadas = 0;
  const espia = new (class extends EstrategiaPuntuacion { id() { return 'espia'; } descripcion() { return ''; } puntuar() { llamadas++; return 0.9; } })();
  const r = silencio(() => new RecomendacionParaTi().generar(contexto({ estrategia: espia, limite: 3 })));
  assert.ok(llamadas > 3); // se puntuó a TODOS los candidatos filtrados
  assert.ok(r.recomendaciones.every((x) => x.puntaje === 0.9));
});

// ====================================================================
console.log('\n== Extremo a extremo por HTTP (Proxy + Strategy + Template Method) ==');
// ====================================================================
const hash = await bcrypt.hash('clave123', 4);
const planFila = (tipo, calidad) => ({ plan_tipo: tipo, precio_mensual: 1, calidad_maxima: calidad, pantallas_simultaneas: 1, descargas_offline: false });
const tabla = [
  { id: 1, nombre: 'Ana Admin', correo: 'admin@x.com', password: hash, rol: 'admin', ...planFila('premium', 'Full HD (1080p)') },
  { id: 2, nombre: 'Uma', correo: 'uma@x.com', password: hash, rol: 'usuario', ...planFila('basico', 'HD (720p)') },
  { id: 3, nombre: 'Ulises', correo: 'ulises@x.com', password: hash, rol: 'usuario', ...planFila('free', 'SD (480p)') },
];
db.pool.query = async (sql, p = []) => {
  const q = sql.replace(/\s+/g, ' ');
  if (q.startsWith('SELECT * FROM usuarios WHERE correo')) return { rows: tabla.filter((u) => u.correo === p[0]) };
  if (q.startsWith('SELECT * FROM usuarios WHERE id')) return { rows: tabla.filter((u) => u.id === Number(p[0])) };
  throw new Error(`SQL no soportado por la BD falsa: ${q}`);
};

await import('./index.js');
const URL = 'http://localhost:5000';
const http = async (metodo, ruta, { token, body } = {}) => {
  const r = await fetch(URL + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
};
const login = async (email) => (await http('POST', '/api/login', { body: { email, password: 'clave123' } })).data.token;
const [tAdmin, tUma, tUlises] = [await login('admin@x.com'), await login('uma@x.com'), await login('ulises@x.com')];
HistorialVisualizacionStore.limpiar(2);
HistorialVisualizacionStore.limpiar(3);

await casoAsync('Proxy: sin sesión 401; sin perfil 404 con mensaje claro', async () => {
  assert.equal((await http('GET', '/api/recomendaciones')).status, 401);
  assert.equal((await http('GET', '/api/recomendaciones/opciones')).status, 401);
  assert.equal((await http('POST', '/api/recomendaciones/historial', { body: { contenidoId: 'ambar' } })).status, 401);
  const r = await http('GET', '/api/recomendaciones', { token: tUma });
  assert.equal(r.status, 404);
  assert.match(r.data.message, /perfil/i);
});

await casoAsync('GET /opciones lista los tipos (Template Method) y las estrategias (Strategy)', async () => {
  const r = await http('GET', '/api/recomendaciones/opciones', { token: tUma });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.tipos.map((t) => t.id), ['para-ti', 'similares', 'descubrir']);
  assert.deepEqual(r.data.estrategias.map((e) => e.id), ['generos', 'historial', 'hibrida']);
});

await casoAsync('Recomendar "para-ti" con el perfil del usuario (estrategia híbrida por defecto)', async () => {
  assert.equal((await http('PUT', '/api/recomendaciones/mi-perfil', { token: tUma, body: { categoriaBase: 'accionAventura' } })).status, 201);
  const r = await http('GET', '/api/recomendaciones?limite=4', { token: tUma });
  assert.equal(r.status, 200);
  assert.equal(r.data.plantilla, 'RecomendacionParaTi');
  assert.equal(r.data.estrategia, 'hibrida');
  assert.equal(r.data.recomendaciones.length, 4);
  assert.ok(r.data.recomendaciones.every((x) => x.motivo && x.puntaje > 0));
  assert.ok(r.data.pasos.length >= 7);
});

await casoAsync('Historial: marcar visto, listar, y el título visto deja de recomendarse', async () => {
  const antes = (await http('GET', '/api/recomendaciones?estrategia=generos&limite=20', { token: tUma })).data;
  assert.ok(antes.recomendaciones.some((x) => x.id === 'el-ultimo-vuelo'));
  const v = await http('POST', '/api/recomendaciones/historial', { token: tUma, body: { contenidoId: 'el-ultimo-vuelo' } });
  assert.equal(v.status, 201);
  assert.equal((await http('GET', '/api/recomendaciones/historial', { token: tUma })).data.total, 1);
  const despues = (await http('GET', '/api/recomendaciones?estrategia=generos&limite=20', { token: tUma })).data;
  assert.ok(!despues.recomendaciones.some((x) => x.id === 'el-ultimo-vuelo'));
  assert.equal((await http('POST', '/api/recomendaciones/historial', { token: tUma, body: { contenidoId: 'no-existe' } })).status, 404);
  assert.equal((await http('POST', '/api/recomendaciones/historial', { token: tUma, body: { contenidoId: 'horizonte-nocturno-t1-e1' } })).status, 400); // episodio
  assert.equal((await http('GET', '/api/recomendaciones/historial', { token: tUlises })).data.total, 0); // el historial es por usuario
});

await casoAsync('Strategy por HTTP: cada estrategia devuelve su propio orden', async () => {
  for (const id of ['documental-no', 'x']) assert.equal((await http('GET', `/api/recomendaciones?estrategia=${id}`, { token: tUma })).status, 400);
  await http('POST', '/api/recomendaciones/historial', { token: tUma, body: { contenidoId: 'raices-de-cobre' } });
  await http('POST', '/api/recomendaciones/historial', { token: tUma, body: { contenidoId: 'raices-de-cobre' } });
  const g = (await http('GET', '/api/recomendaciones?estrategia=generos&limite=20', { token: tUma })).data;
  const h = (await http('GET', '/api/recomendaciones?estrategia=historial&limite=20', { token: tUma })).data;
  assert.equal(g.estrategia, 'generos');
  assert.equal(h.estrategia, 'historial');
  assert.notDeepEqual(g.recomendaciones.map((x) => x.id), h.recomendaciones.map((x) => x.id));
});

await casoAsync('Template Method por HTTP: similares y descubrir', async () => {
  const s = await http('GET', '/api/recomendaciones?tipo=similares&contenidoId=ambar', { token: tUma });
  assert.equal(s.status, 200);
  assert.equal(s.data.plantilla, 'RecomendacionSimilares');
  assert.ok(!s.data.recomendaciones.some((x) => x.id === 'ambar'));
  assert.equal((await http('GET', '/api/recomendaciones?tipo=similares', { token: tUma })).status, 400); // falta contenidoId
  assert.equal((await http('GET', '/api/recomendaciones?tipo=similares&contenidoId=nada', { token: tUma })).status, 404);
  assert.equal((await http('GET', '/api/recomendaciones?tipo=similares&contenidoId=horizonte-nocturno-t1', { token: tUma })).status, 400); // temporada
  const d = await http('GET', '/api/recomendaciones?tipo=descubrir', { token: tUma });
  assert.equal(d.status, 200);
  assert.equal(d.data.plantilla, 'RecomendacionDescubrir');
  assert.equal((await http('GET', '/api/recomendaciones?tipo=azar', { token: tUma })).status, 400);
  assert.equal((await http('GET', '/api/recomendaciones?limite=0', { token: tUma })).status, 400);
});

await casoAsync('Cada usuario recibe lo suyo (perfil e historial propios) y el borrado de historial funciona', async () => {
  await http('PUT', '/api/recomendaciones/mi-perfil', { token: tUlises, body: { categoriaBase: 'familiar' } });
  const u = (await http('GET', '/api/recomendaciones?estrategia=generos&limite=3', { token: tUlises })).data;
  const m = (await http('GET', '/api/recomendaciones?estrategia=generos&limite=3', { token: tUma })).data;
  assert.notDeepEqual(u.recomendaciones.map((x) => x.id), m.recomendaciones.map((x) => x.id));
  assert.equal((await http('DELETE', '/api/recomendaciones/historial', { token: tUma })).data.total, 0);
});

await casoAsync('Proxy: las operaciones quedan registradas en el log de accesos', async () => {
  const acc = (await http('GET', '/api/admin/accesos', { token: tAdmin })).data.eventos;
  assert.ok(acc.some((e) => e.operacion === 'recomendar títulos' && e.resultado === 'PERMITIDO'));
  assert.ok(acc.some((e) => e.operacion === 'recomendar títulos' && e.resultado === 'DENEGADO')); // la llamada sin sesión
  assert.ok(acc.some((e) => e.operacion === 'registrar título visto' && e.resultado === 'PERMITIDO'));
});

console.log(`\n🎉 ${ok} comprobaciones OK`);
process.exit(0);
