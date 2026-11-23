/**
 * demo-strategy-template.js
 * Demostración por consola de Strategy y Template Method (sin PostgreSQL):
 *
 *     cd backend && npm run demo:strategy-template
 */
import CatalogoService from './catalog/CatalogoService.js';
import PerfilRecomendacionRegistry from './recommendation/PerfilRecomendacionRegistry.js';
import { crearEstrategia } from './recommendation/strategy/crearEstrategia.js';
import { crearGenerador } from './recommendation/template/crearGenerador.js';

const linea = (t) => console.log(`\n${'='.repeat(64)}\n${t}\n${'='.repeat(64)}`);
const silencio = (fn) => { const log = console.log; console.log = () => {}; try { return fn(); } finally { console.log = log; } };
const mostrar = (r) => r.recomendaciones.forEach((x) => console.log(`  ${x.puntaje.toFixed(3)}  ${x.titulo.padEnd(22)} ${x.motivo}`));

const perfil = silencio(() => PerfilRecomendacionRegistry.obtenerPlantilla('accionAventura'));
perfil.pesoHistorial = 0.7;
const historial = ['raices-de-cobre', 'selva-digital', 'raices-de-cobre', 'ambar'];
const ctx = (tipo, estrategia, extra = {}) => ({ perfil, historial, estrategia: crearEstrategia(estrategia), limite: 4, raiz: CatalogoService.raiz, ...extra });

linea('STRATEGY — misma plantilla "para-ti", tres algoritmos de puntuación');
console.log(`Perfil: ${perfil.generosFavoritos.join(', ')} · pesoHistorial ${perfil.pesoHistorial} · vio: ${historial.join(', ')}`);
for (const e of ['generos', 'historial', 'hibrida']) {
  console.log(`\nestrategia "${e}":`);
  mostrar(silencio(() => crearGenerador('para-ti').generar(ctx('para-ti', e))));
}

linea('TEMPLATE METHOD — mismo esqueleto, tres tipos de recomendación');
const referencia = CatalogoService.buscar('ambar');
for (const tipo of ['para-ti', 'similares', 'descubrir']) {
  const r = silencio(() => crearGenerador(tipo).generar(ctx(tipo, 'hibrida', { nodoReferencia: referencia })));
  console.log(`\n${r.plantilla} — pasos: ${r.pasos.map((p) => `${p.paso}(${p.cantidad ?? ''})`).join(' → ')}`);
  mostrar(r);
}
