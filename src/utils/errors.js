/**
 * Clase base para todos los errores de la aplicación.
 * Permite manejar códigos HTTP y determinar si el error es de tipo operacional o lógico.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational; // true = Operacional (Fallo técnico), false = Lógico (Comportamiento esperado)
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Errores de Lógica: Errores de negocio esperados, no representan fallas de la infraestructura.
 * Ejemplos: credenciales inválidas, tokens vencidos, entradas mal formadas.
 */
class LogicError extends AppError {
  constructor(message, statusCode = 400) {
    super(message, statusCode, false); // isOperational = false
  }
}

/**
 * Errores Operacionales: Fallos críticos o técnicos del entorno de ejecución.
 * Ejemplos: caída de un microservicio, fallo en escritura de disco, error de base de datos.
 */
class OperationalError extends AppError {
  constructor(message, statusCode = 500) {
    super(message, statusCode, true); // isOperational = true
  }
}

// --- Errores Específicos de Lógica ---

class InvalidCredentialsError extends LogicError {
  constructor(message = 'Las credenciales proporcionadas no son válidas.') {
    super(message, 401);
  }
}

class TokenExpiredError extends LogicError {
  constructor(message = 'El token de sesión ha expirado. Por favor, inicie sesión nuevamente.') {
    super(message, 401);
  }
}

class ValidationError extends LogicError {
  constructor(message = 'Los datos enviados no superaron las validaciones.') {
    super(message, 400);
  }
}

// --- Errores Específicos Operacionales ---

class DatabaseError extends OperationalError {
  constructor(message = 'Error en el sistema de almacenamiento persistente.') {
    super(message, 500);
  }
}

class ServiceUnavailableError extends OperationalError {
  constructor(message = 'El microservicio de autenticación no se encuentra disponible temporalmente.') {
    super(message, 503);
  }
}

module.exports = {
  AppError,
  LogicError,
  OperationalError,
  InvalidCredentialsError,
  TokenExpiredError,
  ValidationError,
  DatabaseError,
  ServiceUnavailableError
};
