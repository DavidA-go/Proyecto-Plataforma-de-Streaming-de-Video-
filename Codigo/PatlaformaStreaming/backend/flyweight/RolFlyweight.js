/**
 * RolFlyweight.js
 * ------------------------------------------------------------------
 * FLYWEIGHT: objeto liviano e INMUTABLE que guarda el estado
 * INTRÍNSECO de un rol (su nombre y su conjunto de permisos). Ese
 * estado es idéntico para todos los usuarios con el mismo rol, por eso
 * se comparte: 10.000 usuarios "usuario" apuntan al MISMO objeto.
 *
 * El estado EXTRÍNSECO (quién es el usuario, qué recurso toca) NO vive
 * aquí: llega como parámetro en cada llamada (ver tiene()/permite()).
 * ------------------------------------------------------------------
 */
class RolFlyweight {
  #permisos;

  constructor(nombre, etiqueta, permisos) {
    this.nombre = nombre;
    this.etiqueta = etiqueta;
    this.#permisos = new Set(permisos);
    Object.freeze(this); // inmutable: es seguro compartirlo
  }

  /** ¿El rol incluye este permiso? */
  tiene(permiso) {
    return this.#permisos.has(permiso);
  }

  listarPermisos() {
    return [...this.#permisos].sort();
  }

  toJSON() {
    return { nombre: this.nombre, etiqueta: this.etiqueta, permisos: this.listarPermisos() };
  }
}

export default RolFlyweight;
