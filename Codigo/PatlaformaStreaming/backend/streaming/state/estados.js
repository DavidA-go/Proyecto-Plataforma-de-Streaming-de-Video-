import EstadoDetenido from './EstadoDetenido.js';
import EstadoCargando from './EstadoCargando.js';
import EstadoReproduciendo from './EstadoReproduciendo.js';
import EstadoPausado from './EstadoPausado.js';

/**
 * Los estados no guardan datos, así que hay UNA instancia de cada uno
 * compartida por todas las sesiones (como un Flyweight).
 */
export const ESTADOS = Object.freeze({
  detenido: new EstadoDetenido(),
  cargando: new EstadoCargando(),
  reproduciendo: new EstadoReproduciendo(),
  pausado: new EstadoPausado(),
});

export const NOMBRES_ESTADOS = Object.freeze(Object.keys(ESTADOS));
