/**
 * AccesoLog.js
 * ------------------------------------------------------------------
 * Bitácora EN MEMORIA de cada decisión de los proxies (PERMITIDO /
 * DENEGADO). La consulta un admin en GET /api/admin/accesos.
 * ------------------------------------------------------------------
 */
const MAX = 200;

class AccesoLog {
  static eventos = [];
  static contador = 0;

  static registrar(evento) {
    const registro = { id: `ACC-${++AccesoLog.contador}`, fecha: new Date().toISOString(), ...evento };
    AccesoLog.eventos.push(registro);
    if (AccesoLog.eventos.length > MAX) AccesoLog.eventos.shift();
    return registro;
  }

  static ultimos(cantidad = 50) {
    return AccesoLog.eventos.slice(-cantidad).reverse();
  }
}

export default AccesoLog;
