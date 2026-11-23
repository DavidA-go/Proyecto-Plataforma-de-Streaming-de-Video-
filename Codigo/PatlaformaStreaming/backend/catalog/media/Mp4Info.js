import fs from 'fs';

/**
 * Mp4Info.js
 * ------------------------------------------------------------------
 * Lee los datos de un archivo MP4 SIN depender de ffmpeg/ffprobe (que en tu equipo puede no estar
 * instalado). Un MP4 es una secuencia de "cajas" (tamaño + tipo); la caja `moov` contiene la
 * información: `mvhd` (duración), y por cada pista `trak` su tamaño (`tkhd`), su tipo (`hdlr`:
 * video o audio) y su códec (`stsd`). Solo se lee la cabecera, nunca el video completo.
 * ------------------------------------------------------------------
 */

const MAX_MOOV = 64 * 1024 * 1024; // un `moov` de más de 64 MB no es razonable: se ignora el archivo

/** Cajas hijas dentro de buf[ini, fin): [{ tipo, ini (contenido), fin }] */
function cajas(buf, ini = 0, fin = buf.length) {
  const out = [];
  let pos = ini;
  while (pos + 8 <= fin) {
    let tam = buf.readUInt32BE(pos);
    const tipo = buf.toString('latin1', pos + 4, pos + 8);
    let cab = 8;
    if (tam === 1) { tam = Number(buf.readBigUInt64BE(pos + 8)); cab = 16; } // tamaño de 64 bits
    else if (tam === 0) tam = fin - pos;                                     // "hasta el final"
    if (tam < cab || pos + tam > fin) break;
    out.push({ tipo, ini: pos + cab, fin: pos + tam });
    pos += tam;
  }
  return out;
}
const hijo = (buf, caja, tipo) => cajas(buf, caja.ini, caja.fin).find((c) => c.tipo === tipo);

/** Cajas del nivel superior del archivo (sin cargar el contenido) y el `moov` en memoria. */
function leerEstructura(ruta) {
  const fd = fs.openSync(ruta, 'r');
  try {
    const total = fs.fstatSync(fd).size;
    const cab = Buffer.alloc(16);
    const orden = [];
    let moov = null;
    let pos = 0;
    while (pos + 8 <= total) {
      fs.readSync(fd, cab, 0, 16, pos);
      let tam = cab.readUInt32BE(0);
      const tipo = cab.toString('latin1', 4, 8);
      let cabecera = 8;
      if (tam === 1) { tam = Number(cab.readBigUInt64BE(8)); cabecera = 16; }
      else if (tam === 0) tam = total - pos;
      if (tam < cabecera || pos + tam > total) break;
      orden.push(tipo);
      if (tipo === 'moov' && tam <= MAX_MOOV) {
        const buf = Buffer.alloc(tam - cabecera);
        fs.readSync(fd, buf, 0, buf.length, pos + cabecera);
        moov = buf;
      }
      pos += tam;
    }
    return { orden, moov };
  } finally {
    fs.closeSync(fd);
  }
}

const CODEC_VIDEO = { avc1: 'H.264', avc3: 'H.264', hvc1: 'HEVC (H.265)', hev1: 'HEVC (H.265)', av01: 'AV1', vp09: 'VP9', mp4v: 'MPEG-4' };
const CODEC_AUDIO = { mp4a: 'AAC', 'ac-3': 'AC-3', 'ec-3': 'E-AC-3', Opus: 'Opus', fLaC: 'FLAC' };

/**
 * @returns {null | {
 *   duracionSeg: number|null, ancho: number|null, alto: number|null,
 *   codecVideo: string|null, codecAudio: string|null, moovAlInicio: boolean,
 *   reproducibleEnNavegador: boolean }}  null si el archivo no es un MP4 legible
 */
export function infoMp4(ruta) {
  try {
    const { orden, moov } = leerEstructura(ruta);
    if (!moov) { infoMp4.ultimoError = 'no se encontró el índice (moov): el archivo está incompleto, cortado o no es un MP4'; return null; }
    const info = { duracionSeg: null, ancho: null, alto: null, codecVideo: null, codecAudio: null, moovAlInicio: orden.indexOf('moov') < orden.indexOf('mdat') || orden.indexOf('mdat') === -1 };

    const raiz = { ini: 0, fin: moov.length };
    const mvhd = hijo(moov, raiz, 'mvhd');
    if (mvhd) {
      const v1 = moov[mvhd.ini] === 1;
      const escala = v1 ? moov.readUInt32BE(mvhd.ini + 20) : moov.readUInt32BE(mvhd.ini + 12);
      const dur = v1 ? Number(moov.readBigUInt64BE(mvhd.ini + 24)) : moov.readUInt32BE(mvhd.ini + 16);
      if (escala > 0) info.duracionSeg = dur / escala;
    }

    for (const trak of cajas(moov, raiz.ini, raiz.fin).filter((c) => c.tipo === 'trak')) {
      const mdia = hijo(moov, trak, 'mdia');
      const hdlr = mdia && hijo(moov, mdia, 'hdlr');
      const tipoPista = hdlr ? moov.toString('latin1', hdlr.ini + 8, hdlr.ini + 12) : '';
      const stsd = mdia && hijo(moov, mdia, 'minf') && hijo(moov, hijo(moov, mdia, 'minf'), 'stbl') && hijo(moov, hijo(moov, hijo(moov, mdia, 'minf'), 'stbl'), 'stsd');
      const fourcc = stsd ? moov.toString('latin1', stsd.ini + 12, stsd.ini + 16) : null;

      if (tipoPista === 'vide' && info.alto === null) {
        const tkhd = hijo(moov, trak, 'tkhd');
        if (tkhd) {
          const off = tkhd.ini + (moov[tkhd.ini] === 1 ? 88 : 76); // ancho y alto: enteros de 16.16 al final de la caja
          info.ancho = Math.round(moov.readUInt32BE(off) / 65536);
          info.alto = Math.round(moov.readUInt32BE(off + 4) / 65536);
        }
        info.codecVideo = fourcc;
      } else if (tipoPista === 'soun' && info.codecAudio === null) {
        info.codecAudio = fourcc;
      }
    }

    // Chrome, Edge, Firefox y Safari reproducen H.264 + AAC en cualquier equipo; HEVC/AV1/AC-3 dependen del equipo.
    info.reproducibleEnNavegador = ['avc1', 'avc3'].includes(info.codecVideo) && (info.codecAudio === null || info.codecAudio === 'mp4a');
    return info;
  } catch (e) {
    infoMp4.ultimoError = `${e.code ? `${e.code}: ` : ''}${e.message}`; // para que el aviso diga POR QUÉ no se pudo leer
    return null;
  }
}

export const nombreCodecVideo = (fourcc) => CODEC_VIDEO[fourcc] ?? fourcc ?? 'desconocido';
export const nombreCodecAudio = (fourcc) => CODEC_AUDIO[fourcc] ?? fourcc ?? 'sin audio';

/** Duración en segundos (con decimales) o null si el archivo no es un MP4 legible. */
export function duracionMp4Segundos(ruta) {
  const d = infoMp4(ruta)?.duracionSeg;
  return Number.isFinite(d) ? d : null;
}

/** Etiqueta de calidad según el alto del video: 1080p, 720p, 480p o 360p. */
export function resolucionPorAlto(alto) {
  if (alto >= 1000) return '1080p';
  if (alto >= 650) return '720p';
  if (alto >= 420) return '480p';
  return '360p';
}
