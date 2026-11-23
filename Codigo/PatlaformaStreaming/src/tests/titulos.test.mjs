// Pruebas de las utilidades del Dashboard. Se ejecutan con:  npm run test:front
import assert from 'node:assert/strict';
import { aplanarCatalogo, metaDe, degradadoDe, generosDisponibles, filtrar, leerLista, guardarLista, alternar, etiquetaTipo } from '../titulos.js';
import { categoriaSugerida, CATEGORIA_POR_PLAN, NOMBRE_CATEGORIA } from '../perfilPlan.js';

let ok = 0;
const caso = (n, f) => { f(); ok++; console.log(`  ✔ ${n}`); };

const arbol = {
  id: 'catalogo', tipo: 'coleccion', titulo: 'Catálogo', hijos: [
    { id: 'ambar', tipo: 'pelicula', titulo: 'Ámbar', generos: ['drama', 'aventura'], duracionTexto: '2h 14m' },
    { id: 'raices', tipo: 'documental', titulo: 'Raíces', generos: ['documental'], duracionTexto: '48m' },
    { id: 'horizonte', tipo: 'serie', titulo: 'Horizonte', generos: ['thriller'], duracionTexto: '9h', hijos: [
      { id: 't1', tipo: 'temporada', hijos: [{ id: 'e1', tipo: 'episodio' }, { id: 'e2', tipo: 'episodio' }] },
      { id: 't2', tipo: 'temporada', hijos: [{ id: 'e3', tipo: 'episodio' }] },
    ] },
    { id: 'abierto', tipo: 'coleccion', titulo: 'Contenido abierto', hijos: [
      { id: 'spring', tipo: 'pelicula', titulo: 'Spring', generos: ['animacion'], duracionTexto: '7m 44s', contenidoReal: true, creditos: { autor: 'Blender Studio' } },
      { id: 'ambar', tipo: 'pelicula', titulo: 'Ámbar (repetida)', generos: [], duracionTexto: '1m' }, // mismo id: no se duplica
    ] },
  ],
};

console.log('\n== Catálogo -> tarjetas ==');
const t = aplanarCatalogo(arbol);
caso('aplana el árbol: películas, documentales y series (nunca episodios, temporadas ni colecciones)', () => {
  assert.deepEqual(t.map((x) => x.id).sort(), ['ambar', 'horizonte', 'raices', 'spring']);
});
caso('no duplica un título que aparece dos veces', () => assert.equal(t.filter((x) => x.id === 'ambar').length, 1));
caso('una serie cuenta sus temporadas y episodios sin bajar a ellos', () => {
  const s = t.find((x) => x.id === 'horizonte');
  assert.equal(s.temporadas, 2);
  assert.equal(s.episodios, 3);
});
caso('conserva si tiene video real y sus créditos', () => {
  const s = t.find((x) => x.id === 'spring');
  assert.equal(s.contenidoReal, true);
  assert.equal(s.creditos.autor, 'Blender Studio');
  assert.equal(t.find((x) => x.id === 'ambar').contenidoReal, false);
});
caso('tolera un árbol vacío o nulo', () => {
  assert.deepEqual(aplanarCatalogo(null), []);
  assert.deepEqual(aplanarCatalogo({ id: 'x', tipo: 'coleccion' }), []);
});
caso('metaDe: texto corto por tipo', () => {
  assert.equal(metaDe(t.find((x) => x.id === 'ambar')), 'Película · 2h 14m');
  assert.equal(metaDe(t.find((x) => x.id === 'raices')), 'Documental · 48m');
  assert.equal(metaDe(t.find((x) => x.id === 'horizonte')), 'Serie · 2 temporadas · 3 episodios');
  assert.equal(metaDe({ tipo: 'serie', temporadas: 1, episodios: 0 }), 'Serie · 1 temporada');
  assert.equal(etiquetaTipo('pelicula'), 'Película');
});
caso('el color de una tarjeta es estable (mismo id = mismo color) y cambia entre títulos', () => {
  assert.equal(degradadoDe({ id: 'spring' }), degradadoDe({ id: 'spring' }));
  assert.notEqual(degradadoDe({ id: 'spring' }), degradadoDe({ id: 'ambar' }));
  assert.match(degradadoDe({ id: 'x' }), /^linear-gradient\(160deg, hsl\(/);
});

console.log('\n== Filtros de Series / Películas ==');
caso('filtrar por tipo (pestañas Series y Películas)', () => {
  assert.deepEqual(filtrar(t, { tipos: ['serie'] }).map((x) => x.id), ['horizonte']);
  assert.deepEqual(filtrar(t, { tipos: ['pelicula', 'documental'] }).map((x) => x.id).sort(), ['ambar', 'raices', 'spring']);
});
caso('filtrar por género y por tipo a la vez; sin filtros devuelve todo', () => {
  assert.deepEqual(filtrar(t, { tipos: ['pelicula'], genero: 'animacion' }).map((x) => x.id), ['spring']);
  assert.deepEqual(filtrar(t, { genero: 'inexistente' }), []);
  assert.equal(filtrar(t).length, 4);
});
caso('generosDisponibles: únicos y ordenados', () => {
  assert.deepEqual(generosDisponibles(t), ['animacion', 'aventura', 'documental', 'drama', 'thriller']);
});

console.log('\n== Mi lista ==');
const almacenFalso = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), _m: m }; };
caso('alternar agrega y quita sin tocar el arreglo original', () => {
  const base = ['a'];
  assert.deepEqual(alternar(base, 'b'), ['a', 'b']);
  assert.deepEqual(alternar(['a', 'b'], 'a'), ['b']);
  assert.deepEqual(base, ['a']);
});
caso('la lista se guarda y se lee por usuario (cada usuario tiene la suya)', () => {
  const s = almacenFalso();
  guardarLista(s, 1, ['spring', 'ambar']);
  guardarLista(s, 2, ['raices']);
  assert.deepEqual(leerLista(s, 1), ['spring', 'ambar']);
  assert.deepEqual(leerLista(s, 2), ['raices']);
  assert.deepEqual(leerLista(s, 3), []);
});
caso('una lista guardada dañada no rompe la pantalla', () => {
  const s = almacenFalso();
  s.setItem('cineverse_lista_1', '{no es json');
  assert.deepEqual(leerLista(s, 1), []);
  s.setItem('cineverse_lista_1', '{"a":1}');
  assert.deepEqual(leerLista(s, 1), []);
  s.setItem('cineverse_lista_1', '["ok", 5, null, "tambien"]');
  assert.deepEqual(leerLista(s, 1), ['ok', 'tambien']);
});
caso('si el almacenamiento falla (lleno o bloqueado) no lanza error', () => {
  assert.doesNotThrow(() => guardarLista({ setItem() { throw new Error('QuotaExceeded'); } }, 1, ['x']));
});

console.log('\n== Plan vs. perfil de recomendación ==');
caso('el plan solo SUGIERE la plantilla inicial del perfil (y siempre hay una por defecto)', () => {
  assert.equal(categoriaSugerida('premium'), 'accionAventura');
  assert.equal(categoriaSugerida('familiar'), 'familiar');
  assert.equal(categoriaSugerida('free'), 'documental');
  assert.equal(categoriaSugerida('basico'), 'documental');
  assert.equal(categoriaSugerida('platino'), 'accionAventura');
  assert.equal(categoriaSugerida(undefined), 'accionAventura');
});
caso('toda plantilla sugerida tiene nombre legible', () => {
  for (const c of Object.values(CATEGORIA_POR_PLAN)) assert.ok(NOMBRE_CATEGORIA[c], c);
});

console.log(`\n🎉 ${ok} comprobaciones OK`);
