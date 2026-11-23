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
    // Una sesión muere por inactividad (TTL) O porque su LICENCIA ya venció (expiraEn).
    const vigentes = (SesionesRegistry.sesiones.get(usuarioId) || []).filter(
      (s) => ahora - s.inicio < SESION_TTL_MS && (s.expiraEn === null || ahora < s.expiraEn)
    );
    SesionesRegistry.sesiones.set(usuarioId, vigentes);
    return vigentes;
  }

  static activas(usuarioId) {
    return SesionesRegistry.#limpiarExpiradas(usuarioId);
  }

  /**
   * @param {object} [licencia]  datos de la licencia que abrió la sesión:
   *   { licenciaId, expiraEn (ms epoch, null = sin vencimiento), permiteOffline }
   */
  static registrar(usuarioId, dispositivoId, contenidoId, licencia = {}) {
    // Un dispositivo = una pantalla: se reemplaza su sesión anterior.
    const otras = SesionesRegistry.#limpiarExpiradas(usuarioId).filter(
      (s) => s.dispositivoId !== dispositivoId
    );
    const sesion = {
      id: `SES-${++SesionesRegistry.contador}`,
      dispositivoId,
      contenidoId,
      inicio: Date.now(),
      licenciaId: licencia.licenciaId ?? null,
      expiraEn: licencia.expiraEn ?? null,
      permiteOffline: licencia.permiteOffline === true,
    };
    SesionesRegistry.sesiones.set(usuarioId, [...otras, sesion]);
    return sesion;
  }

  /**
   * Recorta las pantallas en uso a `maximo`, liberando las sesiones MÁS ANTIGUAS.
   * Lo usa el observador del plan DRM cuando el usuario baja de plan.
   * Devuelve las sesiones liberadas (arreglo vacío si no sobraba ninguna).
   */
  static limitar(usuarioId, maximo) {
    const vigentes = SesionesRegistry.#limpiarExpiradas(usuarioId); // orden de apertura: la más antigua primero
    const sobran = Math.max(0, vigentes.length - Math.max(0, maximo));
    if (sobran === 0) return [];
    SesionesRegistry.sesiones.set(usuarioId, vigentes.slice(sobran));
    return vigentes.slice(0, sobran);
  }

  /** La sesión si SIGUE vigente (no liberada ni vencida); si no, null. */
  static buscar(usuarioId, sesionId) {
    return SesionesRegistry.#limpiarExpiradas(usuarioId).find((s) => s.id === sesionId) ?? null;
  }

  /**
   * "Latido": reinicia el contador de vencimiento de una sesión vigente. Mientras alguien está
   * viendo, el reproductor la renueva; si se cierra la pestaña, deja de renovarse y vence sola.
   * Devuelve la sesión, o null si ya no existía.
   */
  static renovar(usuarioId, sesionId) {
    const sesion = SesionesRegistry.buscar(usuarioId, sesionId);
    if (sesion) sesion.inicio = Date.now();
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
