// Utilidades del Dashboard sobre el catálogo (árbol Composite que devuelve GET /api/catalogo).
// Son funciones puras (sin React) para poder probarlas con Node: ver tests/titulos.test.mjs.

export const TIPOS_TITULO = ['pelicula', 'documental', 'serie'];

/**
 * Recorre el árbol y devuelve la lista PLANA de títulos (películas, documentales y series completas):
 * lo que se puede mostrar como una tarjeta. Los episodios y las temporadas no son tarjetas.
 */
export function aplanarCatalogo(raiz) {
  const vistos = new Map();
  const visitar = (nodo) => {
    if (!nodo) return;
    if (TIPOS_TITULO.includes(nodo.tipo)) {
      if (vistos.has(nodo.id)) return;
      const temporadas = nodo.tipo === 'serie' ? (nodo.hijos ?? []).length : 0;
      const episodios = nodo.tipo === 'serie' ? (nodo.hijos ?? []).reduce((n, t) => n + (t.hijos ?? []).length, 0) : 0;
      vistos.set(nodo.id, {
        id: nodo.id,
        titulo: nodo.titulo,
        tipo: nodo.tipo,
        generos: nodo.generos ?? [],
        duracionTexto: nodo.duracionTexto ?? '',
        contenidoReal: nodo.contenidoReal === true,
        creditos: nodo.creditos ?? null,
        temporadas,
        episodios,
      });
      return; // no se baja a las temporadas/episodios de una serie
    }
    (nodo.hijos ?? []).forEach(visitar);
  };
  visitar(raiz);
  return [...vistos.values()];
}

const ETIQUETA = { pelicula: 'Película', documental: 'Documental', serie: 'Serie' };
export const etiquetaTipo = (tipo) => ETIQUETA[tipo] ?? tipo;

/** Texto corto bajo el título de la tarjeta. */
export function metaDe(t) {
  if (t.tipo === 'serie') {
    const temp = `${t.temporadas} temporada${t.temporadas === 1 ? '' : 's'}`;
    return t.episodios ? `Serie · ${temp} · ${t.episodios} episodios` : `Serie · ${temp}`;
  }
  return `${etiquetaTipo(t.tipo)} · ${t.duracionTexto}`;
}

/** Color de fondo estable para cada título (siempre el mismo para el mismo id). */
export function degradadoDe(t) {
  let h = 0;
  for (const c of t.id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `linear-gradient(160deg, hsl(${h} 42% 34%), hsl(${(h + 35) % 360} 40% 10%))`;
}

export const generosDisponibles = (titulos) => [...new Set(titulos.flatMap((t) => t.generos))].sort((a, b) => a.localeCompare(b, 'es'));

/** @param {{tipos?: string[], genero?: string}} f */
export function filtrar(titulos, { tipos, genero } = {}) {
  return titulos.filter((t) => (!tipos || tipos.includes(t.tipo)) && (!genero || t.generos.includes(genero)));
}

// ---------- Mi lista (se guarda en el navegador, una lista por usuario) ----------

const claveLista = (usuarioId) => `cineverse_lista_${usuarioId}`;

export function leerLista(almacen, usuarioId) {
  try {
    const v = JSON.parse(almacen.getItem(claveLista(usuarioId)) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function guardarLista(almacen, usuarioId, ids) {
  try {
    almacen.setItem(claveLista(usuarioId), JSON.stringify(ids));
  } catch {
    // almacenamiento lleno o bloqueado: la lista sigue funcionando mientras la pestaña esté abierta
  }
}

/** Agrega el id si no está; lo quita si ya estaba. No modifica el arreglo original. */
export const alternar = (ids, id) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
