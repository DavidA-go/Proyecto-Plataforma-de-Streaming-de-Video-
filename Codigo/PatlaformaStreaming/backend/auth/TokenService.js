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
const firmar = (cuerpo) => crypto.createHmac('sha256', SECRETO).update(cuerpo).digest('base64url');

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
}

export default TokenService;
