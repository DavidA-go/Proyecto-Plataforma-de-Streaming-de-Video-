import IteradorProfundidad from './IteradorProfundidad.js';
import IteradorAnchura from './IteradorAnchura.js';
import IteradorReproducibles from './IteradorReproducibles.js';

export const ORDENES = Object.freeze({
  profundidad: IteradorProfundidad,
  anchura: IteradorAnchura,
  reproducibles: IteradorReproducibles,
});

/**
 * Elige el iterador concreto según el orden pedido (el cliente no hace "new").
 * Lo usa ElementoContenido.crearIterador() = el "createIterator()" del patrón.
 */
export function crearIterador(raiz, orden = 'profundidad', predicado) {
  const Clase = ORDENES[orden];
  if (!Clase) throw new Error(`Orden de recorrido inválido: "${orden}". Válidos: ${Object.keys(ORDENES).join(', ')}`);
  return new Clase(raiz, predicado);
}
