/**
 * test-observer-state-visitor.js
 * ------------------------------------------------------------------
 * Pruebas de los patrones de comportamiento Observer, State y Visitor.
 * NO necesita PostgreSQL: las pruebas unitarias no usan BD y las de extremo
 * a extremo reemplazan el pool de pg por una BD en memoria (con UPDATE,
 * porque el Observer se dispara al cambiar de plan).
 *
 *     cd backend
 *     npm run test:observer-state-visitor      # los tres patrones
 *     npm run test:observer                    # solo Observer (también :state, :visitor)
 *
 * Por defecto solo se muestran las comprobaciones (✔). Con VERBOSE=1 se
 * ven también los logs que imprimen los patrones por dentro.
 * ------------------------------------------------------------------
 */
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import db from './db/DatabaseSingleton.js';

// ---- infraestructura de la prueba -------------------------------------------------
const filtro = process.argv[2]?.toLowerCase(); // observer | state | visitor
const corre = (patron) => !filtro || filtro === patron;

const logReal = console.log.bind(console);
const VERBOSE = Boolean(process.env.VERBOSE);
const esDePrueba = (m) => m.startsWith('  ✔') || m.startsWith('\n==') || m.startsWith('\n🎉') || m.startsWith('\n❌');
console.log = (...args) => {
  const msg = args.join(' ');
  if (VERBOSE || esDePrueba(msg)) logReal(...args);
};
// Los observadores rotos de las pruebas imprimen su ERROR a propósito (es lo que se está probando): se silencia salvo VERBOSE.
const errorReal = console.error.bind(console);
console.error = (...args) => { if (VERBOSE) errorReal(...args); };

/** Ejecuta fn y devuelve las líneas de consola que imprimió (para comprobar la "huella" del patrón en la consola). */
const capturarConsola = async (fn) => {
  const lineas = [];
  const anterior = console.log;
  console.log = (...args) => lineas.push(args.join(' '));
  try {
    await fn();
  } finally {
    console.log = anterior;
  }
  return lineas;
};

let ok = 0;
const caso = (nombre, fn) => { fn(); ok++; console.log(`  ✔ ${nombre}`); };
const casoAsync = async (nombre, fn) => { await fn(); ok++; console.log(`  ✔ ${nombre}`); };

// ---- BD en memoria (con UPDATE) ---------------------------------------------------
const hash = await bcrypt.hash('clave123', 4);
const planDe = (tipo, calidad, pantallas) => ({ plan_tipo: tipo, precio_mensual: 1, calidad_maxima: calidad, pantallas_simultaneas: pantallas, descargas_offline: false });
const tabla = [
  { id: 1, nombre: 'Ana Admin', correo: 'admin@x.com', password: hash, rol: 'admin', ...planDe('premium', 'Full HD (1080p)', 2) },
  { id: 2, nombre: 'Uma', correo: 'uma@x.com', password: hash, rol: 'usuario', ...planDe('basico', 'HD (720p)', 1) },
  { id: 3, nombre: 'Ulises', correo: 'ulises@x.com', password: hash, rol: 'usuario', ...planDe('free', 'SD (480p)', 1) },
  { id: 4, nombre: 'Greta', correo: 'greta@x.com', password: hash, rol: 'usuario', ...planDe('free', 'SD (480p)', 1) },
];
db.pool.query = async (sql, p = []) => {
  const q = sql.replace(/\s+/g, ' ');
  if (q.startsWith('SELECT * FROM usuarios WHERE correo')) return { rows: tabla.filter((u) => u.correo === p[0]) };
  if (q.startsWith('SELECT * FROM usuarios WHERE id')) return { rows: tabla.filter((u) => u.id === Number(p[0])) };
  if (q.startsWith('UPDATE usuarios SET plan_tipo')) {
    const fila = tabla.find((u) => u.id === Number(p[5]));
    if (!fila) return { rows: [] };
    Object.assign(fila, { plan_tipo: p[0], precio_mensual: p[1], calidad_maxima: p[2], pantallas_simultaneas: p[3], descargas_offline: p[4] });
    return { rows: [fila] };
  }
  throw new Error(`SQL no soportado por la BD falsa: ${q}`);
};

// Imports que usan las pruebas unitarias (después de instalar la BD falsa).
const { default: Observador } = await import('./subscription/observer/Observador.js');
const { default: SujetoPlan } = await import('./subscription/observer/SujetoPlan.js');
const { default: ObservadorNotificacion } = await import('./subscription/observer/ObservadorNotificacion.js');
const { default: ObservadorPlanDRM } = await import('./drm/ObservadorPlanDRM.js');
const { default: ObservadorPlanStreaming } = await import('./streaming/ObservadorPlanStreaming.js');
const { default: SesionesRegistry } = await import('./drm/SesionesRegistry.js');
const { default: AuditoriaLog } = await import('./drm/AuditoriaLog.js');
const { default: SuscripcionServicio } = await import('./services/SuscripcionServicio.js');
const { CambiarPlanCommand } = await import('./commands/UserCommands.js');
const { CommandInvoker } = await import('./commands/CommandInvoker.js');
const { default: RegistroSesiones } = await import('./streaming/mediator/RegistroSesiones.js');
const { default: SesionReproduccion } = await import('./streaming/mediator/SesionReproduccion.js');
const { default: ControlReproduccion } = await import('./streaming/mediator/ControlReproduccion.js');
const { default: ComponenteReproductor } = await import('./streaming/mediator/ComponenteReproductor.js');
const { default: EstadoReproduccion } = await import('./streaming/state/EstadoReproduccion.js');
const { ESTADOS, NOMBRES_ESTADOS } = await import('./streaming/state/estados.js');
const { default: CatalogoService } = await import('./catalog/CatalogoService.js');
const { default: CatalogoServicio } = await import('./services/CatalogoServicio.js');
const { default: VisitanteContenido } = await import('./catalog/visitor/VisitanteContenido.js');
const { default: VisitanteEstadisticas } = await import('./catalog/visitor/VisitanteEstadisticas.js');
const { default: VisitanteAlmacenamiento } = await import('./catalog/visitor/VisitanteAlmacenamiento.js');
const { default: VisitanteExportadorCSV } = await import('./catalog/visitor/VisitanteExportadorCSV.js');
const { crearVisitante, VISITANTES } = await import('./catalog/visitor/crearVisitante.js');
const { default: CalidadVideoFactory } = await import('./flyweight/CalidadVideoFactory.js');
const { default: Pelicula } = await import('./catalog/Pelicula.js');
const { default: Documental } = await import('./catalog/Documental.js');
const { default: Episodio } = await import('./catalog/Episodio.js');
const { default: Temporada } = await import('./catalog/Temporada.js');
const { default: Serie } = await import('./catalog/Serie.js');
const { default: Coleccion } = await import('./catalog/Coleccion.js');

const evento = (extra = {}) => ({ tipo: 'PLAN_CAMBIADO', usuarioId: 1, planAnterior: 'free', planNuevo: 'premium', calidadMaxima: 'Full HD (1080p)', pantallasMaximas: 2, ...extra });

// ====================================================================
if (corre('observer')) {
  console.log('\n== Observer (suscripciones → DRM, Streaming, notificaciones) ==');
  // ==================================================================

  caso('Observador es abstracta y exige actualizar()', () => {
    assert.throws(() => new Observador(), /abstracta/);
    class Incompleto extends Observador {}
    assert.throws(() => new Incompleto().actualizar(evento()), /debe ser implementado/);
  });

  caso('SujetoPlan solo acepta observadores y no duplica al mismo', () => {
    const s = new SujetoPlan();
    assert.throws(() => s.suscribir({ actualizar() {} }), /instancias de Observador/);
    const o = new ObservadorNotificacion();
    s.suscribir(o);
    s.suscribir(o);
    assert.equal(s.cantidad(), 1);
    assert.deepEqual(s.nombresObservadores(), ['ObservadorNotificacion']);
  });

  caso('notificar() entrega el evento a TODOS los observadores, en orden de suscripción', () => {
    const orden = [];
    const crear = (n) => new (class extends Observador { get nombre() { return n; } actualizar() { orden.push(n); return `hecho ${n}`; } })();
    const s = new SujetoPlan();
    ['A', 'B', 'C'].forEach((n) => s.suscribir(crear(n)));
    const r = s.notificar(evento());
    assert.deepEqual(orden, ['A', 'B', 'C']);
    assert.deepEqual(r.traza.map((t) => [t.observador, t.estado, t.detalle]), [['A', 'OK', 'hecho A'], ['B', 'OK', 'hecho B'], ['C', 'OK', 'hecho C']]);
  });

  caso('desuscribir(): el observador deja de recibir eventos (y suscribir() devuelve la baja)', () => {
    const recibidos = [];
    const o = new (class extends Observador { actualizar() { recibidos.push(1); } })();
    const s = new SujetoPlan();
    const baja = s.suscribir(o);
    s.notificar(evento());
    assert.equal(baja(), true);
    s.notificar(evento());
    assert.equal(recibidos.length, 1);
    assert.equal(s.desuscribir(o), false); // ya no estaba
  });

  caso('un observador puede darse de baja mientras recibe el evento sin romper a los demás', () => {
    const s = new SujetoPlan();
    const vistos = [];
    const unaVez = new (class extends Observador { actualizar() { s.desuscribir(this); vistos.push('unaVez'); } })();
    const otro = new (class extends Observador { actualizar() { vistos.push('otro'); } })();
    s.suscribir(unaVez);
    s.suscribir(otro);
    s.notificar(evento());
    s.notificar(evento());
    assert.deepEqual(vistos, ['unaVez', 'otro', 'otro']);
  });

  caso('aislamiento: si un observador falla, los demás se enteran igual y notificar() no lanza', () => {
    const s = new SujetoPlan();
    let llego = false;
    s.suscribir(new (class Roto extends Observador { actualizar() { throw new Error('se cayó'); } })());
    s.suscribir(new (class Sano extends Observador { actualizar() { llego = true; return 'bien'; } })());
    const r = s.notificar(evento());
    assert.equal(llego, true);
    assert.deepEqual(r.traza.map((t) => `${t.observador}:${t.estado}`), ['Roto:ERROR', 'Sano:OK']);
    assert.equal(r.traza[0].detalle, 'se cayó');
  });

  caso('el evento llega CONGELADO: un observador no puede alterar lo que verán los demás', () => {
    const s = new SujetoPlan();
    let visto;
    s.suscribir(new (class Malo extends Observador { actualizar(e) { e.planNuevo = 'hackeado'; } })());
    s.suscribir(new (class Bueno extends Observador { actualizar(e) { visto = e.planNuevo; } })());
    const r = s.notificar(evento());
    assert.equal(r.traza[0].estado, 'ERROR');
    assert.equal(visto, 'premium');
  });

  caso('historialDe(): separa por usuario, conserva el orden y deja la traza de cada notificación', () => {
    const s = new SujetoPlan();
    s.suscribir(new ObservadorNotificacion());
    s.notificar(evento({ usuarioId: 1, planNuevo: 'a' }));
    s.notificar(evento({ usuarioId: 2, planNuevo: 'b' }));
    s.notificar(evento({ usuarioId: 1, planNuevo: 'c' }));
    const h = s.historialDe(1);
    assert.deepEqual(h.map((e) => e.planNuevo), ['a', 'c']);
    assert.ok(h[0].fecha && h[0].n < h[1].n && h[0].traza.length === 1);
    assert.equal(s.historialDe(99).length, 0);
  });

  caso('SesionesRegistry.limitar(): libera las pantallas MÁS ANTIGUAS y deja las recientes', () => {
    SesionesRegistry.registrar(500, 'tv', 'c1');
    SesionesRegistry.registrar(500, 'tablet', 'c2');
    SesionesRegistry.registrar(500, 'celular', 'c3');
    const liberadas = SesionesRegistry.limitar(500, 1);
    assert.deepEqual(liberadas.map((s) => s.dispositivoId), ['tv', 'tablet']);
    assert.deepEqual(SesionesRegistry.activas(500).map((s) => s.dispositivoId), ['celular']);
    assert.deepEqual(SesionesRegistry.limitar(500, 1), []); // ya no sobra nada
  });

  caso('ObservadorPlanDRM: al bajar de plan libera pantallas y deja REVOCADA en la auditoría DRM', () => {
    ['d1', 'd2', 'd3'].forEach((d) => SesionesRegistry.registrar(501, d, 'ambar'));
    const antes = AuditoriaLog.eventos.length;
    const detalle = new ObservadorPlanDRM().actualizar(evento({ usuarioId: 501, pantallasMaximas: 1 }));
    assert.match(detalle, /Liberó 2 pantalla\(s\)/);
    assert.deepEqual(SesionesRegistry.activas(501).map((s) => s.dispositivoId), ['d3']);
    const nuevas = AuditoriaLog.eventos.slice(antes);
    assert.equal(nuevas.length, 2);
    assert.ok(nuevas.every((e) => e.resultado === 'REVOCADA' && e.motivo === 'CAMBIO_DE_PLAN' && e.usuarioId === 501));
    assert.match(new ObservadorPlanDRM().actualizar(evento({ usuarioId: 501, pantallasMaximas: 4 })), /Sin sesiones de más/); // subir de plan no libera nada
  });

  const nuevaSesion = (usuarioId, techoCalidad, anchoBandaKbps = 50000) => {
    const sesion = new SesionReproduccion({ contenido: { id: 'ambar', titulo: 'Ámbar', duracionMin: 134 }, techoCalidad, anchoBandaKbps });
    RegistroSesiones.crear(sesion, usuarioId);
    return sesion;
  };

  caso('ObservadorPlanStreaming: al bajar de plan, la sesión abierta baja el techo Y la calidad al instante', () => {
    const s1 = nuevaSesion(600, '1080p');
    const s2 = nuevaSesion(600, '1080p');
    const ajena = nuevaSesion(601, '1080p');
    assert.equal(s1.estado().calidad.actual, '1080p');
    const detalle = new ObservadorPlanStreaming().actualizar(evento({ usuarioId: 600, calidadMaxima: 'SD (480p)' }));
    assert.match(detalle, /2 sesión\(es\) con techo 480p; 2 cambiaron de calidad/);
    for (const s of [s1, s2]) {
      assert.equal(s.estado().calidad.techoPlan, '480p');
      assert.equal(s.estado().calidad.actual, '480p');
      const evs = s.bitacora().map((e) => e.evento);
      assert.ok(evs.includes('TECHO_CAMBIO') && evs.filter((e) => e === 'CALIDAD_CAMBIO').length >= 2);
    }
    assert.equal(ajena.estado().calidad.techoPlan, '1080p'); // la sesión de otro usuario no se toca
  });

  caso('ObservadorPlanStreaming: al subir de plan la calidad NO salta: sube de a un escalón con buffer suficiente', () => {
    const s = nuevaSesion(602, '480p');
    assert.equal(s.estado().calidad.actual, '480p');
    new ObservadorPlanStreaming().actualizar(evento({ usuarioId: 602, calidadMaxima: 'Full HD (1080p)' }));
    assert.equal(s.estado().calidad.techoPlan, '1080p');
    assert.equal(s.estado().calidad.actual, '480p'); // buffer vacío: la subida se pospone
    assert.ok(s.bitacora().some((e) => e.evento === 'SUBIDA_POSPUESTA'));
    s.avanzar(30);
    const cambios = s.bitacora().filter((e) => e.evento === 'CALIDAD_CAMBIO').map((e) => `${e.datos.de}→${e.datos.a}`);
    assert.deepEqual(cambios.slice(-2), ['480p→720p', '720p→1080p']);
  });

  caso('ObservadorPlanStreaming: un usuario sin sesiones abiertas no es un error', () => {
    assert.match(new ObservadorPlanStreaming().actualizar(evento({ usuarioId: 99999 })), /no tiene sesiones/);
  });

  caso('ObservadorNotificacion: guarda el aviso en la bandeja del usuario', () => {
    const o = new ObservadorNotificacion();
    const detalle = o.actualizar(evento({ usuarioId: 7 }));
    assert.match(detalle, /Aviso enviado/);
    assert.match(o.enviadosA(7)[0].aviso, /"free" a "premium"/);
    assert.equal(o.enviadosA(8).length, 0);
  });

  // ---- SuscripcionServicio como SUJETO (usa la BD falsa) ----
  const espia = () => { const recibidos = []; return { recibidos, obs: new (class Espia extends Observador { actualizar(e) { recibidos.push(e); return 'ok'; } })() }; };

  await casoAsync('SuscripcionServicio avisa PLAN_CAMBIADO con el plan anterior y el nuevo', async () => {
    const { recibidos, obs } = espia();
    const sujeto = new SujetoPlan();
    sujeto.suscribir(obs);
    const svc = new SuscripcionServicio({ sujeto });
    const user = await svc.cambiarPlan(3, 'familiar');
    assert.equal(user.planTipo, 'familiar');
    assert.equal(recibidos.length, 1);
    assert.deepEqual(
      { t: recibidos[0].tipo, u: recibidos[0].usuarioId, a: recibidos[0].planAnterior, n: recibidos[0].planNuevo, p: recibidos[0].pantallasMaximas },
      { t: 'PLAN_CAMBIADO', u: 3, a: 'free', n: 'familiar', p: 4 }
    );
    await svc.cambiarPlan(3, 'free'); // deja a Ulises como estaba
  });

  await casoAsync('no se avisa si el plan no cambia, ni si el cambio falla (plan inexistente / usuario inexistente)', async () => {
    const { recibidos, obs } = espia();
    const sujeto = new SujetoPlan();
    sujeto.suscribir(obs);
    const svc = new SuscripcionServicio({ sujeto });
    await svc.cambiarPlan(3, 'free'); // ya es free
    await assert.rejects(() => svc.cambiarPlan(3, 'platino'), /inválido/);
    await assert.rejects(() => svc.cambiarPlan(999, 'premium'), /no encontrado/);
    assert.equal(recibidos.length, 0);
  });

  await casoAsync('un observador roto NO revierte el cambio de plan', async () => {
    const sujeto = new SujetoPlan();
    sujeto.suscribir(new (class Roto extends Observador { actualizar() { throw new Error('boom'); } })());
    const svc = new SuscripcionServicio({ sujeto });
    const user = await svc.cambiarPlan(4, 'premium');
    assert.equal(user.planTipo, 'premium');
    assert.equal(tabla.find((u) => u.id === 4).plan_tipo, 'premium'); // quedó guardado
    assert.equal(sujeto.historialDe(4)[0].traza[0].estado, 'ERROR');
    await svc.cambiarPlan(4, 'free');
  });

  await casoAsync('Observer + Command: cambiar el plan Y deshacerlo notifican (ambos pasan por cambiarPlan)', async () => {
    const { recibidos, obs } = espia();
    const sujeto = new SujetoPlan();
    sujeto.suscribir(obs);
    const svc = new SuscripcionServicio({ sujeto });
    const invoker = new CommandInvoker();
    await invoker.ejecutarComando(new CambiarPlanCommand(svc, 3, 'premium'), 3);
    await invoker.deshacerUltimoComando(3);
    assert.deepEqual(recibidos.map((e) => `${e.planAnterior}→${e.planNuevo}`), ['free→premium', 'premium→free']);
  });

  await casoAsync('huella en la CONSOLA: el sujeto y cada observador imprimen lo que hacen', async () => {
    const sujeto = new SujetoPlan();
    sujeto.suscribir(new ObservadorNotificacion());
    const svc = new SuscripcionServicio({ sujeto });
    const lineas = await capturarConsola(() => svc.cambiarPlan(4, 'basico'));
    assert.ok(lineas.some((l) => l.includes('[Observer] PLAN_CAMBIADO usuario=4 free → basico')));
    assert.ok(lineas.some((l) => l.includes('[Observer:ObservadorNotificacion]')));
    await svc.cambiarPlan(4, 'free');
  });
}

// ====================================================================
if (corre('state')) {
  console.log('\n== State (streaming adaptativo: estado del reproductor) ==');
  // ==================================================================

  const nuevoControl = (duracionSeg = 600) => {
    const c = new ControlReproduccion(duracionSeg);
    c.eventos = [];
    // Mediador de mentira: solo anota lo que el control emite (el control funciona aislado).
    c.setMediador({ notificar: (emisor, ev, datos) => c.eventos.push({ ev, datos }) });
    return c;
  };
  /** Lleva un control nuevo hasta el estado pedido usando solo eventos reales. */
  const en = (estado) => {
    const c = nuevoControl();
    if (estado === 'cargando') c.ordenarReproducir({ bufferSuficiente: false });
    if (estado === 'reproduciendo') c.ordenarReproducir({ bufferSuficiente: true });
    if (estado === 'pausado') { c.ordenarReproducir({ bufferSuficiente: true }); c.ordenarPausa(); }
    assert.equal(c.estado, estado);
    c.eventos.length = 0;
    return c;
  };

  caso('EstadoReproduccion es abstracta y hay exactamente 4 estados', () => {
    assert.throws(() => new EstadoReproduccion(), /abstracta/);
    assert.deepEqual(NOMBRES_ESTADOS, ['detenido', 'cargando', 'reproduciendo', 'pausado']);
    assert.ok(Object.values(ESTADOS).every((e) => e instanceof EstadoReproduccion));
  });

  caso('los estados no guardan datos: una sola instancia compartida por todas las sesiones', () => {
    assert.ok(Object.values(ESTADOS).every((e) => Object.keys(e).length === 0));
    const a = new ControlReproduccion(60); const b = new ControlReproduccion(60);
    a.ordenarReproducir({ bufferSuficiente: true });
    assert.equal(a.estado, 'reproduciendo');
    assert.equal(b.estado, 'detenido'); // el estado de una sesión no contamina a otra
  });

  // Tabla completa de transiciones: [estado de partida, evento, resultado esperado, ¿ignorado?]
  const TABLA = [
    ['detenido', 'reproducir (sin buffer)', 'cargando', false],
    ['detenido', 'reproducir (con buffer)', 'reproduciendo', false],
    ['detenido', 'pausar', 'detenido', true],
    ['detenido', 'bufferRecuperado', 'detenido', false],
    ['cargando', 'reproducir (sin buffer)', 'cargando', true],
    ['cargando', 'pausar', 'pausado', false],
    ['cargando', 'bufferRecuperado', 'reproduciendo', false],
    ['reproduciendo', 'reproducir (con buffer)', 'reproduciendo', true],
    ['reproduciendo', 'pausar', 'pausado', false],
    ['reproduciendo', 'bufferVacio', 'cargando', false],
    ['reproduciendo', 'finContenido', 'detenido', false],
    ['pausado', 'reproducir (con buffer)', 'reproduciendo', false],
    ['pausado', 'reproducir (sin buffer)', 'cargando', false],
    ['pausado', 'pausar', 'pausado', true],
    ['pausado', 'bufferRecuperado', 'pausado', false], // pausado NO reanuda solo
    ['pausado', 'bufferVacio', 'pausado', false],
  ];
  const aplicar = (c, accion) => {
    const [nombre, buf] = accion.split(' ');
    if (nombre === 'reproducir') c.ordenarReproducir({ bufferSuficiente: buf === '(con' });
    else if (nombre === 'pausar') c.ordenarPausa();
    else if (nombre === 'bufferVacio') c.ordenarBufferVacio();
    else if (nombre === 'bufferRecuperado') c.ordenarBufferRecuperado();
    else if (nombre === 'finContenido') c.ordenarFin();
  };
  for (const [desde, accion, hasta, ignorado] of TABLA) {
    caso(`transición: ${desde} + ${accion} → ${hasta}${ignorado ? ' (ignorada y anotada)' : ''}`, () => {
      const c = en(desde);
      aplicar(c, accion);
      assert.equal(c.estado, hasta);
      assert.equal(c.eventos.some((e) => e.ev === 'TRANSICION_IGNORADA'), ignorado);
      assert.equal(c.eventos.some((e) => e.ev === 'ESTADO_CAMBIO'), desde !== hasta);
    });
  }

  caso('ESTADO_CAMBIO dice de dónde, a dónde y por qué; TRANSICION_IGNORADA dice qué sí se podía hacer', () => {
    const c = en('reproduciendo');
    c.ordenarBufferVacio();
    assert.deepEqual(c.eventos[0], { ev: 'ESTADO_CAMBIO', datos: { de: 'reproduciendo', a: 'cargando', motivo: 'el buffer se vació' } });
    const d = en('detenido');
    d.ordenarPausa();
    assert.deepEqual(d.eventos[0].datos, { estado: 'detenido', evento: 'PAUSA', permitidas: ['reproducir', 'buscar'] });
  });

  caso('accionesPermitidas() cambia con el estado', () => {
    assert.deepEqual(en('detenido').accionesPermitidas(), ['reproducir', 'buscar']);
    assert.deepEqual(en('cargando').accionesPermitidas(), ['pausar', 'buscar']);
    assert.deepEqual(en('reproduciendo').accionesPermitidas(), ['pausar', 'buscar']);
    assert.deepEqual(en('pausado').accionesPermitidas(), ['reproducir', 'buscar']);
  });

  caso('solo "reproduciendo" avanza el tiempo; "cargando" y "pausado" quieren/no quieren ver el video según el caso', () => {
    assert.deepEqual(NOMBRES_ESTADOS.map((n) => ESTADOS[n].reproduce), [false, false, true, false]);
    assert.deepEqual(NOMBRES_ESTADOS.map((n) => ESTADOS[n].quiereReproducir), [false, true, true, false]);
  });

  caso('el estado "detenido" no conoce la posición ni el buffer: solo decide el estado al que pasa', () => {
    const c = en('reproduciendo');
    c.avanzar(10_000); // llega al final
    c.ordenarFin();
    assert.equal(c.estado, 'detenido');
    c.ordenarReproducir({ bufferSuficiente: false });
    assert.equal(c.estado, 'cargando');
    assert.equal(c.posicionSeg, c.duracionSeg); // la posición la maneja el mediador, no el estado
  });

  caso('transicionarA() rechaza estados que no existen', () => {
    assert.throws(() => nuevoControl().transicionarA('volando'), /desconocido/);
  });

  const nuevaSesionState = () => new SesionReproduccion({ contenido: { id: 'ambar', titulo: 'Ámbar', duracionMin: 134 }, techoCalidad: '1080p', anchoBandaKbps: 50000 });
  const nombresEv = (s, desde = 0) => s.bitacora({ desdeN: desde }).map((e) => e.evento);

  caso('Mediator + State: el mediador decide CUÁNDO; el estado decide QUÉ pasa (ciclo completo)', () => {
    const s = nuevaSesionState();
    assert.equal(s.estado().reproduccion.estado, 'detenido');
    let n = s.ultimaSecuencia; s.pausar();
    assert.equal(s.estado().reproduccion.estado, 'detenido'); // pausar un video detenido no hace nada
    assert.ok(nombresEv(s, n).includes('TRANSICION_IGNORADA'));
    n = s.ultimaSecuencia; s.reproducir();
    assert.equal(s.estado().reproduccion.estado, 'cargando');
    s.reproducir(); // otro play mientras carga: ignorado
    assert.equal(s.estado().reproduccion.estado, 'cargando');
    s.avanzar(10);
    assert.equal(s.estado().reproduccion.estado, 'reproduciendo');
    s.pausar();
    s.avanzar(5);
    assert.equal(s.estado().reproduccion.estado, 'pausado'); // el buffer se llena pero NO reanuda solo
    const pos = s.estado().reproduccion.posicionSeg;
    s.avanzar(5);
    assert.equal(s.estado().reproduccion.posicionSeg, pos); // pausado: el tiempo no avanza
    s.reproducir();
    assert.equal(s.estado().reproduccion.estado, 'reproduciendo'); // con buffer lleno: directo, sin pasar por "cargando"
  });

  caso('Mediator + State: buscar desde "reproduciendo" vacía el buffer y el estado pasa a "cargando"; luego reanuda solo', () => {
    const s = nuevaSesionState();
    s.reproducir(); s.avanzar(10);
    const n = s.ultimaSecuencia;
    s.buscar(3000);
    assert.equal(s.estado().reproduccion.estado, 'cargando');
    const cambios = s.bitacora({ desdeN: n }).filter((e) => e.evento === 'ESTADO_CAMBIO').map((e) => `${e.datos.de}→${e.datos.a}`);
    assert.deepEqual(cambios, ['reproduciendo→cargando']);
    s.avanzar(10);
    assert.equal(s.estado().reproduccion.estado, 'reproduciendo');
  });

  caso('Mediator + State: al terminar el contenido pasa a "detenido" y estado() informa las acciones permitidas', () => {
    const s = nuevaSesionState();
    s.reproducir(); s.avanzar(10);
    s.buscar(8035); s.avanzar(30);
    assert.equal(s.estado().reproduccion.estado, 'detenido');
    assert.deepEqual(s.estado().reproduccion.accionesPermitidas, ['reproducir', 'buscar']);
  });

  caso('Mediator + State: dar PLAY a un video terminado lo reinicia (posición 0, buffer vacío, calidad más baja)', () => {
    const s = nuevaSesionState();
    s.reproducir(); s.avanzar(10); s.buscar(8035); s.avanzar(30);
    assert.equal(s.estado().reproduccion.estado, 'detenido');
    assert.ok(s.estado().buffer.segundos > 0); // quedan segundos del FINAL del video en el buffer
    s.reproducir();
    const e = s.estado();
    assert.equal(e.reproduccion.posicionSeg, 0);
    assert.equal(e.buffer.segundos, 0); // ese buffer ya no sirve en otra posición
    assert.equal(e.calidad.actual, '360p');
    assert.equal(e.reproduccion.estado, 'cargando'); // y por eso NO arranca directo: espera buffer nuevo
  });

  caso('los colegas SIGUEN sin referenciarse entre sí (State no rompió el Mediator)', () => {
    const s = nuevaSesionState();
    for (const c of [s.red, s.calidad, s.buffer, s.control, s.pistas]) {
      const refs = Object.entries(c).filter(([k, v]) => k !== 'mediador' && v instanceof ComponenteReproductor);
      assert.deepEqual(refs, []);
    }
  });

  await casoAsync('huella en la CONSOLA: cada transición imprime "[State] de → a (motivo)"', async () => {
    const s = nuevaSesionState();
    const lineas = await capturarConsola(() => { s.pausar(); s.reproducir(); s.avanzar(10); });
    assert.ok(lineas.some((l) => l.includes('[State] "PAUSA" ignorado en estado detenido')));
    assert.ok(lineas.some((l) => l.includes('[State] detenido → cargando')));
    assert.ok(lineas.some((l) => l.includes('[State] cargando → reproduciendo')));
  });
}

// ====================================================================
if (corre('visitor')) {
  console.log('\n== Visitor (gestión de contenido: reportes sobre el catálogo) ==');
  // ==================================================================
  const silencio = (fn) => { const a = console.log; console.log = () => {}; try { return fn(); } finally { console.log = a; } };
  const raiz = CatalogoService.raiz;
  const serie = CatalogoService.buscar('horizonte-nocturno');
  const recorrer = (nodo, v) => { nodo.aceptar(v); return v.resultado(); };

  /** Visitante que solo anota QUÉ método se llamó con QUÉ nodo (para probar el doble despacho). */
  class Espia extends VisitanteContenido {
    llamadas = [];
    visitarPelicula(n) { this.llamadas.push(['visitarPelicula', n.id]); }
    visitarDocumental(n) { this.llamadas.push(['visitarDocumental', n.id]); }
    visitarEpisodio(n) { this.llamadas.push(['visitarEpisodio', n.id]); }
    visitarTemporada(n) { this.llamadas.push(['visitarTemporada', n.id]); }
    visitarSerie(n) { this.llamadas.push(['visitarSerie', n.id]); }
    visitarColeccion(n) { this.llamadas.push(['visitarColeccion', n.id]); }
    resultado() { return this.llamadas; }
  }

  caso('VisitanteContenido es abstracta', () => {
    assert.throws(() => new VisitanteContenido(), /abstracta/);
    class Sin extends VisitanteContenido {}
    assert.throws(() => new Sin().resultado(), /debe ser implementado/);
  });

  caso('doble despacho: cada tipo de nodo llama al método de visitante que le corresponde', () => {
    const casos = [
      [new Pelicula('p', 'P', 90), 'visitarPelicula'],
      [new Documental('d', 'D', 50), 'visitarDocumental'],
      [new Episodio('e', 'E', 1, 40), 'visitarEpisodio'],
      [new Temporada('t', 'T'), 'visitarTemporada'],
      [new Serie('s', 'S'), 'visitarSerie'],
      [new Coleccion('c', 'C'), 'visitarColeccion'],
    ];
    for (const [nodo, metodo] of casos) {
      const v = new Espia();
      nodo.aceptar(v);
      assert.deepEqual(v.llamadas, [[metodo, nodo.id]], `${nodo.tipo()} debe llamar a ${metodo}`);
    }
  });

  caso('un Documental HEREDA de Película pero se despacha como documental (no como película)', () => {
    const v = new Espia();
    new Documental('d', 'D', 50).aceptar(v);
    assert.equal(v.llamadas[0][0], 'visitarDocumental');
  });

  caso('un ElementoContenido sin aceptar() falla con un mensaje claro (el contrato del Visitor)', () => {
    // El aceptar() de la clase base (ElementoContenido) es abstracto: una subclase que no lo implemente falla de forma explícita.
    assert.throws(() => Pelicula.prototype.__proto__.aceptar.call(new Pelicula('r', 'R', 10), new Espia()), /aceptar\(\) debe ser implementado/);
  });

  caso('el VISITANTE controla el recorrido: sin descender solo ve la serie; por defecto los grupos recorren a sus hijos con su nivel', () => {
    const v = new Espia();
    serie.aceptar(v);
    // Espia sobrescribe visitarSerie sin descender, así que solo ve la serie:
    assert.deepEqual(v.llamadas, [['visitarSerie', 'horizonte-nocturno']]);
    // Un visitante que no sobrescribe visitarGrupo SÍ desciende:
    class SoloEpisodios extends VisitanteContenido { ids = []; visitarEpisodio(n) { this.ids.push(`${this.nivel}:${n.id}`); this.nodosVisitados++; } resultado() { return this.ids; } }
    const ids = recorrer(serie, new SoloEpisodios());
    assert.equal(ids.length, 8);
    assert.equal(ids[0], '2:horizonte-nocturno-t1-e1'); // serie(0) → temporada(1) → episodio(2)
  });

  caso('agregar una operación NUEVA no toca los nodos: basta una clase visitante', () => {
    class CuentaEpisodiosLargos extends VisitanteContenido {
      total = 0;
      visitarEpisodio(n) { if (n.getDuracion() >= 50) this.total++; }
      resultado() { return this.total; }
    }
    assert.equal(recorrer(serie, new CuentaEpisodiosLargos()), 8); // 8 episodios de 52 min
    assert.equal(recorrer(CatalogoService.buscar('reino-de-papel'), new CuentaEpisodiosLargos()), 0); // de 25 min
  });

  caso('Estadísticas == Composite: duración total y reproducibles coinciden con getDuracion() y obtenerReproducibles()', () => {
    const r = silencio(() => recorrer(raiz, new VisitanteEstadisticas()));
    assert.equal(r.duracionTotalMin, raiz.getDuracion());
    assert.equal(r.reproducibles, silencio(() => raiz.obtenerReproducibles().length));
    assert.equal(r.porTipo.episodio + r.porTipo.pelicula + r.porTipo.documental, r.reproducibles);
  });

  caso('Estadísticas + Iterator: nodos visitados == nodos que recorre el iterador en profundidad', () => {
    const r = recorrer(raiz, new VisitanteEstadisticas());
    assert.equal(r.nodosVisitados, [...raiz.crearIterador('profundidad')].length);
    assert.equal(Object.values(r.porTipo).reduce((a, b) => a + b, 0), r.nodosVisitados);
  });

  caso('Estadísticas de una serie: 1 serie, 2 temporadas, 8 episodios, 416 min, nivel máximo 2', () => {
    const r = recorrer(serie, new VisitanteEstadisticas());
    assert.deepEqual(r.porTipo, { coleccion: 0, serie: 1, temporada: 2, episodio: 8, pelicula: 0, documental: 0 });
    assert.equal(r.duracionTotalMin, 416);
    assert.equal(r.duracionTexto, '6h 56m');
    assert.equal(r.profundidadMaxima, 2);
    assert.deepEqual(r.titulosPorGenero, { accion: 1, thriller: 1 });
  });

  caso('Estadísticas sobre una HOJA: el mismo visitante sirve para un solo nodo', () => {
    const r = recorrer(CatalogoService.buscar('ambar'), new VisitanteEstadisticas());
    assert.equal(r.nodosVisitados, 1);
    assert.equal(r.masLargo.id, 'ambar');
    assert.equal(r.duracionTotalMin, 134);
  });

  caso('Almacenamiento usa los bitrates del Flyweight: 1080p pesa 6,25 veces más que 360p', () => {
    const r = recorrer(raiz, new VisitanteAlmacenamiento());
    assert.deepEqual(Object.keys(r.calidades), ['360p', '480p', '720p', '1080p']);
    assert.equal(r.calidades['1080p'].bitrateKbps, CalidadVideoFactory.obtener('1080p').bitrateKbps);
    assert.ok(Math.abs(r.calidades['1080p'].gb / r.calidades['360p'].gb - 6.25) < 0.01);
    assert.equal(r.duracionTotalMin, raiz.getDuracion());
  });

  caso('Almacenamiento: fórmula exacta (Ámbar, 134 min a 1080p ≈ 5,03 GB) y calidades elegidas', () => {
    const r = recorrer(CatalogoService.buscar('ambar'), new VisitanteAlmacenamiento({ calidades: ['720p', '1080p'] }));
    assert.deepEqual(Object.keys(r.calidades), ['720p', '1080p']);
    assert.ok(Math.abs(r.calidades['1080p'].gb - 5.025) < 0.01);
    assert.equal(r.masPesado.id, 'ambar');
  });

  caso('Almacenamiento no crea calidades nuevas: reutiliza las instancias del Flyweight', () => {
    const antes = CalidadVideoFactory.estadisticas().instanciasCreadas;
    silencio(() => { recorrer(raiz, new VisitanteAlmacenamiento()); recorrer(serie, new VisitanteAlmacenamiento()); });
    assert.equal(CalidadVideoFactory.estadisticas().instanciasCreadas, Math.max(antes, 4));
  });

  caso('Almacenamiento: calidad inexistente o lista vacía → error claro', () => {
    assert.throws(() => new VisitanteAlmacenamiento({ calidades: ['9999p'] }), /Calidad desconocida/);
    assert.throws(() => new VisitanteAlmacenamiento({ calidades: [] }), /al menos una calidad/);
  });

  caso('CSV: una fila por nodo, en preorden y con el nivel de cada uno', () => {
    const r = recorrer(serie, new VisitanteExportadorCSV());
    const filas = r.csv.split('\n');
    assert.equal(filas[0], 'nivel,tipo,id,titulo,duracionMin,generos');
    assert.equal(r.filas, 11); // serie + 2 temporadas + 8 episodios
    assert.equal(filas.length, r.filas + 1);
    assert.deepEqual(filas.slice(1, 4).map((f) => f.split(',')[0]), ['0', '1', '2']);
    assert.equal(filas[1], '0,serie,horizonte-nocturno,"Horizonte Nocturno",416,"thriller|accion"');
  });

  caso('CSV escapa comillas y comas dentro de los textos (RFC 4180)', () => {
    const p = new Pelicula('x', 'Dijo "hola", y se fue', 90, ['a', 'b']);
    const r = recorrer(p, new VisitanteExportadorCSV());
    assert.equal(r.csv.split('\n')[1], '0,pelicula,x,"Dijo ""hola"", y se fue",90,"a|b"');
  });

  caso('los TRES visitantes recorren exactamente los mismos nodos', () => {
    const cuentas = Object.keys(VISITANTES).map((n) => silencio(() => recorrer(raiz, crearVisitante(n)).nodosVisitados));
    assert.equal(new Set(cuentas).size, 1);
    assert.equal(cuentas[0], 101);
  });

  caso('crearVisitante(): nombre inválido → error que lista los válidos', () => {
    assert.throws(() => crearVisitante('xml'), /Válidos: estadisticas, almacenamiento, csv/);
  });

  const servicio = new CatalogoServicio();
  caso('CatalogoServicio.reporte(): por defecto estadísticas del catálogo completo; errores 404 y 400 claros', () => {
    const r = silencio(() => servicio.reporte());
    assert.equal(r.raiz, 'catalogo');
    assert.equal(r.visitante, 'estadisticas');
    assert.throws(() => servicio.reporte({ id: 'no-existe' }), (e) => e.status === 404);
    assert.throws(() => servicio.reporte({ visitante: 'xml' }), (e) => e.status === 400);
    assert.throws(() => servicio.reporte({ visitante: 'almacenamiento', calidades: '720p,7p' }), (e) => e.status === 400);
    assert.deepEqual(Object.keys(silencio(() => servicio.reporte({ visitante: 'almacenamiento', calidades: ' 720p , 1080p ' })).calidades), ['720p', '1080p']);
  });

  await casoAsync('huella en la CONSOLA: cada reporte imprime "[Visitor] <clase> recorrió N nodo(s)"', async () => {
    const lineas = await capturarConsola(() => servicio.reporte({ id: 'horizonte-nocturno', visitante: 'csv' }));
    assert.ok(lineas.some((l) => l.includes('[Visitor] VisitanteExportadorCSV recorrió 11 nodo(s) desde "horizonte-nocturno"')));
  });
}

// ====================================================================
console.log('\n== Extremo a extremo por HTTP (Proxy + Observer + State + Visitor) ==');
// ====================================================================
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
const [tAdmin, tUma, tUlises, tGreta] = [await login('admin@x.com'), await login('uma@x.com'), await login('ulises@x.com'), await login('greta@x.com')];

if (corre('observer')) {
  await casoAsync('Observer por HTTP: bajar de plan libera pantallas DRM, baja la calidad de la sesión y avisa al usuario', async () => {
    assert.equal((await http('PUT', '/api/usuarios/2/plan', { token: tUma, body: { tipoPlan: 'familiar' } })).status, 200); // 4 pantallas, techo 1080p
    for (const dispositivoId of ['tv-sala', 'tablet']) {
      const lic = await http('POST', '/api/stream/autorizar', { token: tUma, body: { contenidoId: 'ambar', dispositivoId, pais: 'CO' } });
      assert.equal(lic.status, 200, `autorizar ${dispositivoId}: ${JSON.stringify(lic.data)}`);
    }
    const ses = await http('POST', '/api/stream/sesion', { token: tUma, body: { contenidoId: 'ambar', anchoBandaKbps: 50000 } });
    assert.equal(ses.data.estado.calidad.actual, '1080p');
    const sesionId = ses.data.sesionId;

    const bajar = await http('PUT', '/api/usuarios/2/plan', { token: tUma, body: { tipoPlan: 'free' } });
    assert.equal(bajar.status, 200);

    // DRM: de 2 pantallas quedó 1 (el plan free permite 1). "detener" de una sesión inexistente solo informa cuántas hay.
    const detener = await http('POST', '/api/stream/detener', { token: tUma, body: { sesionId: 'SES-no-existe' } });
    assert.equal(detener.data.pantallasEnUso, 1);
    // Streaming: la sesión ya no pasa de 480p, ni de techo ni de calidad actual.
    const estado = (await http('GET', `/api/stream/sesion/${sesionId}`, { token: tUma })).data;
    assert.equal(estado.estado.calidad.techoPlan, '480p');
    assert.equal(estado.estado.calidad.actual, '480p');
    assert.ok(estado.eventos.some((e) => e.evento === 'TECHO_CAMBIO'));

    // Traza: qué hizo cada observador.
    const { observadores, eventos } = (await http('GET', '/api/usuarios/2/plan/eventos', { token: tUma })).data;
    assert.deepEqual(observadores, ['ObservadorPlanDRM', 'ObservadorPlanStreaming', 'ObservadorNotificacion']);
    const ultimo = eventos.at(-1);
    assert.equal(`${ultimo.planAnterior}→${ultimo.planNuevo}`, 'familiar→free');
    assert.deepEqual(ultimo.traza.map((t) => t.estado), ['OK', 'OK', 'OK']);
    assert.match(ultimo.traza[0].detalle, /Liberó 1 pantalla/);
    assert.match(ultimo.traza[1].detalle, /1 sesión\(es\) con techo 480p/);
    assert.match(ultimo.traza[2].detalle, /Aviso enviado/);

    // La auditoría DRM registra la revocación.
    const aud = (await http('GET', '/api/stream/auditoria', { token: tAdmin })).data.eventos;
    assert.ok(aud.some((e) => e.resultado === 'REVOCADA' && e.motivo === 'CAMBIO_DE_PLAN' && e.usuarioId === 2));
    await http('DELETE', `/api/stream/sesion/${sesionId}`, { token: tUma });
  });

  await casoAsync('Observer por HTTP: un cambio inválido (plan inexistente) no notifica a nadie', async () => {
    const antes = (await http('GET', '/api/usuarios/2/plan/eventos', { token: tUma })).data.eventos.length;
    assert.equal((await http('PUT', '/api/usuarios/2/plan', { token: tUma, body: { tipoPlan: 'platino' } })).status, 400);
    assert.equal((await http('GET', '/api/usuarios/2/plan/eventos', { token: tUma })).data.eventos.length, antes);
  });

  await casoAsync('Observer + Command por HTTP: deshacer el cambio de plan también notifica', async () => {
    const antes = (await http('GET', '/api/usuarios/4/plan/eventos', { token: tGreta })).data.eventos.length;
    await http('PUT', '/api/usuarios/4/plan', { token: tGreta, body: { tipoPlan: 'premium' } });
    const und = await http('POST', '/api/usuarios/4/plan/deshacer', { token: tGreta });
    assert.equal(und.data.user.planTipo, 'free');
    const evs = (await http('GET', '/api/usuarios/4/plan/eventos', { token: tGreta })).data.eventos;
    assert.deepEqual(evs.slice(antes).map((e) => `${e.planAnterior}→${e.planNuevo}`), ['free→premium', 'premium→free']);
  });

  await casoAsync('Observer por HTTP: permisos del Proxy (sin sesión 401, el plan ajeno 403, admin sí)', async () => {
    assert.equal((await http('GET', '/api/usuarios/2/plan/eventos')).status, 401);
    assert.equal((await http('GET', '/api/usuarios/2/plan/eventos', { token: tUlises })).status, 403);
    assert.equal((await http('GET', '/api/usuarios/2/plan/eventos', { token: tAdmin })).status, 200);
  });
}

if (corre('state')) {
  await casoAsync('State por HTTP: transiciones, acciones ignoradas y acciones permitidas de cada estado', async () => {
    const crear = await http('POST', '/api/stream/sesion', { token: tUlises, body: { contenidoId: 'ambar', anchoBandaKbps: 50000 } });
    const id = crear.data.sesionId;
    const accion = async (a, valor) => (await http('POST', `/api/stream/sesion/${id}/accion`, { token: tUlises, body: { accion: a, valor } })).data;
    const nombres = (r) => r.eventos.map((e) => e.evento);

    assert.equal(crear.data.estado.reproduccion.estado, 'detenido');
    assert.deepEqual(crear.data.estado.reproduccion.accionesPermitidas, ['reproducir', 'buscar']);

    const pausar = await accion('pausar');
    assert.equal(pausar.estado.reproduccion.estado, 'detenido');
    assert.ok(nombres(pausar).includes('TRANSICION_IGNORADA'));

    const play = await accion('reproducir');
    assert.equal(play.estado.reproduccion.estado, 'cargando');
    assert.deepEqual(play.eventos.find((e) => e.evento === 'ESTADO_CAMBIO').datos, { de: 'detenido', a: 'cargando', motivo: 'el usuario pulsó reproducir' });
    assert.ok(nombres(await accion('reproducir')).includes('TRANSICION_IGNORADA')); // otro play mientras carga

    const t = await accion('avanzar', 10);
    assert.equal(t.estado.reproduccion.estado, 'reproduciendo');
    assert.deepEqual(t.estado.reproduccion.accionesPermitidas, ['pausar', 'buscar']);

    const pausa = await accion('pausar');
    assert.equal(pausa.estado.reproduccion.estado, 'pausado');
    const pos = pausa.estado.reproduccion.posicionSeg;
    const quieto = await accion('avanzar', 5);
    assert.equal(quieto.estado.reproduccion.posicionSeg, pos); // pausado: no avanza
    assert.equal(quieto.estado.reproduccion.estado, 'pausado'); // y no reanuda solo

    assert.equal((await accion('reproducir')).estado.reproduccion.estado, 'reproduciendo'); // buffer lleno: directo
    const salto = await accion('buscar', 8035);
    assert.equal(salto.estado.reproduccion.estado, 'cargando'); // buscar vacía el buffer
    const fin = await accion('avanzar', 30);
    assert.equal(fin.estado.reproduccion.estado, 'detenido'); // terminó
    const otra = await accion('reproducir');
    assert.equal(otra.estado.reproduccion.posicionSeg, 0); // reinicia
    assert.equal(otra.estado.reproduccion.estado, 'cargando'); // con el buffer vaciado
    await http('DELETE', `/api/stream/sesion/${id}`, { token: tUlises });
  });
}

if (corre('visitor')) {
  await casoAsync('Visitor por HTTP: los 3 reportes del catálogo coinciden con Composite e Iterator', async () => {
    const est = await http('GET', '/api/catalogo/catalogo/reporte?visitante=estadisticas', { token: tUma });
    assert.equal(est.status, 200);
    const detalle = (await http('GET', '/api/catalogo/catalogo', { token: tUma })).data;
    assert.equal(est.data.duracionTotalMin, detalle.resumen.duracionMin);
    assert.equal(est.data.reproducibles, detalle.resumen.totalReproducibles);
    const iter = (await http('GET', '/api/catalogo/catalogo/recorrer?orden=profundidad&limite=100&desde=0', { token: tUma })).data;
    assert.equal(est.data.nodosVisitados, 101);
    assert.ok(iter.cantidad === 100 && iter.siguiente === 100); // el iterador confirma que hay más de 100 nodos (101)

    const alm = await http('GET', '/api/catalogo/catalogo/reporte?visitante=almacenamiento&calidades=360p,1080p', { token: tUma });
    assert.deepEqual(Object.keys(alm.data.calidades), ['360p', '1080p']);
    const csv = await http('GET', '/api/catalogo/horizonte-nocturno/reporte?visitante=csv', { token: tUma });
    assert.equal(csv.data.filas, 11);
    assert.equal(csv.data.nodosVisitados, 11);
    assert.equal((await http('GET', '/api/catalogo/catalogo/reporte', { token: tUma })).data.visitante, 'estadisticas'); // por defecto
  });

  await casoAsync('Visitor por HTTP: errores (401 sin sesión, 404 nodo inexistente, 400 visitante o calidad inválidos)', async () => {
    assert.equal((await http('GET', '/api/catalogo/catalogo/reporte')).status, 401);
    assert.equal((await http('GET', '/api/catalogo/no-existe/reporte', { token: tUma })).status, 404);
    assert.equal((await http('GET', '/api/catalogo/catalogo/reporte?visitante=xml', { token: tUma })).status, 400);
    assert.equal((await http('GET', '/api/catalogo/catalogo/reporte?visitante=almacenamiento&calidades=7p', { token: tUma })).status, 400);
  });
}

await casoAsync('Proxy: Observer, State y Visitor quedan en el log de accesos', async () => {
  const acc = (await http('GET', '/api/admin/accesos', { token: tAdmin })).data.eventos;
  if (corre('visitor')) {
    assert.ok(acc.some((e) => e.operacion === 'generar reporte del catálogo' && e.resultado === 'PERMITIDO'));
    assert.ok(acc.some((e) => e.operacion === 'generar reporte del catálogo' && e.resultado === 'DENEGADO'));
  }
  if (corre('observer')) {
    assert.ok(acc.some((e) => e.operacion === 'consultar eventos del plan' && e.resultado === 'PERMITIDO'));
    assert.ok(acc.some((e) => e.operacion === 'consultar eventos del plan' && e.resultado === 'DENEGADO'));
  }
  if (corre('state')) assert.ok(acc.some((e) => e.operacion === 'controlar sesión de reproducción' && e.resultado === 'PERMITIDO'));
});

console.log(`\n🎉 ${ok} comprobaciones OK`);
process.exit(0);
