import crypto from 'crypto';

/**
 * TokenService.js
 * ------------------------------------------------------------------
 * Token de sesión firmado (HMAC-SHA256), sin dependencias externas.
 * Solo PRUEBA IDENTIDAD ({ id, exp }); el ROL se lee de la BD en cada
 * petición, así un cambio de rol hecho por un admin aplica al instante.
 * Configura AUTH_SECRET en backend/.env para producción.
 * ------------------------------------------------------------------
 */
const SECRETO = process.env.AUTH_SECRET || 'cineverse-secreto-solo-desarrollo';
const DURACION_MS = 12 * 60 * 60 * 1000; // 12 horas

const b64 = (buf) => Buffer.from(buf).toString('base64url');
// El `sal` separa las "familias" de firma: un ticket de video NO es válido como token de sesión ni al revés.
const firmar = (cuerpo, sal = '') => crypto.createHmac('sha256', SECRETO + sal).update(cuerpo).digest('base64url');
const DURACION_TICKET_MIN = Number(process.env.MEDIA_TICKET_MIN) || 240; // 4 horas

class TokenService {
  static emitir(usuarioId) {
    const cuerpo = b64(JSON.stringify({ id: usuarioId, exp: Date.now() + DURACION_MS }));
    return `${cuerpo}.${firmar(cuerpo)}`;
  }

  /** Devuelve el id de usuario, o null si el token es inválido/expirado. */
  static verificar(token) {
    if (typeof token !== 'string') return null;
    const [cuerpo, firma] = token.split('.');
    if (!cuerpo || !firma) return null;
    const esperada = firmar(cuerpo);
    const a = Buffer.from(firma);
    const b = Buffer.from(esperada);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
      const { id, exp } = JSON.parse(Buffer.from(cuerpo, 'base64url').toString());
      return exp > Date.now() ? id : null;
    } catch {
      return null;
    }
  }

  /**
   * Ticket de ACCESO A UN VIDEO: prueba que `usuarioId` fue autorizado a ver `contenidoId` bajo
   * la sesión DRM `sesionId` (la pantalla que abrió su licencia). Vive en la URL (?ticket=...)
   * porque <video> no puede enviar cabeceras. El MediaProxy además exige que esa sesión siga
   * vigente: si se libera (Detener, cambio de plan) o vence, el ticket deja de servir.
   */
  static emitirTicket(usuarioId, contenidoId, sesionId, { minutos = DURACION_TICKET_MIN, offline = false } = {}) {
    const cuerpo = b64(JSON.stringify({ id: usuarioId, cid: contenidoId, ses: sesionId, off: offline === true, exp: Date.now() + minutos * 60 * 1000 }));
    return { ticket: `${cuerpo}.${firmar(cuerpo, ':ticket')}`, expiraEnMin: minutos };
  }

  /** Devuelve { usuarioId, sesionId, offline } si el ticket es auténtico, no venció y es de ESE contenido; si no, null. */
  static verificarTicket(ticket, contenidoId) {
    if (typeof ticket !== 'string') return null;
    const [cuerpo, firma] = ticket.split('.');
    if (!cuerpo || !firma) return null;
    const a = Buffer.from(firma);
    const b = Buffer.from(firmar(cuerpo, ':ticket'));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
      const { id, cid, ses, off, exp } = JSON.parse(Buffer.from(cuerpo, 'base64url').toString());
      return exp > Date.now() && cid === contenidoId ? { usuarioId: id, sesionId: ses, offline: off === true } : null;
    } catch {
      return null;
    }
  }
}

export default TokenService;
