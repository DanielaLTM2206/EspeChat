/**
 * UserRepository: Encargado de gestionar los usuarios conectados en memoria.
 * Aplica el principio de Responsabilidad Única (S de SOLID).
 * Facilita un futuro cambio hacia Redis o base de datos centralizada.
 */
class UserRepository {
  constructor() {
    // Usamos un Set para asegurar nombres de usuario únicos sin duplicados
    this.connectedUsers = new Set();
  }

  /**
   * Agrega un nuevo usuario conectado.
   * @param {string} username 
   */
  add(username) {
    if (username && username.trim() !== '') {
      this.connectedUsers.add(username.trim());
    }
  }

  /**
   * Elimina un usuario al desconectarse.
   * @param {string} username 
   */
  remove(username) {
    if (username) {
      this.connectedUsers.delete(username.trim());
    }
  }

  /**
   * Retorna la lista de usuarios activos.
   * @returns {string[]}
   */
  getAll() {
    return Array.from(this.connectedUsers);
  }

  /**
   * Retorna el recuento actual de usuarios conectados.
   * @returns {number}
   */
  count() {
    return this.connectedUsers.size;
  }
}

module.exports = UserRepository;
