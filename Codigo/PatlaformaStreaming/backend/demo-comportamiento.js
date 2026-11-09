/**
 * demo-comportamiento.js
 * Demostración por consola de Iterator, Mediator y Memento (sin PostgreSQL):
 *
 *     cd backend && npm run demo:comportamiento
 */
import CatalogoService from './catalog/CatalogoService.js';
import SesionReproduccion from './streaming/mediator/SesionReproduccion.js';
import PerfilRecomendacionRegistry from './recommendation/PerfilRecomendacionRegistry.js';
import HistorialPerfil from './recommendation/memento/HistorialPerfil.js';

const linea = (t) => console.log(`\n${'='.repeat(64)}\n${t}\n${'='.repeat(64)}`);
const silencio = (fn) => { const log = console.log; console.log = () => {}; try { return fn(); } finally { console.log = log; } };

// ------------------------------------------------------------------
linea('ITERATOR — mismo árbol, tres formas de recorrerlo');
// ------------------------------------------------------------------
const serie = CatalogoService.buscar('horizonte-nocturno');
for (const orden of ['profundidad', 'anchura', 'reproducibles']) {
  const it = silencio(() => serie.crearIterador(orden));
  const salida = [];
  while (it.hasNext() && salida.length < 6) { const n = it.next(); salida.push(`${'·'.repeat(it.nivel)}${n.id}`); }
  console.log(`\n${orden.padEnd(14)} (primeros 6):\n  ${salida.join('\n  ')}`);
}

console.log('\nSolo series "familiar" de TODO el catálogo (iterador con filtro):');
const familiares = silencio(() => CatalogoService.raiz.crearIterador('profundidad', (n) => n.tipo() === 'serie' && n.getGeneros().includes('familiar')));
for (const n of familiares) console.log(`  - ${n.titulo}`);

// ------------------------------------------------------------------
linea('MEDIATOR — un reproductor adaptativo coordinado por la sesión');
// ------------------------------------------------------------------
const sesion = silencio(() => new SesionReproduccion({ contenido: { id: 'ambar', titulo: 'Ámbar', duracionMin: 134 }, techoCalidad: '1080p', anchoBandaKbps: 7000 }));
const paso = (titulo, fn) => {
  const desde = sesion.ultimaSecuencia;
  silencio(fn);
  const e = sesion.estado();
  console.log(`\n▶ ${titulo}`);
  for (const ev of sesion.bitacora({ desdeN: desde })) console.log(`    [${ev.origen}] ${ev.evento} ${JSON.stringify(ev.datos)}`);
  console.log(`  => ${e.reproduccion.estado.padEnd(13)} calidad ${e.calidad.actual.padEnd(5)} buffer ${String(e.buffer.segundos).padStart(4)}s  pos ${e.reproduccion.posicionSeg}s  red ${e.red.anchoBandaKbps}kbps`);
};
paso('Usuario pulsa PLAY (buffer vacío)', () => sesion.reproducir());
paso('Pasan 10 s (se descarga video)', () => sesion.avanzar(10));
paso('La red cae a 1.000 kbps', () => sesion.reportarRed(1000));
paso('La red se recupera a 20.000 kbps (sube de a un escalón, con buffer suficiente)', () => { sesion.reportarRed(20000); sesion.avanzar(8); });
paso('Usuario salta al minuto 90', () => sesion.buscar(5400));
paso('Pasan 10 s tras el salto', () => sesion.avanzar(10));
paso('Cambia el audio a inglés (se descarta el audio ya descargado)', () => sesion.cambiarAudio('en'));
console.log('\nNingún componente conoce a otro: todas esas decisiones salieron de SesionReproduccion.notificar().');

// ------------------------------------------------------------------
linea('MEMENTO — perfil de recomendación con historial');
// ------------------------------------------------------------------
const perfil = silencio(() => PerfilRecomendacionRegistry.obtenerPlantilla('familiar')); // Prototype
const historial = new HistorialPerfil();
const ver = (t) => console.log(`${t.padEnd(36)} géneros=[${perfil.generosFavoritos.join(', ')}] peso=${perfil.pesoHistorial} tipo=${perfil.tipoContenidoPreferido}`);
const cambiar = (etiqueta, cambios) => { historial.guardar(perfil.crearMemento(etiqueta)); perfil.actualizar(cambios); };

ver('Perfil inicial (plantilla familiar):');
cambiar('Antes de añadir terror', { generosFavoritos: [...perfil.generosFavoritos, 'terror'] }); ver('Añade "terror":');
cambiar('Antes de subir peso', { pesoHistorial: 0.9 }); ver('Sube pesoHistorial a 0.9:');
cambiar('Antes de cambiar a series', { tipoContenidoPreferido: 'serie' }); ver('Prefiere series:');
console.log('\nVersiones guardadas:', historial.listar().map((v) => `${v.version}) ${v.etiqueta}`).join(' | '));
console.log();
historial.deshacer(perfil); ver('Deshacer:');
historial.deshacer(perfil); ver('Deshacer:');
historial.rehacer(perfil); ver('Rehacer:');
historial.restaurarVersion(perfil, 1); ver('Volver a la versión 1 (inicial):');
