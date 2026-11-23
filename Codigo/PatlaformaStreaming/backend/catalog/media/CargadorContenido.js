import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ContenidoFactory from './ContenidoFactory.js';
import FuenteLocal from './FuenteLocal.js';
import ElementoContenido from '../ElementoContenido.js';
import Serie from '../Serie.js';
import Temporada from '../Temporada.js';
import Episodio from '../Episodio.js';
import { infoMp4, nombreCodecVideo, nombreCodecAudio } from './Mp4Info.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * CargadorContenido
 * ------------------------------------------------------------------
 * Recorre backend/media/ y arma una hoja del catálogo por cada carpeta que
 * tenga un meta.json. Para agregar una película NO se toca código:
 *
 *   backend/media/<id>/meta.json   (datos + créditos + lista de archivos)
 *   backend/media/<id>/720p.mp4    (los archivos que declare el meta.json)
 *
 * Es tolerante: si falta un archivo o el meta.json está mal, ese título se
 * omite con una advertencia y el resto de la plataforma arranca igual.
 * ------------------------------------------------------------------
 */
class CargadorContenido {
  static directorioPorDefecto() {
    return process.env.MEDIA_DIR ? path.resolve(process.env.MEDIA_DIR) : path.resolve(__dirname, '../../media');
  }

  static baseUrlPorDefecto() {
    return process.env.MEDIA_BASE_URL || 'http://localhost:5000';
  }

  /** @returns {ElementoContenido[]} hojas listas para colgar de una Coleccion */
  static cargar({ directorio = CargadorContenido.directorioPorDefecto(), baseUrl = CargadorContenido.baseUrlPorDefecto() } = {}) {
    if (!fs.existsSync(directorio)) return [];

    const nodos = [];
    const carpetas = fs.readdirSync(directorio, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const carpeta of carpetas.sort((a, b) => a.name.localeCompare(b.name))) {
      const dirContenido = path.join(directorio, carpeta.name);
      const rutaMeta = path.join(dirContenido, 'meta.json');
      if (!fs.existsSync(rutaMeta)) continue;

      try {
        const meta = JSON.parse(fs.readFileSync(rutaMeta, 'utf8').replace(/^\uFEFF/, '')) // el BOM que deja PowerShell no debe romper la lectura;
        if (meta.id !== carpeta.name) throw new Error(`el id "${meta.id}" debe coincidir con el nombre de la carpeta "${carpeta.name}".`);

        if (meta.tipo === 'serie') {
          nodos.push(CargadorContenido.#cargarSerie(meta, dirContenido, baseUrl));
          continue;
        }

        const declarados = Array.isArray(meta.archivos) ? meta.archivos : [];
        const presentes = declarados.filter((a) => {
          const existe = typeof a?.archivo === 'string' && fs.existsSync(path.join(dirContenido, a.archivo));
          if (!existe) console.warn(`⚠️  [Contenido] ${carpeta.name}: falta el archivo "${a?.archivo}" (${a?.resolucion}); se omite esa calidad.`);
          return existe;
        });
        if (presentes.length === 0) throw new Error('no hay ningún archivo de video disponible.');

        // La duración de verdad sale del propio MP4; "duracionMin" del meta.json solo es el respaldo.
        const infos = presentes.map((a) => ({ a, info: infoMp4(path.join(dirContenido, a.archivo)) }));
        for (const { a, info } of infos) {
          if (!info) { console.warn(`⚠️  [Contenido] ${carpeta.name}/${a.archivo} no se pudo leer como MP4 (${infoMp4.ultimoError ?? 'motivo desconocido'}): puede que no se reproduzca.`); continue; }
          if (!info.reproducibleEnNavegador) {
            console.warn(`⚠️  [Contenido] ${carpeta.name}/${a.archivo} usa ${nombreCodecVideo(info.codecVideo)} + ${nombreCodecAudio(info.codecAudio)}: muchos navegadores no lo reproducen. Conviértelo a H.264 + AAC.`);
          }
          if (!info.moovAlInicio) {
            console.warn(`⚠️  [Contenido] ${carpeta.name}/${a.archivo} no tiene el índice al inicio: no se podrá adelantar hasta bajarlo completo (usa "npm run agregar:video" o ffmpeg -movflags +faststart).`);
          }
        }
        const segundos = infos.map(({ info }) => info?.duracionSeg).find((d) => Number.isFinite(d) && d > 0);
        if (segundos) {
          meta.duracionMin = segundos / 60;
          console.log(`🎞️  [Contenido] ${carpeta.name}: duración real leída del MP4 = ${ElementoContenido.formatearDuracion(meta.duracionMin)} (${segundos.toFixed(1)} s)`);
        }

        const fuente = new FuenteLocal({ directorio: dirContenido, archivos: presentes, baseUrl, creditos: meta.creditos ?? null });
        nodos.push(ContenidoFactory.crear(meta, fuente));
      } catch (e) {
        console.warn(`⚠️  [Contenido] "${carpeta.name}" omitido: ${e.message}`);
      }
    }
    return nodos;
  }

  /**
   * Serie con video real. meta.json:
   *   { "id": "mi-serie", "tipo": "serie", "titulo": "...", "generos": [...],
   *     "temporadas": [ { "episodios": [ { "titulo": "...", "duracionMin": 8,
   *                                         "archivos": [ { "resolucion": "720p", "archivo": "t1e1-720p.mp4" } ] } ] } ] }
   * Los archivos viven en la misma carpeta backend/media/<id>/. Los ids de los episodios son
   * <id>-t<T>-e<E> (el video se pide por ese id). Un episodio sin archivos válidos se omite.
   */
  static #cargarSerie(meta, dirContenido, baseUrl) {
    if (typeof meta.titulo !== 'string' || !meta.titulo.trim()) throw new Error('falta "titulo".');
    if (!Array.isArray(meta.generos) || meta.generos.some((g) => typeof g !== 'string')) throw new Error('"generos" debe ser una lista de textos.');
    if (!Array.isArray(meta.temporadas) || meta.temporadas.length === 0) throw new Error('una serie necesita "temporadas" con al menos un episodio.');

    const serie = new Serie(meta.id, meta.titulo, meta.generos);
    let totalEpisodios = 0;
    meta.temporadas.forEach((t, i) => {
      const numTemp = i + 1;
      const temporada = new Temporada(`${meta.id}-t${numTemp}`, t.titulo ?? `Temporada ${numTemp}`);
      (t.episodios ?? []).forEach((ep, j) => {
        const numEp = j + 1;
        const presentes = (ep.archivos ?? []).filter((a) => {
          const existe = typeof a?.archivo === 'string' && fs.existsSync(path.join(dirContenido, a.archivo));
          if (!existe) console.warn(`⚠️  [Contenido] ${meta.id} T${numTemp}E${numEp}: falta el archivo "${a?.archivo}"; se omite esa calidad.`);
          return existe;
        });
        if (presentes.length === 0) { console.warn(`⚠️  [Contenido] ${meta.id} T${numTemp}E${numEp}: sin video; se omite el episodio.`); return; }

        const infos = presentes.map((a) => infoMp4(path.join(dirContenido, a.archivo)));
        const segundos = infos.map((x) => x?.duracionSeg).find((d) => Number.isFinite(d) && d > 0);
        const duracionMin = segundos ? segundos / 60 : ep.duracionMin;
        if (!Number.isFinite(duracionMin) || duracionMin <= 0) { console.warn(`⚠️  [Contenido] ${meta.id} T${numTemp}E${numEp}: sin duración; se omite el episodio.`); return; }

        const fuente = new FuenteLocal({ directorio: dirContenido, archivos: presentes, baseUrl, creditos: meta.creditos ?? null });
        temporada.agregar(new Episodio(`${meta.id}-t${numTemp}-e${numEp}`, ep.titulo ?? `Episodio ${numEp}`, numEp, duracionMin, meta.generos).asignarFuente(fuente));
        totalEpisodios++;
      });
      if (temporada.hijos.length > 0) serie.agregar(temporada);
    });
    if (totalEpisodios === 0) throw new Error('no hay ningún episodio con video disponible.');
    console.log(`🏭 [Factory Method] serie real "${meta.id}" con ${totalEpisodios} episodio(s)`);
    return serie;
  }
}

export default CargadorContenido;
