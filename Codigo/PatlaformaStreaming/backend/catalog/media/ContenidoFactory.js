import Pelicula from '../Pelicula.js';
import Documental from '../Documental.js';
import FuenteMedia from './FuenteMedia.js';

/**
 * ContenidoFactory (FACTORY METHOD)
 * ------------------------------------------------------------------
 * Cuando el catálogo se arma con datos (un meta.json por título) ya no se
 * sabe de antemano qué clase instanciar: eso lo decide el campo "tipo".
 * Este es el ÚNICO lugar donde se hace `new` de las hojas leídas de disco,
 * igual que PlanFactory lo es para los planes.
 *
 * Agregar un tipo nuevo = una línea en CREADORES. Series y temporadas siguen
 * armándose a mano (catalogoDemo.js) porque son composites, no hojas sueltas.
 * ------------------------------------------------------------------
 */
const CREADORES = {
  pelicula: (m) => new Pelicula(m.id, m.titulo, m.duracionMin, m.generos),
  documental: (m) => new Documental(m.id, m.titulo, m.duracionMin, m.generos),
};

class ContenidoFactory {
  static tiposDisponibles() {
    return Object.keys(CREADORES);
  }

  /**
   * @param {object} meta   contenido de meta.json (id, tipo, titulo, duracionMin, generos)
   * @param {FuenteMedia} fuente  de dónde sale el video de este título
   */
  static crear(meta, fuente) {
    ContenidoFactory.#validar(meta);
    if (!(fuente instanceof FuenteMedia)) throw new Error('La fuente debe ser una FuenteMedia.');

    const crear = CREADORES[meta.tipo];
    console.log(`🏭 [Factory Method] ContenidoFactory.crear("${meta.tipo}", "${meta.id}") -> creando la hoja concreta`);
    return crear(meta).asignarFuente(fuente);
  }

  static #validar(meta) {
    if (!meta || typeof meta !== 'object') throw new Error('meta.json vacío o inválido.');
    if (!/^[a-z0-9][a-z0-9-]*$/.test(String(meta.id))) {
      throw new Error(`id inválido "${meta.id}" (minúsculas, números y guiones).`);
    }
    if (!CREADORES[meta.tipo]) {
      throw new Error(`tipo inválido "${meta.tipo}". Válidos: ${ContenidoFactory.tiposDisponibles().join(', ')}.`);
    }
    if (typeof meta.titulo !== 'string' || !meta.titulo.trim()) throw new Error('falta "titulo".');
    if (!Number.isFinite(meta.duracionMin) || meta.duracionMin <= 0) throw new Error('"duracionMin" debe ser un número mayor que 0.');
    if (!Array.isArray(meta.generos) || meta.generos.some((g) => typeof g !== 'string')) {
      throw new Error('"generos" debe ser una lista de textos.');
    }
  }
}

export default ContenidoFactory;
