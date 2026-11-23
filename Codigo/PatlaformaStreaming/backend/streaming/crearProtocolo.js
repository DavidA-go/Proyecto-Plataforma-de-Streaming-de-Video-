import HLSProtocol from './HLSProtocol.js';
import DASHProtocol from './DASHProtocol.js';
import MP4Protocol from './MP4Protocol.js';

/**
 * Protocolos disponibles por nombre (mismo estilo que crearVisitante / crearEstrategia).
 * Agregar un protocolo = una clase que extienda StreamingProtocol + una línea aquí.
 */
export const PROTOCOLOS = Object.freeze({
  hls: HLSProtocol,
  dash: DASHProtocol,
  mp4: MP4Protocol,
});

export const NOMBRES_VALIDOS = [...Object.keys(PROTOCOLOS), 'auto'];

export function crearProtocolo(nombre) {
  const Clase = PROTOCOLOS[nombre];
  if (!Clase) throw new Error(`protocolo inválido. Usa ${NOMBRES_VALIDOS.map((n) => `"${n}"`).join(', ')}.`);
  return new Clase();
}

/**
 * Qué protocolo usar para UNA fuente concreta.
 *   'auto'                      -> el preferido de la fuente (mp4 si es real, hls si es simulada)
 *   uno que la fuente soporta   -> ese
 *   uno que NO soporta (ej. hls pedido para un título que solo tiene MP4) -> el preferido de la fuente
 * Así una misma petición sobre una colección mezclada (demo + real) nunca falla por el protocolo.
 */
export function elegirProtocolo(pedido, fuente) {
  const soportados = fuente.protocolosSoportados();
  if (pedido && pedido !== 'auto' && soportados.includes(pedido)) return pedido;
  if (pedido && pedido !== 'auto') {
    console.log(`🌉 [Bridge] la fuente solo soporta ${soportados.join('/')}: se usa "${soportados[0]}" en vez de "${pedido}"`);
  }
  return soportados[0];
}
