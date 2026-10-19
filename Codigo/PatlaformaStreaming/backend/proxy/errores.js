/** El rol del usuario no incluye el permiso necesario (HTTP 403). */
export class PermisoDenegadoError extends Error {
  constructor({ rol, permiso, servicio, operacion, motivo }) {
    super(motivo || `Tu rol "${rol}" no tiene permiso para ${operacion} (${permiso}).`);
    this.name = 'PermisoDenegadoError';
    this.rol = rol;
    this.permiso = permiso;
    this.servicio = servicio;
    this.operacion = operacion;
  }
}

/** Falta iniciar sesión (HTTP 401). */
export class NoAutenticadoError extends Error {
  constructor() {
    super('Debes iniciar sesión para usar este recurso.');
    this.name = 'NoAutenticadoError';
  }
}

/** Regla de negocio de un servicio real (HTTP 400/404). */
export class ErrorNegocio extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ErrorNegocio';
    this.status = status;
  }
}
