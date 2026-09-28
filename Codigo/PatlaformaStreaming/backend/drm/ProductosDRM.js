/**
 * ProductosDRM.js
 * ------------------------------------------------------------------
 * Productos ABSTRACTOS del patrón Abstract Factory.
 *
 * Cada uno define el "contrato" que debe cumplir cualquier variante
 * concreta (Básica o Premium) de ese componente de seguridad.
 * El código cliente (index.js) nunca habla con las clases concretas,
 * solo con estas interfaces.
 * ------------------------------------------------------------------
 */

/**
 * TokenValidator (Producto abstracto A)
 * Se encarga de comprobar que el usuario tiene permiso para reproducir
 * un contenido concreto en este momento (sesión activa, plan vigente, etc.)
 */
export class TokenValidator {
  validarToken(usuario, contenidoId) {
    throw new Error('validarToken() debe ser implementado por la subclase.');
  }
}

/**
 * LicenseManager (Producto abstracto B)
 * Emite la "licencia" de reproducción: un permiso temporal que autoriza
 * al reproductor a descifrar/mostrar el contenido durante X tiempo.
 */
export class LicenseManager {
  emitirLicencia(usuario, contenidoId) {
    throw new Error('emitirLicencia() debe ser implementado por la subclase.');
  }
}

/**
 * Watermarker (Producto abstracto C)
 * Aplica una marca de agua (visible o invisible) al stream para poder
 * rastrear el origen si el contenido se filtra o se graba sin permiso.
 */
export class Watermarker {
  aplicarMarcaDeAgua(usuario, contenidoId) {
    throw new Error('aplicarMarcaDeAgua() debe ser implementado por la subclase.');
  }
}
