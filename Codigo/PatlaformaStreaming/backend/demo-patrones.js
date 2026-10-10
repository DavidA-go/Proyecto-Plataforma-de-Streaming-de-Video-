/**
 * demo-patrones.js
 * ------------------------------------------------------------------
 * Demostración por consola de los patrones Composite y Facade (esta
 * última orquesta por debajo Abstract Factory, Adapter, Decorator y
 * Factory Method). NO necesita PostgreSQL ni el servidor levantado:
 *
 *     cd backend
 *     npm run demo:patrones
 * ------------------------------------------------------------------
 */
import CatalogoService from './catalog/CatalogoService.js';
import DRMFacade, { ContenidoNoEncontradoError, AccesoDenegadoError } from './drm/DRMFacade.js';
import { LicenciaDenegadaError } from './drm/LicenseDecorators.js';

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
linea('FACADE: una sola llamada oculta todo el subsistema de DRM');
// ------------------------------------------------------------------
console.log(
  'Cada intento es UNA llamada a DRMFacade.autorizarReproduccion(). Por debajo la\n' +
    'fachada coordina Composite, Abstract Factory, Adapter, Factory Method y Decorators.\n'
);

// Traduce el resultado (o el error de negocio) a una línea legible.
const intentar = async (etiqueta, datos) => {
  try {
    const r = await DRMFacade.autorizarReproduccion(datos);
    const l = r.licencia;
    console.log(
      `  ✔ ${etiqueta}: ${l.licenciaId} | pantallas ${l.pantallasEnUso}/${l.pantallasMaximas}` +
        ` | proveedor=${l.proveedorExterno || 'propio'} | ${l.auditoriaId}`
    );
    return r;
  } catch (e) {
    if (e instanceof LicenciaDenegadaError) {
      console.log(`  ✖ ${etiqueta}: DENEGADA (${e.codigo}) -> ${e.message}`);
    } else if (e instanceof ContenidoNoEncontradoError) {
      console.log(`  ✖ ${etiqueta}: NO ENCONTRADO -> ${e.message}`);
    } else if (e instanceof AccesoDenegadoError) {
      console.log(`  ✖ ${etiqueta}: ACCESO DENEGADO -> ${e.validacion.detalle}`);
    } else {
      throw e;
    }
    return null;
  }
};

const basico = { id: 99, planTipo: 'basico', activo: true }; // 1 pantalla

console.log('--- Plan básico = 1 pantalla (gestor propio de la familia Básica) ---\n');
const primera = await intentar('Dispositivo A, CO', { usuario: basico, contenidoId: 'ambar', dispositivoId: 'A', pais: 'CO' });
await intentar('Dispositivo B, CO', { usuario: basico, contenidoId: 'ambar', dispositivoId: 'B', pais: 'CO' });
await intentar('Dispositivo A, KP', { usuario: basico, contenidoId: 'ambar', dispositivoId: 'A', pais: 'KP' });

console.log('\n--- DRMFacade.detener(): libera la pantalla del dispositivo A ---\n');
const liberada = DRMFacade.detener(basico.id, primera.licencia.sesionId);
console.log(`  sesión ${primera.licencia.sesionId} liberada=${liberada.liberada} | pantallas en uso: ${liberada.pantallasEnUso}`);
await intentar('Dispositivo B, CO (ahora sí)', { usuario: basico, contenidoId: 'ambar', dispositivoId: 'B', pais: 'CO' });

console.log('\n--- proveedorExterno: "auto" (el Adapter se elige por plan, ya no en el frontend) ---\n');
await intentar('Premium  -> auto', { usuario: { id: 100, planTipo: 'premium', activo: true }, contenidoId: 'horizonte-nocturno', dispositivoId: 'P1', pais: 'MX', proveedorExterno: 'auto' });
await intentar('Básico   -> auto', { usuario: { id: 101, planTipo: 'basico', activo: true }, contenidoId: 'horizonte-nocturno', dispositivoId: 'P2', pais: 'MX', proveedorExterno: 'auto' });

console.log('\n--- Errores de negocio tipados (la fachada los lanza, el cliente decide qué hacer) ---\n');
await intentar('Contenido inexistente', { usuario: basico, contenidoId: 'no-existe', dispositivoId: 'A', pais: 'CO' });
await intentar('Usuario sin plan', { usuario: { id: 102, planTipo: null }, contenidoId: 'ambar', dispositivoId: 'Z', pais: 'CO' });

console.log('\n--- DRMFacade.auditoria(): bitácora que llenó el AuditoriaDecorator ---\n');
for (const ev of DRMFacade.auditoria(5).reverse()) {
  console.log(`  ${ev.id} ${ev.resultado.padEnd(8)} usuario=${ev.usuarioId} contenido=${ev.contenidoId}${ev.motivo ? ` motivo=${ev.motivo}` : ''}`);
}
