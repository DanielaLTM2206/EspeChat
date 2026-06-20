const express = require("express");
const router = express.Router();
const path = require("path");
const isLoggedIn = require("../middleware/isLoggedIn");
const AuthService = require("../services/authService");
const { 
  InvalidCredentialsError, 
  TokenExpiredError, 
  ServiceUnavailableError, 
  DatabaseError 
} = require("../utils/errors");

const views = path.join(__dirname, "/../views");

router.get("/", isLoggedIn, (req, res) => {
  res.sendFile(views + "/index.html");
});

router.get("/register", (req, res) => {
  res.sendFile(views + "/register.html");
});

// Endpoint de login (Autenticación Stateless usando JWT)
router.post("/api/login", (req, res, next) => {
  try {
    const { username, password } = req.body;
    const token = AuthService.authenticate(username, password);

    // Guardar el token en una cookie HttpOnly segura para prevenir robo de sesión
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 3600000 // 1 hora
    });

    res.json({ success: true, message: "Sesión iniciada correctamente." });
  } catch (error) {
    next(error); // Pasa al manejador de errores de Express y Sentry
  }
});

// Endpoint de logout
router.post("/api/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ success: true, message: "Sesión cerrada correctamente." });
});

// Endpoint de depuración para probar y verificar Sentry
router.get("/api/debug-error", (req, res, next) => {
  const { type } = req.query;

  try {
    switch (type) {
      case "logic-credentials":
        throw new InvalidCredentialsError("Prueba: Intento de inicio de sesión fallido.");
      case "logic-token":
        throw new TokenExpiredError("Prueba: Token de sesión expirado de forma simulada.");
      case "operational-service":
        throw new ServiceUnavailableError("Prueba: Conexión caída con el microservicio de auth.");
      case "operational-db":
        throw new DatabaseError("Prueba: Fallo de lectura/escritura en el repositorio de mensajes.");
      case "runtime":
        // Provocar un error de programación (TypeError)
        const user = null;
        user.getName();
        break;
      default:
        throw new Error("Error genérico de depuración.");
    }
  } catch (error) {
    next(error); // Propagar para ser capturado por Sentry y el middleware de Express
  }
});

module.exports = router;
