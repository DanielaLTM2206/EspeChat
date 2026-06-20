const { 
  InvalidCredentialsError, 
  ServiceUnavailableError, 
  ValidationError 
} = require('../utils/errors');
const JWTHelper = require('../utils/jwtHelper');

class AuthService {
  /**
   * Simula la autenticación en un microservicio distribuido.
   * @param {string} username 
   * @param {string} password 
   * @returns {string} Token JWT generado
   * @throws {ServiceUnavailableError} Simulación de fallo operacional (caída de microservicio)
   * @throws {InvalidCredentialsError} Simulación de error de lógica (credenciales incorrectas)
   * @throws {ValidationError} Simulación de error de lógica (validación de campos)
   */
  static authenticate(username, password) {
    console.log(`\n--- [AuthService] Solicitud de Autenticación ---`);
    console.log(`Usuario recibido: "${username}"`);
    console.log(`Contraseña recibida: "${password ? '*'.repeat(password.length) : '(Vacía)'}"`);

    // 1. Simulación de Validación (Error de Lógica)
    if (!username || username.trim() === '') {
      console.error(`[Error de Lógica] Validación fallida: Nombre de usuario vacío.`);
      throw new ValidationError('El nombre de usuario es obligatorio.');
    }

    if (username.length < 3) {
      console.error(`[Error de Lógica] Validación fallida: "${username}" es menor a 3 caracteres.`);
      throw new ValidationError('El nombre de usuario debe tener al menos 3 caracteres.');
    }

    // 2. Simulación de Caída de Microservicio (Fallo Operacional)
    // Si el nombre de usuario tiene el sufijo/prefijo para forzar un fallo del microservicio
    if (username.toLowerCase().includes('fail-microservice')) {
      console.error(`[Fallo Operacional] Simulación de microservicio caído para: "${username}"`);
      throw new ServiceUnavailableError('El microservicio remoto de verificación de cuentas no respondió.');
    }

    // 3. Simulación de Credenciales Inválidas (Error de Lógica)
    // Para propósitos del demo, si el usuario ingresa un password que no coincide o un usuario de error específico
    if (username.toLowerCase().includes('fail-credentials') || (password && password !== 'espe123' && username !== password)) {
      console.error(`[Error de Lógica] Credenciales incorrectas. Contraseña no coincide con 'espe123' ni con "${username}".`);
      throw new InvalidCredentialsError('El nombre de usuario o la contraseña son incorrectos.');
    }

    // 4. Éxito: Se genera un token stateless (JWT)
    console.log(`[Éxito] Autenticación aprobada. Generando token stateless (JWT) para "${username.trim()}"`);
    return JWTHelper.sign({ username: username.trim() });
  }
}

module.exports = AuthService;
