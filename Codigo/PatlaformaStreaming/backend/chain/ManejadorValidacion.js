/**
 * ManejadorValidacion.js
 * ------------------------------------------------------------------
 * CHAIN OF RESPONSIBILITY: manejador ABSTRACTO (clase base).
 *
 * Cada eslabón de la cadena:
 *  - conoce SOLO al siguiente eslabón (setSiguiente),
 *  - revisa la solicitud con SU regla (validar),
 *  - si la regla falla, CORTA la cadena y devuelve el motivo,
 *  - si la regla pasa, le pasa la solicitud al siguiente.
 *
 * La solicitud es un objeto "contexto" compartido por toda la cadena:
 * los eslabones pueden LEERLO y también enriquecerlo (por ejemplo,
 * PlanValidoHandler deja en `solicitud.plan` el plan creado por la
 * fábrica para que el endpoint no tenga que crearlo otra vez).
 *
 * Resultado de manejar():
 *   { valido: true }
 *   { valido: false, regla, message, status }
 * ------------------------------------------------------------------
 */
class ManejadorValidacion {
  constructor() {
    if (new.target === ManejadorValidacion) {
      throw new Error('ManejadorValidacion es abstracta: usa un manejador concreto.');
    }
    this.siguiente = null;
  }

  /** Enlaza el siguiente eslabón y lo DEVUELVE, para poder encadenar: a.setSiguiente(b).setSiguiente(c). */
  setSiguiente(manejador) {
    this.siguiente = manejador;
    return manejador;
  }

  /** Nombre de la regla (para logs y para el resultado). Los concretos lo sobrescriben. */
  get regla() {
    return this.constructor.name;
  }

  /**
   * Regla propia del eslabón. Devuelve null si la solicitud es válida,
   * o { message, status } si debe rechazarse. Puede ser async.
   */
  // eslint-disable-next-line no-unused-vars
  async validar(solicitud) {
    throw new Error('validar() debe implementarse en el manejador concreto.');
  }

  /**
   * Recorre la cadena: aplica la regla propia y, si pasa, delega en el siguiente.
   * `traza` (opcional) es un arreglo donde cada eslabón anota { regla, resultado, message? }
   * para poder MOSTRAR por dónde pasó la solicitud (lo usa el Dashboard).
   */
  async manejar(solicitud, traza = null) {
    const rechazo = await this.validar(solicitud);

    if (rechazo) {
      console.log(`⛓️  [Chain:${this.regla}] RECHAZA -> ${rechazo.message}`);
      traza?.push({ regla: this.regla, resultado: 'RECHAZADA', message: rechazo.message });
      return { valido: false, regla: this.regla, message: rechazo.message, status: rechazo.status ?? 400 };
    }

    console.log(`⛓️  [Chain:${this.regla}] OK`);
    traza?.push({ regla: this.regla, resultado: 'OK' });
    if (this.siguiente) return this.siguiente.manejar(solicitud, traza);
    return { valido: true };
  }

  /** Nombres de las reglas de esta cadena, en orden (desde este eslabón hasta el final). */
  reglas() {
    return [this.regla, ...(this.siguiente ? this.siguiente.reglas() : [])];
  }
}

export default ManejadorValidacion;
