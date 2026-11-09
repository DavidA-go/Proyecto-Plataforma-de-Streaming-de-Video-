import {
  CamposObligatoriosHandler,
  PasswordsCoincidenHandler,
  PlanValidoHandler,
  CorreoDisponibleHandler,
} from './ManejadoresRegistro.js';

/**
 * CadenaRegistro.js
 * ------------------------------------------------------------------
 * Punto único donde se ARMA la cadena de validación del registro.
 * El orden importa: primero lo barato (campos, contraseñas, plan) y
 * al final lo que consulta la base de datos (correo duplicado).
 *
 * Para agregar una regla nueva (ej. formato de correo): crear su
 * manejador y añadir UNA línea aquí. index.js no se toca.
 *
 *   const r = await CadenaRegistro.validar(req.body);
 *   if (!r.valido) -> responder r.status con r.message
 *   (si es válido, `solicitud.plan` ya trae el plan de la fábrica)
 * ------------------------------------------------------------------
 */
class CadenaRegistro {
  /** Crea una cadena NUEVA; `opciones.existeCorreo` permite sustituir la consulta a la BD. */
  static crear({ existeCorreo } = {}) {
    const primero = new CamposObligatoriosHandler();
    primero
      .setSiguiente(new PasswordsCoincidenHandler())
      .setSiguiente(new PlanValidoHandler())
      .setSiguiente(new CorreoDisponibleHandler(existeCorreo));
    return primero;
  }

  /**
   * Valida una solicitud de registro. Devuelve { valido, regla?, message?, status?, solicitud, eslabones }.
   * solicitud.plan lo llena la cadena. `eslabones` es la traza: una entrada por cada regla de la
   * cadena, con resultado OK | RECHAZADA | OMITIDA (la cadena se cortó antes de llegar a ella).
   */
  static async validar(datos, opciones) {
    const solicitud = { ...datos };
    const cadena = CadenaRegistro.crear(opciones);
    const traza = [];
    const resultado = await cadena.manejar(solicitud, traza);
    const eslabones = cadena.reglas().map((regla) => traza.find((t) => t.regla === regla) || { regla, resultado: 'OMITIDA' });
    return { ...resultado, solicitud, eslabones };
  }
}

export default CadenaRegistro;
