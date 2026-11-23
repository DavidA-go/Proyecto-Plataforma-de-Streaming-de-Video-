#!/usr/bin/env node
/**
 * agregar-video.js — agrega una película (un archivo .mp4) al catálogo con video real.
 *
 *   npm run agregar:video -- "C:\\Descargas\\Big_Buck_Bunny.mp4" --titulo "Big Buck Bunny" --generos animacion,comedia,familiar
 *
 * Opciones:
 *   --titulo "Texto"       título que se verá (por defecto, el nombre del archivo)
 *   --id mi-id             identificador (minúsculas, números y guiones; por defecto sale del título)
 *   --generos a,b,c        géneros separados por coma, sin tildes (por defecto: "sin-genero")
 *   --tipo pelicula|documental   (por defecto: pelicula)
 *   --autor "Nombre" --licencia "CC-BY 4.0" --url https://...   créditos que se muestran en el reproductor
 *   --sin-360              no crear la versión 360p (por defecto se crea si hay ffmpeg instalado)
 *   --sin-720              no crear la versión 720p (se crea si el original es Full HD o más y hay ffmpeg)
 *   --reemplazar           sobrescribir si ya existe una carpeta con ese id
 *   --serie "Nombre"       agrega el video como EPISODIO de una serie (la crea si no existe)
 *   --temporada N --episodio M   (con --serie) a qué temporada y episodio corresponde (por defecto 1 y el siguiente libre)
 *
 * Qué hace: lee el MP4 (duración, resolución, códec), lo copia a backend/media/<id>/ con el nombre de su
 * resolución, si hay ffmpeg crea la versión 360p (para los planes Free/Básico) y deja el índice al inicio
 * (para poder adelantar el video), y escribe el meta.json. Después solo hay que reiniciar el backend.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { infoMp4, nombreCodecVideo, nombreCodecAudio, resolucionPorAlto } from '../catalog/media/Mp4Info.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_MEDIA = () => (process.env.MEDIA_DIR ? path.resolve(process.env.MEDIA_DIR) : path.resolve(__dirname, '../media'));

const sinTildes = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const slug = (t) => sinTildes(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const hayFfmpeg = () => spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) throw new Error('ffmpeg falló (revisa el mensaje de arriba).');
}

/**
 * @param {object} o  { archivo, titulo?, id?, generos?, tipo?, autor?, licencia?, url?, sin360?, reemplazar?, log? }
 * @returns {{ id, carpeta, archivos, duracionMin, advertencias }}
 */
export function agregarVideo(o) {
  const log = o.log ?? ((m) => console.log(m));
  const advertencias = [];
  const avisar = (m) => { advertencias.push(m); log(`⚠️  ${m}`); };

  if (!o.archivo) throw new Error('Falta el archivo. Uso: npm run agregar:video -- "ruta\\\\pelicula.mp4" --titulo "Mi película" --generos accion,drama');
  const origen = path.resolve(o.archivo);
  if (!fs.existsSync(origen) || !fs.statSync(origen).isFile()) throw new Error(`No existe el archivo: ${origen}`);

  const info = infoMp4(origen);
  if (!info) {
    throw new Error(`"${path.basename(origen)}" no es un MP4 legible (¿es .mkv, .avi o .mov?). Conviértelo primero:\n  ffmpeg -i "entrada.mkv" -c:v libx264 -c:a aac -movflags +faststart "salida.mp4"`);
  }
  if (!info.duracionSeg || !info.alto) throw new Error('El archivo no tiene una pista de video válida.');

  if (o.serie) return agregarEpisodio(o, { origen, info, log, avisar, advertencias });

  const titulo = (o.titulo ?? path.basename(origen, path.extname(origen)).replace(/[_]+/g, ' ').replace(/\s+/g, ' ')).trim();
  const id = o.id ?? slug(titulo);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`id inválido "${id}": usa minúsculas, números y guiones (o pasa --id).`);
  const tipo = o.tipo ?? 'pelicula';
  if (!['pelicula', 'documental'].includes(tipo)) throw new Error('--tipo debe ser "pelicula" o "documental".');
  const generos = [...new Set((o.generos ?? 'sin-genero').split(',').map((g) => slug(g)).filter(Boolean))];

  const carpeta = path.join(DIR_MEDIA(), id);
  if (fs.existsSync(carpeta)) {
    if (!o.reemplazar) throw new Error(`Ya existe backend/media/${id}/. Usa otro --id o agrega --reemplazar.`);
    fs.rmSync(carpeta, { recursive: true, force: true });
  }

  log(`🎞️  ${path.basename(origen)}: ${info.ancho}x${info.alto}, ${nombreCodecVideo(info.codecVideo)} + ${nombreCodecAudio(info.codecAudio)}, ${(info.duracionSeg / 60).toFixed(1)} min`);
  if (!info.reproducibleEnNavegador) {
    avisar(`El video usa ${nombreCodecVideo(info.codecVideo)} + ${nombreCodecAudio(info.codecAudio)}. Muchos navegadores solo reproducen H.264 + AAC; si no se ve, conviértelo: ffmpeg -i "${path.basename(origen)}" -c:v libx264 -c:a aac -movflags +faststart salida.mp4`);
  }

  fs.mkdirSync(carpeta, { recursive: true });
  const resolucion = resolucionPorAlto(info.alto);
  const principal = `${resolucion}.mp4`;
  const ruta = path.join(carpeta, principal);
  const ffmpegDisponible = hayFfmpeg();

  // 1) archivo principal (con el índice al inicio, para poder adelantar sin bajarlo completo)
  if (!info.moovAlInicio && ffmpegDisponible) {
    log('🔧 El índice del MP4 está al final: se reordena (sin recodificar) para poder adelantar el video...');
    ffmpeg(['-i', origen, '-c', 'copy', '-movflags', '+faststart', ruta]);
  } else {
    fs.copyFileSync(origen, ruta);
    if (!info.moovAlInicio) avisar('El índice del MP4 está al final y no hay ffmpeg: el navegador no podrá adelantar hasta bajar todo el archivo.');
  }
  const archivos = [{ resolucion, archivo: principal }];

  // 2) versiones más livianas para los planes de menor calidad (360p siempre; 720p si el original es Full HD o más)
  archivos.unshift(...crearVersiones({ origen, carpeta, prefijo: '', info, o, ffmpegDisponible, log, avisar }));

  // 3) meta.json
  const duracionMin = Math.round((info.duracionSeg / 60) * 100) / 100;
  const meta = {
    id, tipo, titulo, duracionMin, generos, archivos,
    ...(o.autor || o.licencia || o.url ? { creditos: { autor: o.autor ?? '', licencia: o.licencia ?? '', url: o.url ?? '' } } : {}),
  };
  fs.writeFileSync(path.join(carpeta, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  if (!meta.creditos) avisar('No indicaste créditos (--autor, --licencia, --url). Si el video tiene licencia que exige atribución (p. ej. Creative Commons), agrégalos en meta.json.');

  log(`✅ Listo: "${titulo}" (${archivos.map((a) => a.resolucion).join(' + ')}) en backend/media/${id}/`);
  log('➡️  Reinicia el backend y búscalo en Inicio → «Con video real», o en Películas.');
  return { id, carpeta, archivos, duracionMin, advertencias };
}

/**
 * Crea las versiones livianas con ffmpeg para que cada plan tenga su calidad máxima:
 *   360p  -> Free (SD 480p) y base de todos los planes
 *   720p  -> Básico (HD 720p), solo si el original es Full HD o más grande
 * Devuelve las renditions creadas de menor a mayor (vacío si no hay ffmpeg o se pidió omitirlas).
 */
function crearVersiones({ origen, carpeta, prefijo, info, o, ffmpegDisponible, log, avisar }) {
  const pedidas = [];
  if (!o.sin360 && info.alto > 420) pedidas.push({ resolucion: '360p', alto: 360 });
  if (!o.sin720 && info.alto > 800) pedidas.push({ resolucion: '720p', alto: 720 });
  if (pedidas.length === 0) return [];
  if (!ffmpegDisponible) {
    avisar('No se encontró ffmpeg: solo habrá una calidad, así que los planes Free/Básico recibirían la versión grande (se salta la restricción por plan). Instálalo (https://ffmpeg.org), abre una terminal NUEVA y vuelve a ejecutar con --reemplazar.');
    return [];
  }
  return pedidas.map(({ resolucion, alto }) => {
    log(`🔧 Creando la versión ${resolucion} (puede tardar varios minutos)...`);
    const archivo = `${prefijo}${resolucion}.mp4`;
    ffmpeg(['-i', origen, '-vf', `scale=-2:${alto}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', alto === 360 ? '27' : '24', '-c:a', 'aac', '-b:a', alto === 360 ? '96k' : '128k', '-movflags', '+faststart', path.join(carpeta, archivo)]);
    return { resolucion, archivo };
  });
}

/** Agrega un MP4 como episodio de una serie (backend/media/<id-serie>/meta.json con tipo "serie"). */
function agregarEpisodio(o, { origen, info, log, avisar, advertencias }) {
  const idSerie = o.id ?? slug(o.serie);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(idSerie)) throw new Error(`id de serie inválido "${idSerie}": usa minúsculas, números y guiones (o pasa --id).`);
  const carpeta = path.join(DIR_MEDIA(), idSerie);
  const rutaMeta = path.join(carpeta, 'meta.json');

  let meta;
  if (fs.existsSync(rutaMeta)) {
    meta = JSON.parse(fs.readFileSync(rutaMeta, 'utf8').replace(/^\uFEFF/, ''));
    if (meta.tipo !== 'serie') throw new Error(`backend/media/${idSerie}/ ya existe y no es una serie. Usa otro --id.`);
  } else {
    const generos = [...new Set((o.generos ?? 'sin-genero').split(',').map((g) => slug(g)).filter(Boolean))];
    meta = { id: idSerie, tipo: 'serie', titulo: o.serie.trim(), generos, temporadas: [] };
    if (o.autor || o.licencia || o.url) meta.creditos = { autor: o.autor ?? '', licencia: o.licencia ?? '', url: o.url ?? '' };
  }

  const numTemp = o.temporada ? Number.parseInt(o.temporada, 10) : 1;
  if (!Number.isInteger(numTemp) || numTemp < 1 || numTemp > meta.temporadas.length + 1) {
    throw new Error(`--temporada debe estar entre 1 y ${meta.temporadas.length + 1}.`);
  }
  if (!meta.temporadas[numTemp - 1]) meta.temporadas[numTemp - 1] = { episodios: [] };
  const episodios = meta.temporadas[numTemp - 1].episodios;
  const numEp = o.episodio ? Number.parseInt(o.episodio, 10) : episodios.length + 1;
  if (!Number.isInteger(numEp) || numEp < 1 || numEp > episodios.length + 1) {
    throw new Error(`--episodio debe estar entre 1 y ${episodios.length + 1} (los episodios se agregan en orden).`);
  }
  if (episodios[numEp - 1] && !o.reemplazar) throw new Error(`Ya existe T${numTemp}E${numEp} en "${idSerie}". Usa otro número o agrega --reemplazar.`);

  log(`🎞️  ${path.basename(origen)}: ${info.ancho}x${info.alto}, ${nombreCodecVideo(info.codecVideo)} + ${nombreCodecAudio(info.codecAudio)}, ${(info.duracionSeg / 60).toFixed(1)} min`);
  if (!info.reproducibleEnNavegador) {
    avisar(`El video usa ${nombreCodecVideo(info.codecVideo)} + ${nombreCodecAudio(info.codecAudio)}. Muchos navegadores solo reproducen H.264 + AAC; si no se ve, conviértelo: ffmpeg -i "${path.basename(origen)}" -c:v libx264 -c:a aac -movflags +faststart salida.mp4`);
  }

  fs.mkdirSync(carpeta, { recursive: true });
  const resolucion = resolucionPorAlto(info.alto);
  const prefijo = `t${numTemp}e${numEp}`;
  const principal = `${prefijo}-${resolucion}.mp4`;
  const ffmpegDisponible = hayFfmpeg();

  if (!info.moovAlInicio && ffmpegDisponible) {
    log('🔧 El índice del MP4 está al final: se reordena (sin recodificar)...');
    ffmpeg(['-i', origen, '-c', 'copy', '-movflags', '+faststart', path.join(carpeta, principal)]);
  } else {
    fs.copyFileSync(origen, path.join(carpeta, principal));
    if (!info.moovAlInicio) avisar('El índice del MP4 está al final y no hay ffmpeg: no se podrá adelantar hasta bajar todo el archivo.');
  }
  const archivos = [{ resolucion, archivo: principal }];

  archivos.unshift(...crearVersiones({ origen, carpeta, prefijo: `${prefijo}-`, info, o, ffmpegDisponible, log, avisar }));

  const duracionMin = Math.round((info.duracionSeg / 60) * 100) / 100;
  const titulo = (o.titulo ?? `Episodio ${numEp}`).trim();
  episodios[numEp - 1] = { titulo, duracionMin, archivos };
  fs.writeFileSync(rutaMeta, `${JSON.stringify(meta, null, 2)}\n`);

  log(`✅ Listo: "${meta.titulo}" T${numTemp}E${numEp} "${titulo}" (${archivos.map((a) => a.resolucion).join(' + ')}) en backend/media/${idSerie}/`);
  log('➡️  Reinicia el backend y búscalo en la pestaña Series (y en Inicio → «Con video real»).');
  return { id: idSerie, carpeta, archivos, duracionMin, advertencias };
}

// ---------------- línea de comandos ----------------
function leerArgumentos(argv) {
  const o = {};
  const mapa = { '--titulo': 'titulo', '--id': 'id', '--generos': 'generos', '--tipo': 'tipo', '--autor': 'autor', '--licencia': 'licencia', '--url': 'url', '--serie': 'serie', '--temporada': 'temporada', '--episodio': 'episodio' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sin-360') o.sin360 = true;
    else if (a === '--sin-720') o.sin720 = true;
    else if (a === '--reemplazar') o.reemplazar = true;
    else if (mapa[a]) {
      if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw new Error(`Falta el valor de ${a}.`);
      o[mapa[a]] = argv[++i];
    } else if (a.startsWith('--')) throw new Error(`Opción desconocida: ${a}`);
    else if (!o.archivo) o.archivo = a;
    else throw new Error(`Sobra el argumento "${a}" (si el título lleva espacios, ponlo entre comillas).`);
  }
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    agregarVideo(leerArgumentos(process.argv.slice(2)));
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
}
