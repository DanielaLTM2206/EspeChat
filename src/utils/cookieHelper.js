/**
 * cookieHelper: Utilidad estática para procesar cabeceras de cookies de forma segura.
 * Evita fallos de split simples y caídas inesperadas del servidor.
 */
class CookieHelper {
  /**
   * Obtiene el valor de una cookie específica a partir de la cabecera 'cookie'.
   * @param {string} cookieHeader - Cabecera 'cookie' del request
   * @param {string} cookieName - Nombre de la cookie a buscar
   * @returns {string|null} Valor de la cookie o null si no se encuentra
   */
  static get(cookieHeader, cookieName) {
    if (!cookieHeader || typeof cookieHeader !== 'string') {
      return null;
    }

    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
      const parts = cookie.split('=');
      const name = parts[0].trim();
      if (name === cookieName && parts.length >= 2) {
        const rawValue = parts.slice(1).join('=').trim();
        try {
          return decodeURIComponent(rawValue);
        } catch (e) {
          return rawValue; // Retorno directo si no es decodificable
        }
      }
    }

    return null;
  }
}

module.exports = CookieHelper;
