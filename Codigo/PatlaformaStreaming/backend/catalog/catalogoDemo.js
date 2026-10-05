import Pelicula from './Pelicula.js';
import Documental from './Documental.js';
import Episodio from './Episodio.js';
import Temporada from './Temporada.js';
import Serie from './Serie.js';
import Coleccion from './Coleccion.js';

/**
 * catalogoDemo.js
 * ------------------------------------------------------------------
 * Arma el árbol del catálogo con datos de ejemplo EN MEMORIA.
 *
 * Los ids se generan con el mismo "slug" que usa el Dashboard
 * (ej. "El Último Vuelo" -> "el-ultimo-vuelo"), así las tarjetas que ya
 * existen en el frontend apuntan directamente a nodos de este árbol.
 *
 * Cuando haya contenido real, solo cambia ESTE archivo: en vez de datos
 * escritos a mano, el árbol se construye leyendo la base de datos. Las
 * clases del Composite no se tocan.
 * ------------------------------------------------------------------
 */
export const slug = (texto) =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');

// Crea una serie completa: temporadas -> episodios (todos con ids únicos).
// "temporadas" es un arreglo con la cantidad de episodios de cada temporada.
function crearSerie(titulo, generos, temporadas, duracionEpisodio) {
  const idSerie = slug(titulo);
  const serie = new Serie(idSerie, titulo, generos);

  temporadas.forEach((cantidadEpisodios, i) => {
    const numTemp = i + 1;
    const temporada = new Temporada(`${idSerie}-t${numTemp}`, `Temporada ${numTemp}`);
    for (let ep = 1; ep <= cantidadEpisodios; ep++) {
      temporada.agregar(
        new Episodio(`${idSerie}-t${numTemp}-e${ep}`, `Episodio ${ep}`, ep, duracionEpisodio)
      );
    }
    serie.agregar(temporada);
  });

  return serie;
}

export function construirCatalogoDemo() {
  // --- Series (composites de composites) ---
  const horizonte = crearSerie('Horizonte Nocturno', ['thriller', 'accion'], [4, 4], 52);
  const codigos = crearSerie('Códigos del Silencio', ['thriller', 'misterio'], [9], 48);
  const faro = crearSerie('Faro Escarlata', ['misterio', 'drama'], [6, 6], 50);
  const bajoCero = crearSerie('Bajo Cero', ['aventura', 'drama'], [6], 45);
  const otraOrilla = crearSerie('La Otra Orilla', ['drama', 'familiar'], [5, 5, 5], 44);
  const reino = crearSerie('Reino de Papel', ['animacion', 'familiar', 'comedia'], [8], 25);
  const vestigios = crearSerie('Vestigios', ['historia', 'aventura'], [6, 6], 47);

  // --- Películas y documentales (hojas) ---
  const ultimoVuelo = new Pelicula(slug('El Último Vuelo'), 'El Último Vuelo', 126, ['accion', 'thriller']);
  const ciudadVidrio = new Pelicula(slug('Ciudad de Vidrio'), 'Ciudad de Vidrio', 112, ['thriller', 'drama']);
  const ambar = new Pelicula(slug('Ámbar'), 'Ámbar', 134, ['drama', 'aventura']);
  const mareaAlta = new Pelicula(slug('Marea Alta'), 'Marea Alta', 107, ['aventura', 'familiar']);
  const raices = new Documental(slug('Raíces de Cobre'), 'Raíces de Cobre', 48, ['documental', 'historia']);
  const selva = new Documental(slug('Selva Digital'), 'Selva Digital', 55, ['documental', 'ciencia']);

  // --- Colecciones (pueden contener series, películas y otras colecciones) ---
  // Cada elemento vive en UN solo lugar del árbol, para que los totales
  // (duración, cantidad de reproducibles) no se cuenten dos veces.

  // Mezcla composites (series) y hojas (películas) en el mismo grupo.
  const suspensoAccion = new Coleccion('suspenso-y-accion', 'Suspenso y acción')
    .agregar(horizonte).agregar(codigos).agregar(ultimoVuelo).agregar(ciudadVidrio);

  const dramaMisterio = new Coleccion('drama-y-misterio', 'Drama y misterio')
    .agregar(faro).agregar(otraOrilla).agregar(ambar);

  // Colección ANIDADA: una colección dentro de otra colección.
  const animacion = new Coleccion('animacion', 'Animación y comedia')
    .agregar(reino);

  const aventuraFamilia = new Coleccion('aventura-y-familia', 'Aventura y familia')
    .agregar(bajoCero).agregar(mareaAlta).agregar(vestigios)
    .agregar(animacion);

  const documentales = new Coleccion('documentales', 'Documentales')
    .agregar(raices).agregar(selva);

  // --- Raíz del catálogo ---
  return new Coleccion('catalogo', 'Catálogo CineVerse', [])
    .agregar(suspensoAccion)
    .agregar(dramaMisterio)
    .agregar(aventuraFamilia)
    .agregar(documentales);
}
