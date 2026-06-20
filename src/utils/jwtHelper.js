const crypto = require('crypto');
const { TokenExpiredError, InvalidCredentialsError } = require('./errors');

const SECRET = process.env.JWT_SECRET || 'espechat-super-secure-jwt-secret-key-2026';

class JWTHelper {
  /**
   * Firma un JWT para un payload dado.
   * @param {Object} payload 
   * @param {number} expiresInSeconds - Tiempo de expiración en segundos (defecto: 1 hora)
   * @returns {string} Token firmado
   */
  static sign(payload, expiresInSeconds = 3600) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const data = { ...payload, exp };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(data)).toString('base64url');

    const signature = crypto
      .createHmac('sha256', SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Verifica un token JWT.
   * @param {string} token 
   * @returns {Object} Payload decodificado si es válido
   * @throws {TokenExpiredError} Si el token expiró
   * @throws {InvalidCredentialsError} Si la firma es incorrecta o el formato es inválido
   */
  static verify(token) {
    if (!token || typeof token !== 'string') {
      throw new InvalidCredentialsError('El token no fue proporcionado o es inválido.');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new InvalidCredentialsError('El formato del token es inválido.');
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // Verificar firma
    const expectedSignature = crypto
      .createHmac('sha256', SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    if (signature !== expectedSignature) {
      throw new InvalidCredentialsError('La firma del token de sesión es inválida.');
    }

    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
      
      // Validar expiración
      if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
        throw new TokenExpiredError();
      }

      return payload;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw error;
      }
      throw new InvalidCredentialsError('Error al decodificar el payload del token.');
    }
  }
}

module.exports = JWTHelper;
