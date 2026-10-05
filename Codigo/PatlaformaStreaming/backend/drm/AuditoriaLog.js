/**
 * AuditoriaLog.js
 * ------------------------------------------------------------------
 * Bitácora EN MEMORIA de las licencias emitidas o denegadas.
 * La llena AuditoriaDecorator y se consulta en GET /api/stream/auditoria.
 * (Se conservan solo los últimos 100 eventos.)
 * ------------------------------------------------------------------
 */
const MAX_EVENTOS = 100;

class AuditoriaLog {
  static eventos = [];
  static contador = 0;

  static registrar(evento) {
    const registro = { id: `AUD-${++AuditoriaLog.contador}`, fecha: new Date().toISOString(), ...evento };
    AuditoriaLog.eventos.push(registro);
    if (AuditoriaLog.eventos.length > MAX_EVENTOS) AuditoriaLog.eventos.shift();
    return registro;
  }

  static ultimos(cantidad = 50) {
    return AuditoriaLog.eventos.slice(-cantidad).reverse();
  }
}

export default AuditoriaLog;
