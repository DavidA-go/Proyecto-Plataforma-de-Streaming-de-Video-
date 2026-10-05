/**
 * SesionesRegistry.js
 * ------------------------------------------------------------------
 * Registro EN MEMORIA de las sesiones de reproducción activas
 * ("pantallas en uso") de cada usuario. Lo consulta
 * LimiteDispositivosDecorator para saber cuántas pantallas hay abiertas.
 *
 * Una sesión es: un dispositivo reproduciendo un contenido. Cada
 * dispositivo cuenta como UNA pantalla: si el mismo dispositivo empieza
 * otro contenido, reemplaza a su sesión anterior en vez de sumar otra.
 *
 * Las sesiones se liberan con POST /api/stream/detener o expiran solas
 * tras SESION_TTL_MS, para que una pestaña cerrada no bloquee la cuenta.
 *
 * Cuando haya base de datos real para esto, solo cambia este archivo
 * (por ejemplo, una tabla "sesiones_reproduccion"): el decorator no se toca.
 * ------------------------------------------------------------------
 */
const SESION_TTL_MS = 10 * 60 * 1000; // 10 minutos

class SesionesRegistry {
  static sesiones = new Map(); // usuarioId -> [{ id, dispositivoId, contenidoId, inicio }]
  static contador = 0;

  static #limpiarExpiradas(usuarioId) {
    const ahora = Date.now();
    const vigentes = (SesionesRegistry.sesiones.get(usuarioId) || []).filter(
      (s) => ahora - s.inicio < SESION_TTL_MS
    );
    SesionesRegistry.sesiones.set(usuarioId, vigentes);
    return vigentes;
  }

  static activas(usuarioId) {
    return SesionesRegistry.#limpiarExpiradas(usuarioId);
  }

  static registrar(usuarioId, dispositivoId, contenidoId) {
    // Un dispositivo = una pantalla: se reemplaza su sesión anterior.
    const otras = SesionesRegistry.#limpiarExpiradas(usuarioId).filter(
      (s) => s.dispositivoId !== dispositivoId
    );
    const sesion = {
      id: `SES-${++SesionesRegistry.contador}`,
      dispositivoId,
      contenidoId,
      inicio: Date.now(),
    };
    SesionesRegistry.sesiones.set(usuarioId, [...otras, sesion]);
    return sesion;
  }

  static liberar(usuarioId, sesionId) {
    const antes = SesionesRegistry.#limpiarExpiradas(usuarioId);
    const despues = antes.filter((s) => s.id !== sesionId);
    SesionesRegistry.sesiones.set(usuarioId, despues);
    return despues.length < antes.length;
  }
}

export default SesionesRegistry;
