/**
 * demo-patrones.js
 * ------------------------------------------------------------------
 * Demostración por consola de los patrones Composite y Decorator.
 * NO necesita PostgreSQL ni el servidor levantado:
 *
 *     cd backend
 *     npm run demo:patrones
 * ------------------------------------------------------------------
 */
import CatalogoService from './catalog/CatalogoService.js';
import PlanFactory from './factories/PlanFactory.js';
import { LicenseManagerPremium } from './drm/FamiliaPremium.js';
import { WidevineLicenseAdapter } from './drm/DRMAdapters.js';
import {
  AuditoriaDecorator,
  LimiteDispositivosDecorator,
  RestriccionGeograficaDecorator,
  LicenciaDenegadaError,
} from './drm/LicenseDecorators.js';

const linea = (t) => console.log(`\n${'='.repeat(64)}\n${t}\n${'='.repeat(64)}`);

// ------------------------------------------------------------------
linea('COMPOSITE: la misma pregunta a nodos de distinto tipo');
// ------------------------------------------------------------------
for (const id of ['el-ultimo-vuelo', 'horizonte-nocturno-t1', 'horizonte-nocturno', 'suspenso-y-accion', 'catalogo']) {
  const nodo = CatalogoService.buscar(id);
  console.log(
    `${nodo.tipo().padEnd(10)} ${nodo.titulo.padEnd(22)} getDuracion() = ${String(nodo.getDuracion()).padStart(5)} min` +
      `  (${nodo.getDuracionFormateada().padEnd(8)})  reproducibles = ${nodo.obtenerReproducibles().length}`
  );
}

console.log('\nBúsqueda recursiva por id en todo el árbol:');
const ep = CatalogoService.buscar('reino-de-papel-t1-e3');
console.log(`  buscar("reino-de-papel-t1-e3") -> ${ep.tipo()} ${ep.numero} de "${ep.id.split('-t1')[0]}"`);

console.log('\nFiltro por géneros ["familiar"] (poda el árbol):');
const familiar = CatalogoService.filtrarPorGeneros(['familiar']);
const imprimir = (n, d = 0) => {
  console.log(`${'  '.repeat(d + 1)}${n.tipo}: ${n.titulo}`);
  if (d < 2) (n.hijos || []).forEach((h) => imprimir(h, d + 1));
};
imprimir(familiar);

// ------------------------------------------------------------------
linea('DECORATOR: capas apiladas sobre un LicenseManager');
// ------------------------------------------------------------------
const usuario = { id: 99, planTipo: 'basico', activo: true };
const plan = PlanFactory.crearPlan('basico'); // 1 pantalla

const armar = (base, dispositivo, pais) =>
  new AuditoriaDecorator(
    new LimiteDispositivosDecorator(new RestriccionGeograficaDecorator(base, pais), plan, dispositivo)
  );

const intentar = async (etiqueta, gestor, contenidoId) => {
  try {
    const lic = await gestor.emitirLicencia(usuario, contenidoId);
    console.log(`  ✔ ${etiqueta}: licencia ${lic.licenciaId} | pantallas ${lic.pantallasEnUso}/${lic.pantallasMaximas} | ${lic.auditoriaId}`);
  } catch (e) {
    if (!(e instanceof LicenciaDenegadaError)) throw e;
    console.log(`  ✖ ${etiqueta}: DENEGADA (${e.codigo}) -> ${e.message}`);
  }
};

console.log('\nPlan básico = 1 pantalla. Gestor base: LicenseManagerPremium.\n');
await intentar('Dispositivo A, CO', armar(new LicenseManagerPremium(), 'A', 'CO'), 'ambar');
await intentar('Dispositivo B, CO', armar(new LicenseManagerPremium(), 'B', 'CO'), 'ambar');
await intentar('Dispositivo A, KP', armar(new LicenseManagerPremium(), 'A', 'KP'), 'ambar');

console.log('\nLos MISMOS decorators sobre un Adapter (Widevine) en vez del gestor propio:\n');
await intentar('Dispositivo A, MX (Widevine)', armar(new WidevineLicenseAdapter(), 'A', 'MX'), 'ambar');
