/**
 * test-contenido-real.js
 * ------------------------------------------------------------------
 * Pruebas del contenido con VIDEO REAL (backend/media): Factory Method,
 * FuenteMedia (Null Object + Template Method), Bridge con el protocolo MP4
 * y Proxy de protección con ticket firmado.
 * NO necesita PostgreSQL (la BD se reemplaza por una en memoria).
 *
 *     cd backend && npm run test:contenido
 * ------------------------------------------------------------------
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import db from './db/DatabaseSingleton.js';
import CatalogoService from './catalog/CatalogoService.js';
import FuenteMedia from './catalog/media/FuenteMedia.js';
import FuenteSimulada from './catalog/media/FuenteSimulada.js';
import FuenteLocal from './catalog/media/FuenteLocal.js';
import ContenidoFactory from './catalog/media/ContenidoFactory.js';
import CargadorContenido from './catalog/media/CargadorContenido.js';
import Pelicula from './catalog/Pelicula.js';
import MP4Protocol from './streaming/MP4Protocol.js';
import { crearProtocolo, elegirProtocolo } from './streaming/crearProtocolo.js';
import StreamingServicio from './services/StreamingServicio.js';
import TokenService from './auth/TokenService.js';
import SesionesRegistry from './drm/SesionesRegistry.js';
import ElementoContenido from './catalog/ElementoContenido.js';
import { duracionMp4Segundos, infoMp4, resolucionPorAlto } from './catalog/media/Mp4Info.js';
import { agregarVideo } from './scripts/agregar-video.js';
import { spawnSync } from 'node:child_process';
import { paisDeLaPeticion } from './geo/paisDeLaPeticion.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const silencio = (fn) => { const l = console.log; const w = console.warn; console.log = () => {}; console.warn = () => {}; try { return fn(); } finally { console.log = l; console.warn = w; } };
let ok = 0;
const caso = (nombre, fn) => { fn(); ok++; console.log(`  ✔ ${nombre}`); };
const casoAsync = async (nombre, fn) => { await fn(); ok++; console.log(`  ✔ ${nombre}`); };

const spring = CatalogoService.buscar('spring');
if (!spring) {
  console.error('No se encontró "spring" en el catálogo: falta backend/media/spring/ (meta.json y los .mp4).');
  process.exit(1);
}

// ====================================================================
console.log('\n== Fuentes de video (Null Object + Template Method) ==');
// ====================================================================
caso('FuenteMedia es abstracta', () => assert.throws(() => new FuenteMedia(), /abstracta/));

caso('una hoja sin fuente asignada usa la FuenteSimulada (nunca null)', () => {
  const p = new Pelicula('x', 'X', 90, ['drama']);
  assert.equal(p.getFuente(), FuenteSimulada.INSTANCIA);
  assert.equal(p.getFuente().esReal(), false);
  assert.deepEqual(p.getFuente().calidades(), ['360p', '720p', '1080p']);
});

caso('calidades(techo) recorta al techo y siempre deja al menos la más baja', () => {
  assert.deepEqual(FuenteSimulada.INSTANCIA.calidades('720p'), ['360p', '720p']);
  assert.deepEqual(FuenteSimulada.INSTANCIA.calidades('480p'), ['360p']);
  assert.deepEqual(FuenteSimulada.INSTANCIA.calidades('basura'), ['360p', '720p', '1080p']);
  const soloHD = new FuenteLocal({ directorio: '/x', archivos: [{ resolucion: '720p', archivo: 'a.mp4' }], baseUrl: 'http://h' });
  assert.deepEqual(soloHD.calidades('360p'), ['720p']); // nunca se queda sin video
});

caso('FuenteLocal valida resoluciones y nombres de archivo (nada de rutas)', () => {
  const mk = (archivos) => () => new FuenteLocal({ directorio: '/x', archivos, baseUrl: 'http://h' });
  assert.throws(mk([]), /al menos un archivo/);
  assert.throws(mk([{ resolucion: '999p', archivo: 'a.mp4' }]), /Resolución inválida/);
  assert.throws(mk([{ resolucion: '720p', archivo: '../secreto.mp4' }]), /Nombre de archivo inválido/);
  assert.throws(mk([{ resolucion: '720p', archivo: 'a.exe' }]), /Nombre de archivo inválido/);
});

caso('FuenteLocal solo da ruta de archivos DECLARADOS (lista blanca)', () => {
  const f = spring.getFuente();
  assert.ok(f.rutaAbsoluta('720p.mp4').endsWith(path.join('media', 'spring', '720p.mp4')));
  assert.equal(f.rutaAbsoluta('../meta.json'), null);
  assert.equal(f.rutaAbsoluta('meta.json'), null);
  assert.equal(f.rutaAbsoluta('1080p.mp4'), null);
});

// ====================================================================
console.log('\n== Duración REAL leída del MP4 ==');
// ====================================================================
caso('Mp4Info lee la duración de la cabecera del MP4 (sin ffmpeg)', () => {
  const d720 = duracionMp4Segundos(path.join(DIR, 'media', 'spring', '720p.mp4'));
  const d360 = duracionMp4Segundos(path.join(DIR, 'media', 'spring', '360p.mp4'));
  assert.ok(Math.abs(d720 - 464.17) < 0.05, `720p = ${d720}`);   // 7m 44s, igual que ffprobe
  assert.ok(Math.abs(d360 - 464.17) < 0.05, `360p = ${d360}`);
  assert.equal(duracionMp4Segundos(path.join(DIR, 'media', 'spring', 'meta.json')), null); // no es un MP4
  assert.equal(duracionMp4Segundos(path.join(DIR, 'media', 'no-existe.mp4')), null);
});

caso('Spring usa la duración real del archivo, no el número del meta.json', () => {
  assert.ok(Math.abs(spring.getDuracion() - 464.17 / 60) < 0.001);
  assert.equal(spring.getDuracionFormateada(), '7m 44s');
  assert.equal(spring.toJSON().duracionTexto, '7m 44s');
});

caso('el formato de duración no cambia para minutos enteros y agrega segundos solo si hacen falta', () => {
  assert.deepEqual([8, 90, 125.5, 0.5].map((m) => ElementoContenido.formatearDuracion(m)), ['8m', '1h 30m', '2h 05m 30s', '0m 30s']);
});

// ====================================================================
console.log('\n== Factory Method + Composite: Spring en el catálogo ==');
// ====================================================================
caso('Spring es una Pelicula del Composite con fuente real y créditos', () => {
  assert.equal(spring.tipo(), 'pelicula');
  assert.equal(spring.esReproducible(), true);
  assert.equal(spring.getFuente().esReal(), true);
  const j = spring.toJSON();
  assert.equal(j.contenidoReal, true);
  assert.match(j.creditos.licencia, /CC-BY/);
  assert.equal(CatalogoService.buscar('contenido-abierto').getHijos().includes(spring), true);
});

caso('los títulos de ejemplo NO cambian su JSON (sin campos de contenido real)', () => {
  const j = CatalogoService.buscar('ambar').toJSON();
  assert.equal('contenidoReal' in j, false);
  assert.equal('creditos' in j, false);
});

caso('ContenidoFactory crea según "tipo" y valida los datos', () => {
  const f = FuenteSimulada.INSTANCIA;
  const base = { id: 'prueba', titulo: 'Prueba', duracionMin: 5, generos: ['drama'] };
  assert.equal(silencio(() => ContenidoFactory.crear({ ...base, tipo: 'documental' }, f)).tipo(), 'documental');
  assert.throws(() => ContenidoFactory.crear({ ...base, tipo: 'serie' }, f), /tipo inválido/);
  assert.throws(() => ContenidoFactory.crear({ ...base, tipo: 'pelicula', id: 'Con Espacios' }, f), /id inválido/);
  assert.throws(() => ContenidoFactory.crear({ ...base, tipo: 'pelicula', duracionMin: 0 }, f), /duracionMin/);
  assert.throws(() => ContenidoFactory.crear({ ...base, tipo: 'pelicula' }, {}), /FuenteMedia/);
});

caso('CargadorContenido es tolerante: omite lo roto y carga lo bueno', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'media-'));
  const crear = (id, meta, archivos = []) => {
    fs.mkdirSync(path.join(tmp, id));
    if (meta !== null) fs.writeFileSync(path.join(tmp, id, 'meta.json'), typeof meta === 'string' ? meta : JSON.stringify(meta));
    archivos.forEach((a) => fs.writeFileSync(path.join(tmp, id, a), 'x'));
  };
  const meta = (id, extra = {}) => ({ id, tipo: 'pelicula', titulo: id, duracionMin: 3, generos: ['drama'], archivos: [{ resolucion: '720p', archivo: '720p.mp4' }], ...extra });
  crear('bueno', meta('bueno'), ['720p.mp4']);
  crear('sin-archivo', meta('sin-archivo'));                 // declara un mp4 que no existe
  crear('json-roto', '{ esto no es json');
  crear('id-distinto', meta('otro-id'), ['720p.mp4']);        // el id no coincide con la carpeta
  crear('sin-meta', null);
  const nodos = silencio(() => CargadorContenido.cargar({ directorio: tmp, baseUrl: 'http://h' }));
  assert.deepEqual(nodos.map((n) => n.id), ['bueno']);
  assert.deepEqual(silencio(() => CargadorContenido.cargar({ directorio: path.join(tmp, 'no-existe') })), []);
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ====================================================================
console.log('\n== Bridge: protocolo MP4 + elección por fuente ==');
// ====================================================================
caso('MP4Protocol es un implementor más del Bridge (misma interfaz que HLS/DASH)', () => {
  const p = crearProtocolo('mp4');
  assert.ok(p instanceof MP4Protocol);
  assert.equal(p.nombre(), 'MP4');
  assert.equal(p.infoManifiesto().mimeType, 'video/mp4');
  assert.throws(() => silencio(() => p.construirUrl('spring', '1080p', spring.getFuente())), /no tiene un archivo MP4/);
  assert.throws(() => crearProtocolo('rtmp'), /protocolo inválido/);
});

caso('elegirProtocolo: auto y los no soportados caen al preferido de la fuente', () => {
  const real = spring.getFuente();
  const demo = FuenteSimulada.INSTANCIA;
  assert.equal(silencio(() => elegirProtocolo('auto', real)), 'mp4');
  assert.equal(silencio(() => elegirProtocolo('hls', real)), 'mp4');   // el real no tiene HLS
  assert.equal(silencio(() => elegirProtocolo('auto', demo)), 'hls');
  assert.equal(silencio(() => elegirProtocolo('dash', demo)), 'dash'); // lo soportado se respeta
});

const servicio = new StreamingServicio();
// Una "licencia" = una sesión DRM abierta por /api/stream/autorizar. Aquí se abre una que cubre todo el catálogo.
const licencia = (usuarioId, contenidoId, extra = {}) =>
  SesionesRegistry.registrar(usuarioId, `dev-${contenidoId}`, contenidoId, { licenciaId: 'LIC-1', expiraEn: Date.now() + 60 * 60 * 1000, permiteOffline: false, ...extra }).id;
const SES = licencia(7, 'catalogo');
const entregar = (datos) => silencio(() => servicio.generarEntrega({ tipoEntrega: 'vod', protocolo: 'auto', usuarioId: 7, sesionId: SES, tokenDRM: 'LIC-1', ...datos }));

caso('entrega de un título real: MP4, URLs reales con ticket y créditos', () => {
  const m = entregar({ contenidoId: 'spring' }).manifest;
  assert.equal(m.protocolo, 'MP4');
  assert.equal(m.reproduccionReal, true);
  assert.deepEqual(m.calidades.map((c) => c.resolucion), ['360p', '720p']);
  assert.match(m.calidades[1].url, /\/media\/spring\/720p\.mp4\?ticket=/);
  assert.equal(m.creditos.autor, 'Blender Studio');
});

caso('MP4 NO es adaptativo (la calidad la elige la persona); HLS con 3 calidades sí', () => {
  assert.equal(entregar({ contenidoId: 'spring' }).manifest.calidades.length, 2); // hay 2 calidades...
  assert.equal(entregar({ contenidoId: 'spring' }).manifest.adaptativo, false);   // ...pero no se adaptan solas
  assert.equal(entregar({ contenidoId: 'ambar', protocolo: 'hls' }).manifest.adaptativo, true);
});

caso('el techo del plan recorta las calidades REALES (Free = 480p -> solo 360p)', () => {
  assert.deepEqual(entregar({ contenidoId: 'spring', calidadMaxima: 'SD (480p)' }).manifest.calidades.map((c) => c.resolucion), ['360p']);
  assert.deepEqual(entregar({ contenidoId: 'spring', calidadMaxima: 'HD (720p)' }).manifest.calidades.map((c) => c.resolucion), ['360p', '720p']);
});

caso('los títulos de ejemplo siguen igual: HLS, 3 calidades, URLs del CDN de ejemplo, sin ticket', () => {
  const m = entregar({ contenidoId: 'ambar', protocolo: 'hls', calidadMaxima: 'SD (480p)' }).manifest;
  assert.equal(m.reproduccionReal, false);
  assert.equal(m.calidades.length, 3); // el plan no recorta lo simulado
  assert.ok(m.calidades.every((c) => c.url.startsWith('https://cdn.ejemplo.com/') && !c.url.includes('ticket')));
});

caso('una colección mezclada (demo + real) se entrega con el protocolo de cada título', () => {
  const r = entregar({ contenidoId: 'catalogo', protocolo: 'hls' });
  const porId = Object.fromEntries(r.reproducibles.map((x) => [x.id, x.manifest.protocolo]));
  assert.equal(porId.spring, 'MP4');
  assert.equal(porId.ambar, 'HLS');
});

caso('errores de la entrega: protocolo, tipo, contenido, live con video real y sin usuario', () => {
  assert.throws(() => entregar({ contenidoId: 'spring', protocolo: 'rtmp' }), /protocolo inválido/);
  assert.throws(() => entregar({ contenidoId: 'spring', tipoEntrega: 'x' }), /tipoEntrega inválido/);
  assert.throws(() => entregar({ contenidoId: 'no-existe' }), (e) => e.status === 404);
  assert.throws(() => entregar({ contenidoId: 'spring', tipoEntrega: 'live' }), /solo se entrega bajo demanda/);
  assert.throws(() => entregar({ contenidoId: 'spring', usuarioId: undefined }), (e) => e.status === 401);
});

caso('DRM obligatorio: sin licencia vigente NO hay ticket para un video real', () => {
  const codigo = (datos) => { try { entregar({ contenidoId: 'spring', ...datos }); } catch (e) { return e.codigo; } return 'SIN_ERROR'; };
  assert.equal(codigo({ sesionId: undefined }), 'SIN_LICENCIA');                         // nunca autorizó
  assert.equal(codigo({ sesionId: 'SES-999999' }), 'SESION_EXPIRADA');                    // sesión inexistente
  assert.equal(codigo({ usuarioId: 8 }), 'SESION_EXPIRADA');                              // la licencia es de OTRO usuario
  assert.equal(codigo({ sesionId: licencia(7, 'ambar') }), 'LICENCIA_OTRO_CONTENIDO');    // autorizó otro título
  assert.equal(codigo({ sesionId: licencia(7, 'spring') }), 'SIN_ERROR');                 // autorizó este: pasa
  const liberada = licencia(7, 'contenido-abierto');
  SesionesRegistry.liberar(7, liberada);
  assert.equal(codigo({ sesionId: liberada }), 'SESION_EXPIRADA');                        // ya pulsó "Detener"
});

caso('la LICENCIA manda: el acceso dura lo que le queda y el permiso offline sale de ella', () => {
  const corta = licencia(7, 'spring', { expiraEn: Date.now() + 90 * 60 * 1000, permiteOffline: true });
  const m = entregar({ contenidoId: 'spring', sesionId: corta }).manifest;
  assert.ok(m.ticketExpiraEnMin >= 89 && m.ticketExpiraEnMin <= 90, `ticket = ${m.ticketExpiraEnMin} min`);
  assert.equal(m.permiteDescarga, true);
  assert.equal(entregar({ contenidoId: 'spring', sesionId: licencia(7, 'spring') }).manifest.permiteDescarga, false);
  const vencida = licencia(7, 'spring', { expiraEn: Date.now() - 1 }); // licencia ya vencida
  assert.throws(() => entregar({ contenidoId: 'spring', sesionId: vencida }), (e) => e.codigo === 'SESION_EXPIRADA');
});

caso('el id de licencia debe ser el de la sesión (no se puede usar una licencia ajena)', () => {
  assert.throws(() => entregar({ contenidoId: 'spring', tokenDRM: 'LIC-FALSA' }), (e) => e.codigo === 'LICENCIA_INVALIDA');
  assert.throws(() => entregar({ contenidoId: 'spring', tokenDRM: undefined }), (e) => e.codigo === 'LICENCIA_INVALIDA');
});

caso('la región la decide el servidor: configuración, cabecera del CDN y nunca el cliente', () => {
  const antes = { ...process.env };
  try {
    delete process.env.GEO_CABECERA_PAIS; delete process.env.PAIS_POR_DEFECTO;
    assert.equal(paisDeLaPeticion({ headers: { 'x-pais': 'ZZ' } }).pais, 'CO');           // sin config: CO, ignora cabeceras
    process.env.PAIS_POR_DEFECTO = 'mx';
    assert.equal(paisDeLaPeticion({ headers: {} }).pais, 'MX');
    process.env.GEO_CABECERA_PAIS = 'CF-IPCountry';
    assert.deepEqual(paisDeLaPeticion({ headers: { 'cf-ipcountry': 'ar' } }).pais, 'AR');  // cabecera del proxy de confianza
    assert.equal(paisDeLaPeticion({ headers: {} }).pais, 'XX');                             // configurada pero ausente: desconocido, no se adivina
    assert.equal(paisDeLaPeticion({ headers: { 'cf-ipcountry': 'ZZZ' } }).pais, 'XX');      // inválida
  } finally { process.env = antes; }
});

caso('los títulos de ejemplo NO exigen licencia en la entrega (siguen simulados)', () => {
  assert.equal(entregar({ contenidoId: 'ambar', sesionId: undefined }).manifest.reproduccionReal, false);
});

// ====================================================================
console.log('\n== Ticket firmado (acceso al video) ==');
// ====================================================================
caso('el ticket sirve solo para SU contenido y no se confunde con el token de sesión', () => {
  const { ticket } = TokenService.emitirTicket(7, 'spring', 'SES-1');
  assert.deepEqual(TokenService.verificarTicket(ticket, 'spring'), { usuarioId: 7, sesionId: 'SES-1', offline: false });
  assert.equal(TokenService.verificarTicket(ticket, 'ambar'), null);         // otro contenido
  assert.equal(TokenService.verificar(ticket), null);                         // no vale como sesión
  assert.equal(TokenService.verificarTicket(TokenService.emitir(7), 'spring'), null); // la sesión no vale como ticket
  assert.equal(TokenService.verificarTicket(ticket.slice(0, -2) + 'xx', 'spring'), null); // manipulado
  assert.equal(TokenService.verificarTicket(undefined, 'spring'), null);
});

caso('un ticket vencido se rechaza', () => {
  const { ticket } = TokenService.emitirTicket(7, 'spring', 'SES-1', { minutos: -1 });
  assert.equal(TokenService.verificarTicket(ticket, 'spring'), null);
});

// ====================================================================
console.log('\n== Agregar películas con «npm run agregar:video» ==');
// ====================================================================
caso('Mp4Info lee resolución y códec de los videos de Spring (H.264 + AAC, índice al inicio)', () => {
  const i = infoMp4(path.join(DIR, 'media', 'spring', '720p.mp4'));
  assert.equal(i.alto, 720);
  assert.ok(i.ancho > 1700);
  assert.equal(i.codecVideo, 'avc1');
  assert.equal(i.codecAudio, 'mp4a');
  assert.equal(i.moovAlInicio, true);
  assert.equal(i.reproducibleEnNavegador, true);
  assert.equal(infoMp4(path.join(DIR, 'media', 'spring', '360p.mp4')).alto, 360);
  assert.equal(infoMp4(path.join(DIR, 'media', 'spring', 'meta.json')), null);
});

caso('resolucionPorAlto: etiqueta de calidad según el alto del video', () => {
  assert.deepEqual([2160, 1080, 720, 700, 480, 360, 240].map(resolucionPorAlto), ['1080p', '1080p', '720p', '720p', '480p', '360p', '360p']);
});

const hayFfmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
if (!hayFfmpeg) {
  console.log('  (omitidas las pruebas del comando que necesitan ffmpeg: no está instalado en este equipo)');
} else {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agregar-'));
  const ff = (...a) => assert.equal(spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...a]).status, 0);
  const media = path.join(tmp, 'media');
  const quieto = { log() {} };
  const conMedia = (f) => { const antes = process.env.MEDIA_DIR; process.env.MEDIA_DIR = media; try { return f(); } finally { if (antes === undefined) delete process.env.MEDIA_DIR; else process.env.MEDIA_DIR = antes; } };

  // clips de prueba de 2 segundos
  ff('-f', 'lavfi', '-i', 'testsrc=duration=2:size=1280x720:rate=24', '-f', 'lavfi', '-i', 'sine=duration=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path.join(tmp, 'hd.mp4'));
  ff('-f', 'lavfi', '-i', 'testsrc=duration=2:size=640x360:rate=24', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', path.join(tmp, 'sd.mp4'));
  ff('-f', 'lavfi', '-i', 'testsrc=duration=2:size=640x360:rate=24', '-c:v', 'mpeg4', '-an', path.join(tmp, 'raro.mp4'));

  // MP4 con el índice (moov) AL FINAL, como muchos que se descargan de internet: se mueve moov detrás de mdat
  // y se corrigen los desplazamientos (stco) de las pistas.
  const moovAlFinal = (origen, destino) => {
    const d = fs.readFileSync(origen);
    const cajas = [];
    for (let pos = 0; pos + 8 <= d.length;) { const tam = d.readUInt32BE(pos); cajas.push({ tipo: d.toString('latin1', pos + 4, pos + 8), ini: pos, fin: pos + tam }); pos += tam; }
    const moov = cajas.find((c) => c.tipo === 'moov');
    const delta = moov.fin - moov.ini;
    const mo = Buffer.from(d.subarray(moov.ini, moov.fin));
    const recorrer = (ini, fin) => {
      for (let pos = ini; pos + 8 <= fin;) {
        const tam = mo.readUInt32BE(pos); const tipo = mo.toString('latin1', pos + 4, pos + 8);
        if (['trak', 'mdia', 'minf', 'stbl'].includes(tipo)) recorrer(pos + 8, pos + tam);
        if (tipo === 'stco') { const n = mo.readUInt32BE(pos + 12); for (let i = 0; i < n; i++) mo.writeUInt32BE(mo.readUInt32BE(pos + 16 + i * 4) - delta, pos + 16 + i * 4); }
        pos += tam;
      }
    };
    recorrer(8, mo.length);
    fs.writeFileSync(destino, Buffer.concat([...cajas.filter((c) => c.tipo !== 'moov').map((c) => d.subarray(c.ini, c.fin)), mo]));
  };
  moovAlFinal(path.join(tmp, 'hd.mp4'), path.join(tmp, 'hd_moov_final.mp4'));
  ff('-v', 'error', '-i', path.join(tmp, 'hd_moov_final.mp4'), '-f', 'null', '-'); // sigue siendo un video válido

  caso('Mp4Info detecta el índice al final (no se podría adelantar) y el códec no reproducible', () => {
    assert.equal(infoMp4(path.join(tmp, 'hd_moov_final.mp4')).moovAlInicio, false);
    const raro = infoMp4(path.join(tmp, 'raro.mp4'));
    assert.equal(raro.reproducibleEnNavegador, false);
    assert.equal(raro.codecVideo, 'mp4v');
  });

  caso('el comando crea la carpeta, el 360p, el meta.json y el título se carga en el catálogo', () => {
    const r = conMedia(() => agregarVideo({ archivo: path.join(tmp, 'hd.mp4'), titulo: 'Película de Prueba', generos: 'Acción, Aventura, acción', autor: 'Yo', licencia: 'CC-BY 4.0', log: quieto.log }));
    assert.equal(r.id, 'pelicula-de-prueba');
    assert.deepEqual(r.archivos.map((a) => a.resolucion), ['360p', '720p']);
    const meta = JSON.parse(fs.readFileSync(path.join(media, 'pelicula-de-prueba', 'meta.json'), 'utf8'));
    assert.deepEqual(meta.generos, ['accion', 'aventura']);            // sin tildes, sin repetidos
    assert.equal(meta.tipo, 'pelicula');
    assert.equal(meta.creditos.licencia, 'CC-BY 4.0');
    assert.ok(Math.abs(meta.duracionMin - 2 / 60) < 0.01);
    assert.equal(infoMp4(path.join(media, 'pelicula-de-prueba', '360p.mp4')).alto, 360);
    const [nodo] = silencio(() => CargadorContenido.cargar({ directorio: media, baseUrl: 'http://h' }));
    assert.equal(nodo.id, 'pelicula-de-prueba');
    assert.deepEqual(nodo.getFuente().calidades(), ['360p', '720p']);
    assert.equal(nodo.getDuracionFormateada(), '0m 02s');
  });

  caso('si el índice está al final, el comando reordena el archivo para que se pueda adelantar', () => {
    const r = conMedia(() => agregarVideo({ archivo: path.join(tmp, 'hd_moov_final.mp4'), id: 'indice-final', sin360: true, log: quieto.log }));
    const salida = infoMp4(path.join(r.carpeta, '720p.mp4'));
    assert.equal(salida.moovAlInicio, true);
    assert.equal(salida.alto, 720);
  });

  caso('un video chico (360p) genera una sola calidad; el códec raro y la falta de créditos se advierten', () => {
    const r = conMedia(() => agregarVideo({ archivo: path.join(tmp, 'raro.mp4'), id: 'raro', log: quieto.log }));
    assert.deepEqual(r.archivos.map((a) => a.resolucion), ['360p']);
    assert.ok(r.advertencias.some((a) => /MPEG-4/.test(a)));
    assert.ok(r.advertencias.some((a) => /créditos/.test(a)));
    const sd = conMedia(() => agregarVideo({ archivo: path.join(tmp, 'sd.mp4'), id: 'sd', log: quieto.log }));
    assert.deepEqual(sd.archivos.map((a) => a.resolucion), ['360p']);
  });

  caso('errores claros: repetido, id inválido, tipo inválido, archivo inexistente y archivo que no es MP4', () => {
    const falla = (o, re) => assert.throws(() => conMedia(() => agregarVideo({ log: quieto.log, ...o })), re);
    falla({ archivo: path.join(tmp, 'hd.mp4'), titulo: 'Película de Prueba' }, /Ya existe/);
    conMedia(() => agregarVideo({ archivo: path.join(tmp, 'hd.mp4'), titulo: 'Película de Prueba', reemplazar: true, sin360: true, log: quieto.log })); // --reemplazar sí deja
    falla({ archivo: path.join(tmp, 'hd.mp4'), id: 'Con Espacios' }, /id inválido/);
    falla({ archivo: path.join(tmp, 'hd.mp4'), id: 'otro', tipo: 'serie' }, /--tipo/);
    falla({ archivo: path.join(tmp, 'no-existe.mp4') }, /No existe el archivo/);
    fs.writeFileSync(path.join(tmp, 'falso.mp4'), 'esto no es video');
    falla({ archivo: path.join(tmp, 'falso.mp4') }, /no es un MP4 legible/);
    falla({}, /Falta el archivo/);
  });

  caso('desde la línea de comandos: opción desconocida y falta de archivo terminan con error (código 1)', () => {
    const cli = (...a) => spawnSync(process.execPath, [path.join(DIR, 'scripts', 'agregar-video.js'), ...a], { encoding: 'utf8', env: { ...process.env, MEDIA_DIR: media } });
    const r1 = cli(path.join(tmp, 'hd.mp4'), '--colores', 'rojo');
    assert.equal(r1.status, 1);
    assert.match(r1.stderr, /Opción desconocida/);
    assert.equal(cli().status, 1);
    const ok1 = cli(path.join(tmp, 'sd.mp4'), '--id', 'desde-cli', '--titulo', 'Desde CLI', '--generos', 'drama');
    assert.equal(ok1.status, 0, ok1.stderr);
    assert.match(ok1.stdout, /Listo: "Desde CLI"/);
  });

  fs.rmSync(tmp, { recursive: true, force: true });
}

// ====================================================================
console.log('\n== Extremo a extremo por HTTP (Proxy de protección + Range) ==');
// ====================================================================
const hash = await bcrypt.hash('clave123', 4);
const plan = (tipo, calidad) => ({ plan_tipo: tipo, precio_mensual: 1, calidad_maxima: calidad, pantallas_simultaneas: 1, descargas_offline: false });
const tabla = [
  { id: 1, nombre: 'Ana Admin', correo: 'admin@x.com', password: hash, rol: 'admin', ...plan('premium', 'Full HD (1080p)') },
  { id: 3, nombre: 'Ulises', correo: 'ulises@x.com', password: hash, rol: 'usuario', ...plan('free', 'SD (480p)') },
];
db.pool.query = async (sql, p = []) => {
  const q = sql.replace(/\s+/g, ' ');
  if (q.startsWith('SELECT * FROM usuarios WHERE correo')) return { rows: tabla.filter((u) => u.correo === p[0]) };
  if (q.startsWith('SELECT * FROM usuarios WHERE id')) return { rows: tabla.filter((u) => u.id === Number(p[0])) };
  throw new Error(`SQL no soportado por la BD falsa: ${q}`);
};

await import('./index.js');
const BASE = 'http://localhost:5000';
const json = async (metodo, ruta, { token, body } = {}) => {
  const r = await fetch(BASE + ruta, { method: metodo, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
};
const login = async (email) => (await json('POST', '/api/login', { body: { email, password: 'clave123' } })).data.token;
const [tAdmin, tFree] = [await login('admin@x.com'), await login('ulises@x.com')];
const tamano720 = fs.statSync(path.join(DIR, 'media', 'spring', '720p.mp4')).size;

// El cliente intenta mandar su propio país: el servidor lo ignora (decide por configuración/cabecera).
const autorizar = (token, contenidoId = 'spring') => json('POST', '/api/stream/autorizar', { token, body: { contenidoId, proveedorExterno: 'auto', dispositivoId: 'dev-test', pais: 'ZZ' } });
// `lic` es el objeto "licencia" que devolvió /autorizar (de ahí salen sesionId y licenciaId).
const entrega = (token, lic, contenidoId = 'spring') => json('POST', '/api/stream/entrega', { token, body: { contenidoId, tipoEntrega: 'vod', protocolo: 'auto', sesionId: lic?.sesionId, tokenDRM: lic?.licenciaId } });
const ticketDe = (url) => new URLSearchParams(url.split('?')[1]).get('ticket');
const rango = (url, r = 'bytes=0-99') => fetch(url, { headers: { Range: r } }).then(async (x) => { await x.arrayBuffer(); return x.status; });

let licAdmin; let licFree; let urlAdmin; let urlFree;
await casoAsync('flujo completo: autorizar (DRM) -> entrega (Bridge) -> el plan decide las calidades', async () => {
  const aAdmin = await autorizar(tAdmin);
  const aFree = await autorizar(tFree);
  assert.equal(aAdmin.status, 200);
  licAdmin = aAdmin.data.licencia;
  licFree = aFree.data.licencia;
  assert.equal(licAdmin.region, 'CO');                       // decidida por el servidor (el cliente mandó "ZZ")
  assert.match(licAdmin.regionOrigen, /servidor/);
  const admin = await entrega(tAdmin, licAdmin);
  const free = await entrega(tFree, licFree);
  assert.equal(admin.status, 200);
  assert.deepEqual(admin.data.manifest.calidades.map((c) => c.resolucion), ['360p', '720p']); // Premium
  assert.deepEqual(free.data.manifest.calidades.map((c) => c.resolucion), ['360p']);          // Free
  assert.equal(admin.data.manifest.adaptativo, false);
  urlAdmin = admin.data.manifest.calidades[1].url;
  urlFree = free.data.manifest.calidades[0].url;
  assert.equal((await entrega(undefined, licAdmin)).status, 401);
});

await casoAsync('la licencia define cuánto dura el acceso: el ticket vence con ella', async () => {
  const m = (await entrega(tAdmin, licAdmin)).data.manifest;
  assert.ok(licAdmin.duracionMinutos > 0);
  assert.ok(m.ticketExpiraEnMin <= licAdmin.duracionMinutos && m.ticketExpiraEnMin >= licAdmin.duracionMinutos - 1, `${m.ticketExpiraEnMin} vs ${licAdmin.duracionMinutos}`);
  assert.ok(Math.abs(new Date(licAdmin.venceEn).getTime() - (Date.now() + licAdmin.duracionMinutos * 60000)) < 10000);
  const f = (await entrega(tFree, licFree)).data.manifest;
  assert.ok(f.ticketExpiraEnMin <= licFree.duracionMinutos); // cada plan tiene su duración (Básica: menos)
});

await casoAsync('/entrega sin licencia vigente: 403 con código (el DRM ya no se puede saltar)', async () => {
  assert.equal((await entrega(tAdmin, undefined)).data.codigo, 'SIN_LICENCIA');
  assert.equal((await entrega(tAdmin, { sesionId: 'SES-123456', licenciaId: 'x' })).data.codigo, 'SESION_EXPIRADA');
  assert.equal((await entrega(tFree, licAdmin)).data.codigo, 'SESION_EXPIRADA');                       // la licencia de otro usuario
  assert.equal((await entrega(tAdmin, { ...licAdmin, licenciaId: 'LIC-FALSA' })).data.codigo, 'LICENCIA_INVALIDA'); // id inventado
  const otro = await autorizar(tAdmin, 'ambar'); // licencia de OTRO título (mismo dispositivo: reemplaza la sesión previa)
  assert.equal((await entrega(tAdmin, otro.data.licencia)).data.codigo, 'LICENCIA_OTRO_CONTENIDO');
  licAdmin = (await autorizar(tAdmin)).data.licencia; // se vuelve a autorizar Spring para seguir
  urlAdmin = (await entrega(tAdmin, licAdmin)).data.manifest.calidades[1].url;
});

await casoAsync('GET /media con ticket: 200 y el video completo', async () => {
  const r = await fetch(urlAdmin);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'video/mp4');
  assert.equal(r.headers.get('accept-ranges'), 'bytes');
  assert.equal(r.headers.get('content-disposition'), null); // reproducir no es descargar
  assert.equal(Number(r.headers.get('content-length')), tamano720);
  await r.body.cancel();
});

await casoAsync('GET /media con Range: 206 con el tramo pedido (lo que permite adelantar el video)', async () => {
  const r = await fetch(urlAdmin, { headers: { Range: 'bytes=1000-1999' } });
  assert.equal(r.status, 206);
  assert.equal(r.headers.get('content-range'), `bytes 1000-1999/${tamano720}`);
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(buf.length, 1000);
  const fd = fs.openSync(path.join(DIR, 'media', 'spring', '720p.mp4'), 'r');
  const esperado = Buffer.alloc(1000); fs.readSync(fd, esperado, 0, 1000, 1000); fs.closeSync(fd);
  assert.ok(buf.equals(esperado)); // son exactamente los bytes del archivo
});

await casoAsync('GET /media sin ticket, manipulado, de otro contenido o con sesión pero sin ticket: denegado', async () => {
  const sinTicket = urlAdmin.split('?')[0];
  assert.equal((await fetch(sinTicket)).status, 401);
  assert.equal((await fetch(`${sinTicket}?ticket=abc.def`)).status, 403);
  assert.equal((await fetch(`${BASE}/media/ambar/720p.mp4?ticket=${ticketDe(urlAdmin)}`)).status, 403); // ticket de otro título
  // estar logueado NO basta: sin ticket (sin licencia DRM) tampoco se ve el video
  assert.equal((await fetch(sinTicket, { headers: { Authorization: `Bearer ${tAdmin}`, Range: 'bytes=0-99' } })).status, 403);
});

await casoAsync('GET /media: solo archivos declarados (nunca meta.json, ../ ni archivos inexistentes)', async () => {
  for (const archivo of ['meta.json', '1080p.mp4', '..%2F..%2Findex.js', '%2e%2e%2fmeta.json']) {
    const r = await fetch(`${BASE}/media/spring/${archivo}?ticket=${ticketDe(urlAdmin)}`);
    assert.ok([403, 404].includes(r.status), `${archivo} -> ${r.status}`);
  }
});

await casoAsync('descarga offline: solo si la LICENCIA la permite (Premium sí, Free no)', async () => {
  const mAdmin = (await entrega(tAdmin, licAdmin)).data.manifest;
  const mFree = (await entrega(tFree, licFree)).data.manifest;
  assert.equal(licAdmin.permiteOffline, true);
  assert.equal(mAdmin.permiteDescarga, true);
  assert.equal(mFree.permiteDescarga, false);
  const conLicencia = await fetch(`${mAdmin.calidades[0].url}&descargar=1`);
  assert.equal(conLicencia.status, 200);
  assert.match(conLicencia.headers.get('content-disposition'), /^attachment; filename="spring-360p\.mp4"$/);
  await conLicencia.body.cancel();
  assert.equal((await fetch(`${mFree.calidades[0].url}&descargar=1`)).status, 403); // sin permiso offline: no hay descarga...
  assert.equal(await rango(mFree.calidades[0].url), 206);                          // ...pero sí puede verlo en streaming
});

await casoAsync('Detener libera la pantalla Y mata el ticket: el video deja de servirse al instante', async () => {
  assert.equal(await rango(urlAdmin), 206); // antes: funciona
  const det = await json('POST', '/api/stream/detener', { token: tAdmin, body: { sesionId: licAdmin.sesionId } });
  assert.equal(det.status, 200);
  assert.equal(await rango(urlAdmin), 403); // después: el ticket sigue "vigente" por fecha, pero su sesión ya no
  assert.equal((await entrega(tAdmin, licAdmin)).data.codigo, 'SESION_EXPIRADA'); // y no se pueden pedir más tickets con ella
});

await casoAsync('latido: renueva la sesión mientras se ve; avisa { vigente:false } cuando ya no existe', async () => {
  licAdmin = (await autorizar(tAdmin)).data.licencia;
  const latido = (token, sesionId) => json('POST', '/api/stream/latido', { token, body: { sesionId } });
  assert.equal((await latido(tAdmin, licAdmin.sesionId)).data.vigente, true);
  assert.equal((await latido(undefined, licAdmin.sesionId)).status, 401);
  assert.equal((await latido(tFree, licAdmin.sesionId)).data.vigente, false); // la sesión de otro usuario "no existe" para mí
  await json('POST', '/api/stream/detener', { token: tAdmin, body: { sesionId: licAdmin.sesionId } });
  assert.equal((await latido(tAdmin, licAdmin.sesionId)).data.vigente, false);
});

await casoAsync('una sesión inactiva vence sola (10 min) y el video deja de servirse; el latido la mantiene viva', async () => {
  licFree = (await autorizar(tFree)).data.licencia;
  urlFree = (await entrega(tFree, licFree)).data.manifest.calidades[0].url;
  SesionesRegistry.buscar(3, licFree.sesionId).inicio = Date.now() - 9 * 60 * 1000; // 9 min sin actividad
  assert.equal((await json('POST', '/api/stream/latido', { token: tFree, body: { sesionId: licFree.sesionId } })).data.vigente, true);
  assert.ok(Date.now() - SesionesRegistry.buscar(3, licFree.sesionId).inicio < 5000); // el latido la renovó
  SesionesRegistry.buscar(3, licFree.sesionId).inicio = Date.now() - 11 * 60 * 1000;  // 11 min sin actividad
  assert.equal(await rango(urlFree), 403);
});

await casoAsync('la licencia VENCIDA corta el video aunque haya actividad (duración real, no decorativa)', async () => {
  licFree = (await autorizar(tFree)).data.licencia;
  urlFree = (await entrega(tFree, licFree)).data.manifest.calidades[0].url;
  assert.equal(await rango(urlFree), 206);
  SesionesRegistry.buscar(3, licFree.sesionId).expiraEn = Date.now() - 1; // la licencia llegó a su fin
  assert.equal(await rango(urlFree), 403);
  assert.equal((await json('POST', '/api/stream/latido', { token: tFree, body: { sesionId: licFree.sesionId } })).data.vigente, false);
});

await casoAsync('bajar de plan (el Observer libera pantallas) corta el video en curso', async () => {
  licFree = (await autorizar(tFree)).data.licencia;
  urlFree = (await entrega(tFree, licFree)).data.manifest.calidades[0].url;
  assert.equal(await rango(urlFree), 206);
  SesionesRegistry.limitar(3, 0); // lo que hace ObservadorPlanDRM al bajar de plan
  assert.equal(await rango(urlFree), 403);
});

await casoAsync('región por HTTP: manda el servidor (PAIS_POR_DEFECTO / cabecera del CDN), nunca el cliente', async () => {
  const antes = { ...process.env };
  try {
    process.env.PAIS_POR_DEFECTO = 'ZZ'; // un país sin derechos de distribución
    const r = await autorizar(tAdmin);
    assert.equal(r.status, 403);
    assert.equal(r.data.codigo, 'REGION_NO_PERMITIDA');
    delete process.env.PAIS_POR_DEFECTO;
    process.env.GEO_CABECERA_PAIS = 'x-pais-cdn';
    const con = (pais) => fetch(`${BASE}/api/stream/autorizar`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tAdmin}`, ...(pais ? { 'x-pais-cdn': pais } : {}) }, body: JSON.stringify({ contenidoId: 'spring', proveedorExterno: 'auto', dispositivoId: 'dev-test', pais: 'CO' }) });
    assert.equal((await con('MX')).status, 200);   // el CDN dice México: permitido
    assert.equal((await con('RU')).status, 403);   // el CDN dice Rusia: bloqueado (aunque el cliente jure ser "CO")
    assert.equal((await con(undefined)).status, 403); // sin cabecera no se adivina
  } finally { process.env = antes; }
});

await casoAsync('el catálogo por HTTP marca el video real y trae los créditos y la duración real', async () => {
  const d = await json('GET', '/api/catalogo/spring', { token: tFree });
  assert.equal(d.status, 200);
  assert.equal(d.data.contenido.contenidoReal, true);
  assert.equal(d.data.contenido.creditos.licencia, 'CC-BY 4.0');
  assert.equal(d.data.contenido.duracionTexto, '7m 44s');
});

await casoAsync('Proxy: los accesos a video quedan en el log (PERMITIDO y DENEGADO), sin inundarlo con cada Range', async () => {
  const lic = (await autorizar(tAdmin)).data.licencia;
  const url = (await entrega(tAdmin, lic)).data.manifest.calidades[1].url;
  await rango(url, 'bytes=0-99'); // primer tramo: se registra
  const antes = (await json('GET', '/api/admin/accesos', { token: tAdmin })).data.eventos.filter((e) => e.servicio === 'media');
  assert.ok(antes.some((e) => e.resultado === 'PERMITIDO'));
  assert.ok(antes.some((e) => e.resultado === 'DENEGADO'));
  // 40 tramos más del mismo video NO agregan 40 filas (solo se registra el rango que empieza en 0)
  for (let i = 1; i <= 40; i++) await rango(url, `bytes=${i * 5000}-${i * 5000 + 99}`);
  const despues = (await json('GET', '/api/admin/accesos', { token: tAdmin })).data.eventos.filter((e) => e.servicio === 'media');
  assert.equal(despues.length, antes.length);
});

console.log(`\n🎉 ${ok} comprobaciones OK`);
process.exit(0);
