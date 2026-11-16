/**
 * demo-observer-state-visitor.js
 * ------------------------------------------------------------------
 * Demostración por consola de Observer, State y Visitor (sin PostgreSQL):
 *
 *     cd backend && npm run demo:observer-state-visitor
 *
 * Muestra paso a paso cada patrón (con los logs que imprime el propio
 * patrón, sangrados) y termina con un cuadro de VALIDACIÓN ✔/✘ por patrón.
 * Si alguna validación falla, el proceso termina con código 1.
 * ------------------------------------------------------------------
 */
import db from './db/DatabaseSingleton.js';

const out = console.log.bind(console);
// Solo se dejan pasar los logs de los tres patrones (los de las demás capas se ocultan para no ensuciar la demo).
console.log = (...args) => {
  const m = args.join(' ');
  if (/^(👁️|🚦|🧳)/u.test(m)) out(`      ${m}`);
};
console.error = (...args) => out(`      ❗ ${args.join(' ')}`);

const linea = (t) => out(`\n${'='.repeat(70)}\n${t}\n${'='.repeat(70)}`);
const validaciones = { Observer: [], State: [], Visitor: [] };
const validar = (patron, texto, cond) => validaciones[patron].push({ texto, ok: Boolean(cond) });

// ---- BD en memoria: un usuario con plan familiar ----
const usuario = { id: 2, nombre: 'Uma', correo: 'uma@x.com', rol: 'usuario', plan_tipo: 'familiar', precio_mensual: 49900, calidad_maxima: '4K Ultra HD', pantallas_simultaneas: 4, descargas_offline: true };
db.pool.query = async (sql, p = []) => {
  const q = sql.replace(/\s+/g, ' ');
  if (q.startsWith('SELECT * FROM usuarios WHERE id')) return { rows: [usuario] };
  if (q.startsWith('UPDATE usuarios SET plan_tipo')) {
    Object.assign(usuario, { plan_tipo: p[0], precio_mensual: p[1], calidad_maxima: p[2], pantallas_simultaneas: p[3], descargas_offline: p[4] });
    return { rows: [usuario] };
  }
  throw new Error(`SQL no soportado: ${q}`);
};

const { crearSujetoPlan } = await import('./subscription/observer/registrarObservadores.js');
const { default: SuscripcionServicio } = await import('./services/SuscripcionServicio.js');
const { default: SesionesRegistry } = await import('./drm/SesionesRegistry.js');
const { default: RegistroSesiones } = await import('./streaming/mediator/RegistroSesiones.js');
const { default: SesionReproduccion } = await import('./streaming/mediator/SesionReproduccion.js');
const { default: CatalogoService } = await import('./catalog/CatalogoService.js');
const { crearVisitante } = await import('./catalog/visitor/crearVisitante.js');
const { default: VisitanteContenido } = await import('./catalog/visitor/VisitanteContenido.js');

// ------------------------------------------------------------------
linea('OBSERVER — un cambio de plan avisa a DRM, Streaming y al usuario');
// ------------------------------------------------------------------
const sujeto = crearSujetoPlan();
const suscripcion = new SuscripcionServicio({ sujeto });
out(`\nObservadores suscritos: ${sujeto.nombresObservadores().join(', ')}`);

// Estado inicial: 2 pantallas DRM abiertas y 1 sesión de streaming en 1080p.
SesionesRegistry.registrar(usuario.id, 'tv-sala', 'ambar');
SesionesRegistry.registrar(usuario.id, 'tablet', 'ambar');
const sesion = new SesionReproduccion({ contenido: { id: 'ambar', titulo: 'Ámbar', duracionMin: 134 }, techoCalidad: '1080p', anchoBandaKbps: 50000 });
RegistroSesiones.crear(sesion, usuario.id);
out(`\nAntes:   plan ${usuario.plan_tipo} · pantallas DRM ${SesionesRegistry.activas(usuario.id).length}/${usuario.pantallas_simultaneas} · calidad ${sesion.estado().calidad.actual} (techo ${sesion.estado().calidad.techoPlan})`);

out('\n▶ La usuaria baja de plan: familiar → free');
await suscripcion.cambiarPlan(usuario.id, 'free');
const evento1 = sujeto.historialDe(usuario.id).at(-1);
out('\n   Traza del evento (lo que hizo cada observador):');
for (const t of evento1.traza) out(`   [${t.estado}] ${t.observador}: ${t.detalle}`);
out(`\nDespués: plan ${usuario.plan_tipo} · pantallas DRM ${SesionesRegistry.activas(usuario.id).length}/${usuario.pantallas_simultaneas} · calidad ${sesion.estado().calidad.actual} (techo ${sesion.estado().calidad.techoPlan})`);
validar('Observer', 'Un solo cambio de plan notificó a los 3 observadores y todos terminaron OK', evento1.traza.length === 3 && evento1.traza.every((t) => t.estado === 'OK'));
validar('Observer', 'DRM: de 2 pantallas abiertas quedó 1 (el plan free permite 1)', SesionesRegistry.activas(usuario.id).length === 1);
validar('Observer', 'Streaming: la sesión bajó a 480p (techo y calidad)', sesion.estado().calidad.techoPlan === '480p' && sesion.estado().calidad.actual === '480p');

out('\n▶ Sube a premium: la calidad NO salta de golpe, sube de a un escalón cuando hay buffer');
await suscripcion.cambiarPlan(usuario.id, 'premium');
out(`   Justo después del cambio: calidad ${sesion.estado().calidad.actual} (techo ${sesion.estado().calidad.techoPlan}) — buffer ${sesion.estado().buffer.segundos}s`);
validar('Observer', 'Al subir de plan la calidad no salta al techo: espera buffer', sesion.estado().calidad.actual === '480p');
sesion.avanzar(30);
out(`   Tras 30 s: calidad ${sesion.estado().calidad.actual}`);
validar('Observer', 'Con buffer suficiente la calidad sube hasta el nuevo techo (1080p)', sesion.estado().calidad.actual === '1080p');

out('\n▶ Un observador se da de baja y el siguiente cambio ya no le llega');
const baja = sujeto.nombresObservadores().length;
const { default: ObservadorNotificacion } = await import('./subscription/observer/ObservadorNotificacion.js');
const extra = new ObservadorNotificacion();
const darDeBaja = sujeto.suscribir(extra);
darDeBaja();
await suscripcion.cambiarPlan(usuario.id, 'basico');
validar('Observer', 'Un observador dado de baja deja de recibir eventos', extra.enviadosA(usuario.id).length === 0 && sujeto.nombresObservadores().length === baja);

// ------------------------------------------------------------------
linea('STATE — el reproductor sabe qué puede hacer según su estado');
// ------------------------------------------------------------------
const s = new SesionReproduccion({ contenido: { id: 'ambar', titulo: 'Ámbar', duracionMin: 134 }, techoCalidad: '1080p', anchoBandaKbps: 50000 });
const pasos = [];
const paso = (titulo, fn) => {
  const n = s.ultimaSecuencia;
  fn();
  const e = s.estado().reproduccion;
  const cambios = s.bitacora({ desdeN: n }).filter((x) => x.evento === 'ESTADO_CAMBIO' || x.evento === 'TRANSICION_IGNORADA').map((x) => (x.evento === 'ESTADO_CAMBIO' ? `${x.datos.de}→${x.datos.a}` : `IGNORADA(${x.datos.evento})`));
  out(`\n▶ ${titulo}\n   => ${e.estado.padEnd(13)} permitidas: [${e.accionesPermitidas.join(', ')}]   ${cambios.length ? `(${cambios.join(' ')})` : ''}`);
  pasos.push({ titulo, estado: e.estado, cambios });
  return e.estado;
};
const e1 = paso('Estado inicial', () => {});
const e2 = paso('Pulsa PAUSA con el video detenido (no hay nada que pausar)', () => s.pausar());
const e3 = paso('Pulsa PLAY con el buffer vacío', () => s.reproducir());
const e4 = paso('Pulsa PLAY otra vez mientras carga', () => s.reproducir());
const e5 = paso('Pasan 10 s: el buffer se llena y reanuda solo', () => s.avanzar(10));
const e6 = paso('Pulsa PAUSA', () => s.pausar());
const e7 = paso('Pasan 5 s en pausa (el buffer sigue llenándose, NO reanuda solo)', () => s.avanzar(5));
const e8 = paso('Pulsa PLAY con el buffer lleno (directo, sin pasar por "cargando")', () => s.reproducir());
const e9 = paso('Salta al final del video y pasan 30 s', () => { s.buscar(8035); s.avanzar(30); });
const e10 = paso('Pulsa PLAY con el video terminado (reinicia desde 0 con el buffer vacío)', () => s.reproducir());
out(`   posición tras reiniciar: ${s.estado().reproduccion.posicionSeg}s · buffer ${s.estado().buffer.segundos}s · calidad ${s.estado().calidad.actual}`);

validar('State', 'PAUSA con el video detenido se IGNORA y queda anotada (sigue detenido)', e1 === 'detenido' && e2 === 'detenido' && pasos[1].cambios[0] === 'IGNORADA(PAUSA)');
validar('State', 'PLAY sin buffer → cargando; PLAY repetido se ignora', e3 === 'cargando' && e4 === 'cargando' && pasos[3].cambios[0] === 'IGNORADA(REPRODUCIR)');
validar('State', 'Con buffer suficiente el estado pasa solo a reproduciendo', e5 === 'reproduciendo');
validar('State', 'En pausa el buffer se llena pero no reanuda solo', e6 === 'pausado' && e7 === 'pausado');
validar('State', 'PLAY en pausa con buffer lleno va directo a reproduciendo', e8 === 'reproduciendo' && pasos[7].cambios.join() === 'pausado→reproduciendo');
validar('State', 'Al terminar el contenido pasa a detenido', e9 === 'detenido');
validar('State', 'Dar PLAY a un video terminado lo reinicia: posición 0, buffer vacío y espera (cargando)', e10 === 'cargando' && s.estado().reproduccion.posicionSeg === 0 && s.estado().buffer.segundos === 0);

// ------------------------------------------------------------------
linea('VISITOR — reportes sobre el catálogo sin tocar las clases de los nodos');
// ------------------------------------------------------------------
const raiz = CatalogoService.raiz;
const serie = CatalogoService.buscar('horizonte-nocturno');
const correr = (nodo, nombre, opciones) => { const v = crearVisitante(nombre, opciones); nodo.aceptar(v); return v.resultado(); };

const est = correr(raiz, 'estadisticas');
out(`\n▶ VisitanteEstadisticas sobre todo el catálogo`);
out(`   nodos: ${est.nodosVisitados} · por tipo: ${JSON.stringify(est.porTipo)}`);
out(`   duración total: ${est.duracionTexto} (${est.duracionTotalMin} min) · más largo: ${est.masLargo.titulo} (${est.masLargo.duracionMin} min)`);

const alm = correr(raiz, 'almacenamiento');
out(`\n▶ VisitanteAlmacenamiento (bitrates del Flyweight)`);
for (const [res, c] of Object.entries(alm.calidades)) out(`   ${res.padEnd(6)} ${String(c.bitrateKbps).padStart(5)} kbps → ${String(c.gb).padStart(7)} GB`);

const csv = correr(serie, 'csv');
out(`\n▶ VisitanteExportadorCSV sobre la serie "Horizonte Nocturno" (${csv.filas} filas, primeras 5):`);
csv.csv.split('\n').slice(0, 5).forEach((f) => out(`   ${f}`));

out('\n▶ Operación NUEVA sin modificar ningún nodo: contar episodios de 50 min o más');
class CuentaEpisodiosLargos extends VisitanteContenido {
  total = 0;
  visitarEpisodio(n) { if (n.getDuracion() >= 50) this.total++; }
  resultado() { return this.total; }
}
const largos = new CuentaEpisodiosLargos();
raiz.aceptar(largos);
out(`   episodios de 50 min o más en todo el catálogo: ${largos.resultado()}`);

validar('Visitor', 'Duración total del visitante == Composite.getDuracion()', est.duracionTotalMin === raiz.getDuracion());
validar('Visitor', 'Reproducibles del visitante == Composite.obtenerReproducibles()', est.reproducibles === raiz.obtenerReproducibles().length);
validar('Visitor', 'Nodos visitados == nodos que recorre el Iterator', est.nodosVisitados === [...raiz.crearIterador('profundidad')].length);
validar('Visitor', '1080p pesa 6,25× más que 360p (bitrates del Flyweight)', Math.abs(alm.calidades['1080p'].gb / alm.calidades['360p'].gb - 6.25) < 0.01);
validar('Visitor', 'El CSV tiene una fila por nodo (11 = serie + 2 temporadas + 8 episodios)', csv.filas === 11);
validar('Visitor', 'Un visitante nuevo funciona sin tocar las clases de los nodos', largos.resultado() > 0);

// ------------------------------------------------------------------
linea('VALIDACIÓN DE LOS PATRONES');
// ------------------------------------------------------------------
let fallos = 0;
for (const [patron, lista] of Object.entries(validaciones)) {
  const buenas = lista.filter((v) => v.ok).length;
  out(`\n${buenas === lista.length ? '✅' : '⚠️ '} ${patron}: ${buenas}/${lista.length}`);
  for (const v of lista) { out(`   ${v.ok ? '✔' : '✘'} ${v.texto}`); if (!v.ok) fallos++; }
}
out(fallos === 0 ? '\n🎉 Los tres patrones se comportan como se espera.\n' : `\n❌ ${fallos} validación(es) fallaron.\n`);
process.exit(fallos === 0 ? 0 : 1);
