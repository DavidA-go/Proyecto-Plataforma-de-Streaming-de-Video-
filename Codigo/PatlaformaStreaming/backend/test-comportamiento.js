/**
 * test-comportamiento.js
 * ------------------------------------------------------------------
 * Pruebas de los patrones de comportamiento Iterator, Mediator y Memento.
 * NO necesita PostgreSQL: las pruebas unitarias no usan BD y las de
 * extremo a extremo reemplazan el pool de pg por una BD en memoria.
 *
 *     cd backend && npm run test:comportamiento
 * ------------------------------------------------------------------
 */
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import db from './db/DatabaseSingleton.js';
import CatalogoService from './catalog/CatalogoService.js';
import CatalogoServicio from './services/CatalogoServicio.js';
import IteradorContenido from './catalog/iterator/IteradorContenido.js';
import SesionReproduccion from './streaming/mediator/SesionReproduccion.js';
import ComponenteReproductor from './streaming/mediator/ComponenteReproductor.js';
import RegistroSesiones from './streaming/mediator/RegistroSesiones.js';
import { techoDesdePlan } from './services/StreamingServicio.js';
import PerfilRecomendacion from './recommendation/PerfilRecomendacion.js';
import PerfilMemento from './recommendation/memento/PerfilMemento.js';
import HistorialPerfil from './recommendation/memento/HistorialPerfil.js';
import PerfilRecomendacionRegistry from './recommendation/PerfilRecomendacionRegistry.js';
import RecomendacionServicio from './services/RecomendacionServicio.js';

// Filtro opcional por patrón: `node test-comportamiento.js iterator|mediator|memento`.
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
const ids = (it) => [...it].map((n) => n.id);

// ====================================================================
console.log('\n== Iterator (catálogo / gestión de contenido) ==');
// ====================================================================
const raiz = CatalogoService.raiz;
const serie = CatalogoService.buscar('horizonte-nocturno');

caso('IteradorContenido es abstracta', () => assert.throws(() => new IteradorContenido(raiz), /abstracta/));

caso('profundidad (preorden): serie -> temporada -> episodios -> siguiente temporada', () => {
  const r = ids(serie.crearIterador('profundidad'));
  assert.deepEqual(r.slice(0, 7), ['horizonte-nocturno', 'horizonte-nocturno-t1', 'horizonte-nocturno-t1-e1', 'horizonte-nocturno-t1-e2', 'horizonte-nocturno-t1-e3', 'horizonte-nocturno-t1-e4', 'horizonte-nocturno-t2']);
  assert.equal(r.length, 1 + 2 + 8);
});

caso('anchura (por niveles): primero la serie, luego sus temporadas, luego los episodios', () => {
  const r = ids(serie.crearIterador('anchura'));
  assert.deepEqual(r.slice(0, 3), ['horizonte-nocturno', 'horizonte-nocturno-t1', 'horizonte-nocturno-t2']);
  assert.equal(r[3], 'horizonte-nocturno-t1-e1');
});

caso('reproducibles: solo hojas y coincide con Composite.obtenerReproducibles()', () => {
  const porIterador = ids(raiz.crearIterador('reproducibles'));
  const porComposite = raiz.obtenerReproducibles().map((n) => n.id);
  assert.deepEqual(porIterador, porComposite);
  assert.ok(porIterador.length > 50);
});

caso('los tres órdenes visitan exactamente los mismos nodos (solo cambia el orden)', () => {
  const a = ids(raiz.crearIterador('profundidad')).sort();
  const b = ids(raiz.crearIterador('anchura')).sort();
  assert.deepEqual(a, b);
});

caso('nivel: 0 en la raíz, +1 por cada descenso', () => {
  const it = serie.crearIterador('profundidad');
  const niveles = [];
  while (it.hasNext()) { it.next(); niveles.push(it.nivel); }
  assert.deepEqual(niveles.slice(0, 4), [0, 1, 2, 2]);
});

caso('hasNext() es idempotente (no consume) y next() al final lanza error', () => {
  const it = CatalogoService.buscar('ambar').crearIterador('profundidad');
  assert.ok(it.hasNext() && it.hasNext() && it.hasNext());
  assert.equal(it.next().id, 'ambar');
  assert.equal(it.hasNext(), false);
  assert.throws(() => it.next(), /no tiene más elementos/);
});

caso('una hoja se recorre a sí misma', () => {
  assert.deepEqual(ids(CatalogoService.buscar('ambar').crearIterador('anchura')), ['ambar']);
});

caso('predicado: filtra por género y por tipo', () => {
  const peliculas = ids(raiz.crearIterador('profundidad', (n) => n.tipo() === 'pelicula'));
  assert.equal(peliculas.length, 4);
  const familiares = ids(raiz.crearIterador('profundidad', (n) => n.getGeneros().includes('familiar') && n.tipo() === 'serie'));
  assert.deepEqual(familiares.sort(), ['la-otra-orilla', 'reino-de-papel']);
});

caso('reset() permite recorrer otra vez desde el inicio', () => {
  const it = serie.crearIterador('profundidad');
  const primera = ids(it);
  it.reset();
  assert.deepEqual(ids(it), primera);
});

caso('es perezoso: dos iteradores del mismo árbol son independientes', () => {
  const a = serie.crearIterador('profundidad');
  const b = serie.crearIterador('profundidad');
  a.next(); a.next();
  assert.equal(b.next().id, 'horizonte-nocturno');
});

caso('orden inválido -> error claro', () => assert.throws(() => serie.crearIterador('zigzag'), /Orden de recorrido inválido/));

const cat = new CatalogoServicio();

caso('servicio.recorrer: las páginas juntas == el recorrido completo, sin repetidos ni huecos', () => {
  const completo = ids(raiz.crearIterador('profundidad'));
  let desde = 0; const juntas = [];
  while (desde !== null) {
    const p = cat.recorrer({ id: 'catalogo', orden: 'profundidad', desde, limite: 17 });
    juntas.push(...p.elementos.map((e) => e.id));
    desde = p.siguiente;
  }
  assert.deepEqual(juntas, completo);
});

caso('servicio.recorrer: filtros, límite máximo y validaciones', () => {
  const r = cat.recorrer({ orden: 'reproducibles', tipo: 'pelicula' });
  assert.ok(r.elementos.every((e) => e.tipo === 'pelicula'));
  assert.equal(cat.recorrer({ limite: 100000 }).cantidad, 100);
  assert.throws(() => cat.recorrer({ id: 'no-existe' }), /no encontrado/);
  assert.throws(() => cat.recorrer({ limite: 0 }), /limite/);
  assert.throws(() => cat.recorrer({ desde: -1 }), /desde/);
  assert.throws(() => cat.recorrer({ orden: 'x' }), /Orden de recorrido inválido/);
});

caso('servicio.siguiente: pasa de una temporada a la siguiente y de una serie a la otra', () => {
  assert.equal(cat.siguiente('horizonte-nocturno-t1-e4').siguiente.id, 'horizonte-nocturno-t2-e1');
  assert.equal(cat.siguiente('horizonte-nocturno-t2-e4').siguiente.id, 'codigos-del-silencio-t1-e1');
  assert.equal(cat.siguiente('horizonte-nocturno').siguiente.id, 'codigos-del-silencio-t1-e1'); // desde un grupo: tras su último episodio
});

caso('servicio.siguiente: el último reproducible del catálogo no tiene siguiente', () => {
  const ultimo = ids(raiz.crearIterador('reproducibles')).at(-1);
  assert.equal(cat.siguiente(ultimo).siguiente, null);
  assert.throws(() => cat.siguiente('no-existe'), /no encontrado/);
});

// ====================================================================
console.log('\n== Mediator (streaming adaptativo) ==');
// ====================================================================
const contenido = { id: 'ambar', titulo: 'Ámbar', duracionMin: 10 };
const nueva = (o = {}) => new SesionReproduccion({ contenido, techoCalidad: '1080p', anchoBandaKbps: 7000, ...o });
const eventos = (s, nombre) => s.bitacora({ ultimos: 500 }).filter((e) => e.evento === nombre);

caso('los colegas SOLO conocen al mediador (ninguno referencia a otro colega)', () => {
  const s = nueva();
  for (const c of [s.red, s.calidad, s.buffer, s.control, s.pistas]) {
    assert.ok(c instanceof ComponenteReproductor);
    assert.equal(c.mediador, s);
    const referenciasAOtros = Object.entries(c).filter(([k, v]) => k !== 'mediador' && v instanceof ComponenteReproductor);
    assert.deepEqual(referenciasAOtros, [], `${c.nombre} no debe referenciar a otros componentes`);
  }
});

caso('ComponenteReproductor es abstracta', () => assert.throws(() => new ComponenteReproductor('x'), /abstracta/));

caso('calidad inicial según la red y respetando el techo del plan', () => {
  assert.equal(nueva({ anchoBandaKbps: 7000 }).calidad.actual, '1080p');
  assert.equal(nueva({ anchoBandaKbps: 3200 }).calidad.actual, '720p');
  assert.equal(nueva({ anchoBandaKbps: 500 }).calidad.actual, '360p');
  assert.equal(nueva({ anchoBandaKbps: 50000, techoCalidad: '480p' }).calidad.actual, '480p'); // plan Free
});

caso('reproducir con buffer vacío -> "cargando"; al llenarse reanuda sola -> "reproduciendo"', () => {
  const s = nueva();
  s.reproducir();
  assert.equal(s.control.estado, 'cargando');
  s.avanzar(10);
  assert.equal(s.control.estado, 'reproduciendo');
  assert.ok(s.control.posicionSeg > 0);
});

caso('la red cae -> baja de calidad de inmediato', () => {
  const s = nueva(); s.reproducir(); s.avanzar(15);
  assert.equal(s.calidad.actual, '1080p');
  s.reportarRed(1500);
  assert.equal(s.calidad.actual, '480p'); // 1200*1.25 = 1500 <= 1500
});

caso('la red mejora pero el buffer es corto -> la subida se POSPONE; con buffer suficiente sube de a un escalón', () => {
  const s = nueva({ anchoBandaKbps: 900 }); // 360p
  s.reproducir();
  assert.equal(s.calidad.actual, '360p');
  s.reportarRed(20000);
  assert.equal(s.calidad.actual, '360p', 'buffer vacío: no debe subir todavía');
  assert.equal(eventos(s, 'SUBIDA_POSPUESTA').length, 1);
  s.avanzar(3); // buffer ~ 3 * 20000/800 = lleno
  assert.ok(s.buffer.segundos >= 10);
  assert.notEqual(s.calidad.actual, '360p');
  s.avanzar(5);
  assert.equal(s.calidad.actual, '1080p');
});

caso('buffer se vacía -> "cargando"; al recuperarse reanuda SOLO (el usuario nunca pausó)', () => {
  const s = nueva({ anchoBandaKbps: 600 }); // 600kbps < 800kbps de 360p: el buffer se gasta
  s.reproducir(); s.avanzar(40);
  assert.ok(eventos(s, 'BUFFER_VACIO').length >= 1, 'debió vaciarse');
  assert.ok(eventos(s, 'BUFFER_RECUPERADO').length >= 1, 'debió recuperarse');
  s.reportarRed(7000); s.avanzar(10);
  assert.equal(s.control.estado, 'reproduciendo');
});

caso('buffer bajo -> el mediador baja un escalón de calidad', () => {
  const s = nueva({ anchoBandaKbps: 7000 }); s.reproducir(); s.avanzar(12);
  assert.equal(s.calidad.actual, '1080p');
  s.red.anchoBandaKbps = 2000; // la red cae sin avisar (no hay RED_CAMBIO): solo lo nota el buffer
  s.avanzar(30);
  assert.ok(eventos(s, 'BUFFER_BAJO').length >= 1);
  assert.notEqual(s.calidad.actual, '1080p');
});

caso('pausa: la posición no avanza, el buffer SIGUE llenándose y no reanuda solo', () => {
  const s = nueva(); s.reproducir(); s.avanzar(10);
  const pos = s.control.posicionSeg;
  s.pausar();
  const antes = s.buffer.segundos;
  s.avanzar(3);
  assert.equal(s.control.estado, 'pausado');
  assert.equal(s.control.posicionSeg, pos);
  assert.ok(s.buffer.segundos >= antes);
  s.avanzar(20);
  assert.equal(s.control.estado, 'pausado');
  s.reproducir();
  assert.equal(s.control.estado, 'reproduciendo'); // buffer ya lleno
});

caso('buscar: mueve la posición, vacía el buffer y arranca en la calidad más baja; luego la ABR sube', () => {
  const s = nueva(); s.reproducir(); s.avanzar(20);
  assert.equal(s.calidad.actual, '1080p');
  s.buscar(300);
  assert.equal(s.control.posicionSeg, 300);
  assert.equal(s.buffer.segundos, 0);
  assert.equal(s.calidad.actual, '360p');
  assert.equal(s.control.estado, 'cargando');
  s.avanzar(15);
  assert.equal(s.control.estado, 'reproduciendo');
  assert.notEqual(s.calidad.actual, '360p');
});

caso('cambiar el AUDIO recorta el buffer; cambiar subtítulos no lo toca', () => {
  const s = nueva(); s.reproducir(); s.avanzar(25);
  const lleno = s.buffer.segundos;
  assert.ok(lleno > 15);
  s.cambiarSubtitulo('en');
  assert.equal(s.buffer.segundos, lleno);
  assert.equal(s.pistas.subtitulo, 'en');
  s.cambiarSubtitulo('ninguno');
  assert.equal(s.pistas.subtitulo, null);
  s.cambiarAudio('en');
  assert.ok(s.buffer.segundos <= 6);
  assert.equal(s.pistas.audio, 'en');
});

caso('al llegar al final -> "detenido"', () => {
  const s = new SesionReproduccion({ contenido: { id: 'x', titulo: 'x', duracionMin: 1 }, anchoBandaKbps: 7000 });
  s.reproducir(); s.avanzar(120);
  assert.equal(s.control.estado, 'detenido');
  assert.equal(s.control.posicionSeg, 60);
});

caso('validaciones: red, posición, audio, subtítulo y tiempo inválidos', () => {
  const s = nueva();
  assert.throws(() => s.reportarRed(-5), /kbps/);
  assert.throws(() => s.reportarRed('rápida'), /kbps/);
  assert.throws(() => s.buscar(99999), /posición/);
  assert.throws(() => s.cambiarAudio('fr'), /no disponible/);
  assert.throws(() => s.cambiarSubtitulo('fr'), /no disponible/);
  assert.throws(() => s.avanzar(0), /segundos/);
  assert.throws(() => s.avanzar(9999), /segundos/);
});

caso('el techo del plan nunca se supera aunque la red sea enorme', () => {
  const s = nueva({ techoCalidad: '720p', anchoBandaKbps: 100000 });
  s.reproducir(); s.avanzar(60);
  assert.equal(s.calidad.actual, '720p');
});

caso('la bitácora dice quién avisó, qué evento y qué reglas se dispararon', () => {
  const s = nueva(); const antes = s.ultimaSecuencia;
  s.buscar(120);
  const nuevos = s.bitacora({ desdeN: antes });
  assert.deepEqual(nuevos.map((e) => e.evento), ['BUSCAR', 'CALIDAD_CAMBIO'].filter((e) => nuevos.some((n) => n.evento === e)));
  assert.equal(nuevos[0].origen, 'ControlReproduccion');
});

caso('techoDesdePlan traduce el texto de calidad de cada plan', () => {
  assert.equal(techoDesdePlan('SD (480p)'), '480p');
  assert.equal(techoDesdePlan('HD (720p)'), '720p');
  assert.equal(techoDesdePlan('Full HD (1080p)'), '1080p');
  assert.equal(techoDesdePlan('4K Ultra HD'), '1080p');
  assert.equal(techoDesdePlan(undefined), '360p');
});

caso('RegistroSesiones: solo el dueño ve su sesión', () => {
  const s = nueva();
  const id = RegistroSesiones.crear(s, 7);
  assert.equal(RegistroSesiones.obtener(id, 7), s);
  assert.equal(RegistroSesiones.obtener(id, '7'), s);
  assert.equal(RegistroSesiones.obtener(id, 8), null);
  assert.equal(RegistroSesiones.cerrar(id, 8), false);
  assert.equal(RegistroSesiones.cerrar(id, 7), true);
  assert.equal(RegistroSesiones.obtener(id, 7), null);
});

// ====================================================================
console.log('\n== Memento (recomendación) ==');
// ====================================================================
const perfilBase = () => new PerfilRecomendacion({ nombre: 'Prueba', generosFavoritos: ['accion', 'drama'], tipoContenidoPreferido: 'mixto', pesoHistorial: 0.5 });

caso('el memento es una foto INMUTABLE: cambiar el perfil después no la altera', () => {
  const p = perfilBase();
  const m = p.crearMemento('foto');
  p.actualizar({ generosFavoritos: ['terror'], pesoHistorial: 1 });
  p.generosFavoritos.push('extra');
  assert.deepEqual([...m.getEstado().generosFavoritos], ['accion', 'drama']);
  assert.equal(m.getEstado().pesoHistorial, 0.5);
  assert.ok(Object.isFrozen(m) && Object.isFrozen(m.getEstado()) && Object.isFrozen(m.getEstado().generosFavoritos));
});

caso('restaurar() devuelve el estado y NO comparte el arreglo con el memento', () => {
  const p = perfilBase();
  const m = p.crearMemento();
  p.actualizar({ generosFavoritos: ['terror'] });
  p.restaurar(m);
  assert.deepEqual(p.generosFavoritos, ['accion', 'drama']);
  p.generosFavoritos.push('otro'); // no debe tocar el memento
  assert.deepEqual([...m.getEstado().generosFavoritos], ['accion', 'drama']);
});

caso('restaurar() solo acepta mementos', () => {
  assert.throws(() => perfilBase().restaurar({ getEstado: () => ({}) }), /PerfilMemento/);
});

caso('el resumen público del memento no expone la interfaz de restauración', () => {
  const r = perfilBase().crearMemento('x').resumen();
  assert.deepEqual(Object.keys(r).sort(), ['etiqueta', 'fecha', 'generosFavoritos']);
});

caso('actualizar() valida todo ANTES de aplicar (si falla, el perfil queda intacto)', () => {
  const p = perfilBase();
  assert.throws(() => p.actualizar({ tipoContenidoPreferido: 'serie', pesoHistorial: 7 }), /entre 0 y 1/);
  assert.equal(p.tipoContenidoPreferido, 'mixto');
  assert.throws(() => p.actualizar({ generosFavoritos: [] }), /vacío/);
  assert.throws(() => p.actualizar({ generosFavoritos: [1] }), /arreglo de textos/);
  assert.throws(() => p.actualizar({ tipoContenidoPreferido: 'x' }), /inválido/);
  assert.deepEqual(p.actualizar({ generosFavoritos: [' Terror ', 'terror', 'Comedia'] }), ['generosFavoritos']);
  assert.deepEqual(p.generosFavoritos, ['terror', 'comedia']);
});

caso('HistorialPerfil: deshacer y rehacer en orden', () => {
  const p = perfilBase(); const h = new HistorialPerfil();
  h.guardar(p.crearMemento('v1')); p.actualizar({ pesoHistorial: 0.7 });
  h.guardar(p.crearMemento('v2')); p.actualizar({ pesoHistorial: 0.9 });
  h.deshacer(p); assert.equal(p.pesoHistorial, 0.7);
  h.deshacer(p); assert.equal(p.pesoHistorial, 0.5);
  assert.equal(h.deshacer(p), null);
  h.rehacer(p); assert.equal(p.pesoHistorial, 0.7);
  h.rehacer(p); assert.equal(p.pesoHistorial, 0.9);
  assert.equal(h.rehacer(p), null);
});

caso('un cambio nuevo descarta lo que se podía rehacer', () => {
  const p = perfilBase(); const h = new HistorialPerfil();
  h.guardar(p.crearMemento()); p.actualizar({ pesoHistorial: 0.7 });
  h.deshacer(p);
  assert.equal(h.puedeRehacer(), true);
  h.guardar(p.crearMemento()); p.actualizar({ pesoHistorial: 0.2 });
  assert.equal(h.puedeRehacer(), false);
});

caso('el historial tiene tope (descarta lo más antiguo)', () => {
  const p = perfilBase(); const h = new HistorialPerfil({ limite: 3 });
  for (let i = 1; i <= 5; i++) { h.guardar(p.crearMemento(`v${i}`)); }
  assert.deepEqual(h.listar().map((x) => x.etiqueta), ['v3', 'v4', 'v5']);
});

caso('restaurarVersion vuelve a una versión y se puede volver atrás de esa restauración', () => {
  const p = perfilBase(); const h = new HistorialPerfil();
  h.guardar(p.crearMemento('v1')); p.actualizar({ pesoHistorial: 0.1 });
  h.guardar(p.crearMemento('v2')); p.actualizar({ pesoHistorial: 0.2 });
  assert.equal(h.restaurarVersion(p, 1).etiqueta, 'v1');
  assert.equal(p.pesoHistorial, 0.5);
  assert.equal(h.restaurarVersion(p, 99), null);
  h.deshacer(p);
  assert.equal(p.pesoHistorial, 0.2);
});

caso('Prototype + Memento: editar el perfil NO contamina la plantilla del registro', () => {
  const rec = new RecomendacionServicio();
  rec.guardarMiPerfil({ usuarioId: 'p1', categoriaBase: 'familiar', generosAdicionales: ['terror'], pesoHistorial: 0.99 });
  const plantilla = PerfilRecomendacionRegistry.obtenerPlantilla('familiar');
  assert.ok(!plantilla.generosFavoritos.includes('terror'));
  assert.equal(plantilla.pesoHistorial, 0.3);
});

const rec = new RecomendacionServicio();

caso('servicio: crear -> modificar -> deshacer -> rehacer -> restaurar versión', () => {
  const u = 'u-flujo';
  const creado = rec.guardarMiPerfil({ usuarioId: u, categoriaBase: 'documental' });
  assert.equal(creado.creado, true);
  assert.equal(creado.historial.length, 0);
  assert.equal(creado.puedeDeshacer, false);

  rec.guardarMiPerfil({ usuarioId: u, pesoHistorial: 0.1 });
  const m2 = rec.guardarMiPerfil({ usuarioId: u, generosAdicionales: ['Terror'] });
  assert.ok(m2.perfil.generosFavoritos.includes('terror'));
  assert.equal(m2.historial.length, 2);

  const d = rec.deshacerMiPerfil({ usuarioId: u });
  assert.ok(!d.perfil.generosFavoritos.includes('terror'));
  assert.equal(d.puedeRehacer, true);
  const r = rec.rehacerMiPerfil({ usuarioId: u });
  assert.ok(r.perfil.generosFavoritos.includes('terror'));

  const v1 = rec.restaurarMiPerfil({ usuarioId: u, version: 1 });
  assert.equal(v1.perfil.pesoHistorial, 0.8); // el valor de la plantilla "documental", antes de tocar nada
});

caso('servicio: si el cambio falla, el perfil vuelve a como estaba y no se guarda versión', () => {
  const u = 'u-rollback';
  rec.guardarMiPerfil({ usuarioId: u, categoriaBase: 'familiar' });
  const antes = JSON.stringify(rec.miPerfil({ usuarioId: u }));
  assert.throws(() => rec.guardarMiPerfil({ usuarioId: u, generosAdicionales: ['terror'], pesoHistorial: 9 }), /entre 0 y 1/);
  assert.throws(() => rec.guardarMiPerfil({ usuarioId: u, categoriaBase: 'no-existe' }), /Categoría de perfil inválida/);
  assert.equal(JSON.stringify(rec.miPerfil({ usuarioId: u })), antes);
});

caso('servicio: un cambio que no cambia nada no ensucia el historial', () => {
  const u = 'u-igual';
  rec.guardarMiPerfil({ usuarioId: u, categoriaBase: 'familiar' });
  const r = rec.guardarMiPerfil({ usuarioId: u, pesoHistorial: 0.3 });
  assert.equal(r.sinCambios, true);
  assert.equal(r.historial.length, 0);
});

caso('servicio: cambiar la categoría base reemplaza el perfil y se puede deshacer', () => {
  const u = 'u-cat';
  rec.guardarMiPerfil({ usuarioId: u, categoriaBase: 'familiar' });
  const r = rec.guardarMiPerfil({ usuarioId: u, categoriaBase: 'accionAventura' });
  assert.equal(r.perfil.nombre, 'Acción y Aventura');
  assert.equal(rec.deshacerMiPerfil({ usuarioId: u }).perfil.nombre, 'Familiar');
});

caso('servicio: errores de uso claros (sin perfil, nada que deshacer, versión inexistente)', () => {
  assert.throws(() => rec.miPerfil({ usuarioId: 'nadie' }), /Aún no tienes/);
  assert.throws(() => rec.guardarMiPerfil({ usuarioId: 'nadie', pesoHistorial: 0.5 }), /categoriaBase/);
  rec.guardarMiPerfil({ usuarioId: 'u-vacio', categoriaBase: 'familiar' });
  assert.throws(() => rec.deshacerMiPerfil({ usuarioId: 'u-vacio' }), /No hay cambios/);
  assert.throws(() => rec.rehacerMiPerfil({ usuarioId: 'u-vacio' }), /No hay cambios/);
  assert.throws(() => rec.restaurarMiPerfil({ usuarioId: 'u-vacio', version: 5 }), /no existe/);
  assert.throws(() => rec.restaurarMiPerfil({ usuarioId: 'u-vacio', version: 'x' }), /entero/);
  assert.throws(() => rec.guardarMiPerfil({ usuarioId: 'u-vacio' }), /Indica qué cambiar/);
});

caso('servicio: cada usuario tiene su propio perfil e historial', () => {
  rec.guardarMiPerfil({ usuarioId: 'a', categoriaBase: 'familiar' });
  rec.guardarMiPerfil({ usuarioId: 'b', categoriaBase: 'documental' });
  rec.guardarMiPerfil({ usuarioId: 'a', pesoHistorial: 0.2 });
  assert.equal(rec.miPerfil({ usuarioId: 'a' }).historial.length, 1);
  assert.equal(rec.miPerfil({ usuarioId: 'b' }).historial.length, 0);
  assert.equal(rec.miPerfil({ usuarioId: 'b' }).perfil.nombre, 'Documentales');
});

// ====================================================================
console.log('\n== Extremo a extremo por HTTP (Proxy + Iterator + Mediator + Memento) ==');
// ====================================================================
const hash = await bcrypt.hash('clave123', 4);
const plan = (tipo, calidad) => ({ plan_tipo: tipo, precio_mensual: 1, calidad_maxima: calidad, pantallas_simultaneas: 1, descargas_offline: false });
const tabla = [
  { id: 1, nombre: 'Ana Admin', correo: 'admin@x.com', password: hash, rol: 'admin', ...plan('premium', 'Full HD (1080p)') },
  { id: 2, nombre: 'Uma', correo: 'uma@x.com', password: hash, rol: 'usuario', ...plan('basico', 'HD (720p)') },
  { id: 3, nombre: 'Ulises', correo: 'ulises@x.com', password: hash, rol: 'usuario', ...plan('free', 'SD (480p)') },
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

await casoAsync('invitado (sin sesión): 401 en los tres patrones', async () => {
  assert.equal((await http('GET', '/api/catalogo/catalogo/recorrer')).status, 401);
  assert.equal((await http('GET', '/api/catalogo/ambar/siguiente')).status, 401);
  assert.equal((await http('POST', '/api/stream/sesion', { body: { contenidoId: 'ambar' } })).status, 401);
  assert.equal((await http('GET', '/api/recomendaciones/mi-perfil')).status, 401);
  assert.equal((await http('PUT', '/api/recomendaciones/mi-perfil', { body: { categoriaBase: 'familiar' } })).status, 401);
});

await casoAsync('Iterator por HTTP: recorrido paginado y siguiente episodio', async () => {
  const p1 = await http('GET', '/api/catalogo/horizonte-nocturno/recorrer?orden=profundidad&limite=4', { token: tUma });
  assert.equal(p1.status, 200);
  assert.deepEqual(p1.data.elementos.map((e) => e.id), ['horizonte-nocturno', 'horizonte-nocturno-t1', 'horizonte-nocturno-t1-e1', 'horizonte-nocturno-t1-e2']);
  assert.equal(p1.data.siguiente, 4);
  const p2 = await http('GET', `/api/catalogo/horizonte-nocturno/recorrer?orden=profundidad&limite=4&desde=${p1.data.siguiente}`, { token: tUma });
  assert.equal(p2.data.elementos[0].id, 'horizonte-nocturno-t1-e3');
  const pel = await http('GET', '/api/catalogo/catalogo/recorrer?orden=reproducibles&tipo=pelicula&limite=50', { token: tUma });
  assert.equal(pel.data.cantidad, 4);
  assert.equal(pel.data.siguiente, null);
  const sig = await http('GET', '/api/catalogo/horizonte-nocturno-t1-e4/siguiente', { token: tUma });
  assert.equal(sig.data.siguiente.id, 'horizonte-nocturno-t2-e1');
  assert.equal((await http('GET', '/api/catalogo/no-existe/recorrer', { token: tUma })).status, 404);
  assert.equal((await http('GET', '/api/catalogo/catalogo/recorrer?orden=zigzag', { token: tUma })).status, 400);
});

let sesionUma;
await casoAsync('Mediator por HTTP: el techo de calidad sale del PLAN del usuario', async () => {
  const uma = await http('POST', '/api/stream/sesion', { token: tUma, body: { contenidoId: 'ambar', anchoBandaKbps: 50000 } });
  assert.equal(uma.status, 201);
  assert.equal(uma.data.estado.calidad.techoPlan, '720p'); // plan básico
  assert.equal(uma.data.estado.calidad.actual, '720p');
  sesionUma = uma.data.sesionId;
  const ulises = await http('POST', '/api/stream/sesion', { token: tUlises, body: { contenidoId: 'ambar', anchoBandaKbps: 50000 } });
  assert.equal(ulises.data.estado.calidad.techoPlan, '480p'); // plan free
  const admin = await http('POST', '/api/stream/sesion', { token: tAdmin, body: { contenidoId: 'ambar', anchoBandaKbps: 50000 } });
  assert.equal(admin.data.estado.calidad.actual, '1080p'); // premium
});

await casoAsync('Mediator + Iterator: pedir una serie reproduce su primer episodio', async () => {
  const r = await http('POST', '/api/stream/sesion', { token: tUma, body: { contenidoId: 'horizonte-nocturno' } });
  assert.equal(r.status, 201);
  assert.equal(r.data.estado.contenido.id, 'horizonte-nocturno-t1-e1');
});

await casoAsync('Mediator por HTTP: acciones y eventos que coordinó el mediador', async () => {
  const play = await http('POST', `/api/stream/sesion/${sesionUma}/accion`, { token: tUma, body: { accion: 'reproducir' } });
  assert.equal(play.data.estado.reproduccion.estado, 'cargando');
  const t = await http('POST', `/api/stream/sesion/${sesionUma}/accion`, { token: tUma, body: { accion: 'avanzar', valor: 10 } });
  assert.equal(t.data.estado.reproduccion.estado, 'reproduciendo');
  assert.ok(t.data.eventos.some((e) => e.evento === 'BUFFER_RECUPERADO'));
  const red = await http('POST', `/api/stream/sesion/${sesionUma}/accion`, { token: tUma, body: { accion: 'red', valor: 1000 } });
  assert.equal(red.data.estado.calidad.actual, '360p');
  assert.deepEqual(red.data.eventos.map((e) => e.evento), ['RED_CAMBIO', 'CALIDAD_CAMBIO']);
  const seek = await http('POST', `/api/stream/sesion/${sesionUma}/accion`, { token: tUma, body: { accion: 'buscar', valor: 200 } });
  assert.equal(seek.data.estado.reproduccion.posicionSeg, 200);
  assert.equal((await http('GET', `/api/stream/sesion/${sesionUma}`, { token: tUma })).data.eventos.length > 3, true);
});

await casoAsync('Mediator por HTTP: validaciones y aislamiento entre usuarios', async () => {
  const mala = (accion, valor) => http('POST', `/api/stream/sesion/${sesionUma}/accion`, { token: tUma, body: { accion, valor } });
  assert.equal((await mala('volar')).status, 400);
  assert.equal((await mala('red', -1)).status, 400);
  assert.equal((await mala('buscar', 999999)).status, 400);
  assert.equal((await mala('audio', 'fr')).status, 400);
  assert.equal((await http('GET', `/api/stream/sesion/${sesionUma}`, { token: tUlises })).status, 404); // sesión ajena
  assert.equal((await http('POST', `/api/stream/sesion/${sesionUma}/accion`, { token: tAdmin, body: { accion: 'pausar' } })).status, 404);
  assert.equal((await http('POST', '/api/stream/sesion', { token: tUma, body: { contenidoId: 'no-existe' } })).status, 404);
  assert.equal((await http('POST', '/api/stream/sesion', { token: tUma, body: { contenidoId: 'ambar', anchoBandaKbps: 0 } })).status, 400);
  assert.equal((await http('DELETE', `/api/stream/sesion/${sesionUma}`, { token: tUlises })).status, 404);
  assert.equal((await http('DELETE', `/api/stream/sesion/${sesionUma}`, { token: tUma })).status, 200);
  assert.equal((await http('GET', `/api/stream/sesion/${sesionUma}`, { token: tUma })).status, 404);
});

await casoAsync('Memento por HTTP: perfil propio con deshacer, rehacer y versiones', async () => {
  assert.equal((await http('GET', '/api/recomendaciones/mi-perfil', { token: tUma })).status, 404); // aún no tiene
  const c = await http('PUT', '/api/recomendaciones/mi-perfil', { token: tUma, body: { categoriaBase: 'familiar' } });
  assert.equal(c.status, 201);
  const m = await http('PUT', '/api/recomendaciones/mi-perfil', { token: tUma, body: { generosAdicionales: ['terror'], pesoHistorial: 0.9 } });
  assert.equal(m.status, 200);
  assert.ok(m.data.perfil.generosFavoritos.includes('terror'));
  assert.equal(m.data.historial.length, 1);
  assert.equal((await http('PUT', '/api/recomendaciones/mi-perfil', { token: tUma, body: { pesoHistorial: 3 } })).status, 400);
  assert.equal((await http('GET', '/api/recomendaciones/mi-perfil', { token: tUma })).data.perfil.pesoHistorial, 0.9); // sin cambios tras el error
  const d = await http('POST', '/api/recomendaciones/mi-perfil/deshacer', { token: tUma });
  assert.equal(d.data.perfil.pesoHistorial, 0.3);
  assert.equal(d.data.puedeRehacer, true);
  assert.equal((await http('POST', '/api/recomendaciones/mi-perfil/rehacer', { token: tUma })).data.perfil.pesoHistorial, 0.9);
  assert.equal((await http('POST', '/api/recomendaciones/mi-perfil/restaurar', { token: tUma, body: { version: 1 } })).data.perfil.pesoHistorial, 0.3);
  assert.equal((await http('POST', '/api/recomendaciones/mi-perfil/restaurar', { token: tUma, body: { version: 50 } })).status, 404);
  assert.equal((await http('GET', '/api/recomendaciones/mi-perfil', { token: tUlises })).status, 404); // el perfil de Uma no es de Ulises
});

await casoAsync('Proxy: las acciones quedan registradas en el log de accesos', async () => {
  const acc = (await http('GET', '/api/admin/accesos', { token: tAdmin })).data.eventos;
  assert.ok(acc.some((e) => e.operacion === 'crear sesión de reproducción' && e.resultado === 'PERMITIDO'));
  assert.ok(acc.some((e) => e.operacion === 'modificar mi perfil de recomendación' && e.resultado === 'PERMITIDO'));
  assert.ok(acc.some((e) => e.operacion === 'recorrer catálogo' && e.resultado === 'DENEGADO'));
});

console.log(`\n🎉 ${ok} comprobaciones OK`);
process.exit(0);
