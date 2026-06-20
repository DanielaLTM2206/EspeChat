// ============================================================================
// SERVIDOR DE CHAT EN TIEMPO REAL (Refactorizado con SOLID y Resiliencia)
// ============================================================================
// Este archivo actúa como el controlador de sockets del sistema.
// Integra los repositorios asíncronos y gestiona la comunicación bidireccional.
// ============================================================================

const CookieHelper = require("./utils/cookieHelper");
const MessageRepository = require("./repositories/MessageRepository");
const UserRepository = require("./repositories/UserRepository");
const Sentry = require("@sentry/node");
const JWTHelper = require("./utils/jwtHelper");
const { InvalidCredentialsError } = require("./utils/errors");

module.exports = (httpServer) => {
  const { Server } = require("socket.io");
  const io = new Server(httpServer);
  
  // Instanciamos los repositorios (Persistencia desacoplada - SOLID)
  const messageRepository = new MessageRepository();
  const userRepository = new UserRepository();

  // Lista local para gestionar los usuarios escribiendo
  let typingUsers = [];

  // ========================================================================
  // EVENTO: Conexión de nuevo usuario
  // ========================================================================
  io.on("connection", async (socket) => {
    
    // 1. Cláusula de Guarda: Obtener y validar el JWT token desde cookies
    const cookieHeader = socket.request.headers.cookie;
    const token = CookieHelper.get(cookieHeader, "token");
    let currentUser = null;
    
    if (!token) {
      const err = new InvalidCredentialsError("Conexión rechazada: Token de sesión ausente.");
      Sentry.captureException(err, {
        tags: { source: "socket.io", event: "connection" },
        extra: { socketId: socket.id }
      });
      console.warn("Conexión rechazada: Token JWT ausente.");
      socket.disconnect(true);
      return;
    }

    try {
      const decoded = JWTHelper.verify(token);
      currentUser = decoded.username;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { source: "socket.io", event: "connection" },
        extra: { socketId: socket.id, token }
      });
      console.warn("Conexión rechazada: Token JWT inválido o expirado.", error.message);
      socket.disconnect(true);
      return;
    }

    // 2. Registro de sesión en memoria
    userRepository.add(currentUser);
    
    // 3. Confirmación de conexión exitosa
    socket.emit("connected", { name: currentUser });
    
    // 4. Carga de Historial Resiliente (Durabilidad):
    // Cargamos mensajes guardados y los enviamos al cliente para sincronizar su estado
    try {
      const messageHistory = await messageRepository.loadAll();
      socket.emit("history", messageHistory);
    } catch (historyError) {
      console.error("Error al cargar el historial para el nuevo cliente:", historyError.message);
    }
    
    // 5. Notificación del conteo actualizado de usuarios online
    io.emit("updateUserCount", { count: userRepository.count() });

    // ====================================================================
    // EVENTO: Recepción de mensaje con confirmación (ACK) y atomicidad
    // ====================================================================
    socket.on("message", async (payload, callback) => {
      // Control de formato: Soporta strings directos o payloads estructurados
      let content = "";
      let clientMsgId = null;

      if (payload && typeof payload === "object") {
        content = payload.content;
        clientMsgId = payload.clientMsgId;
      } else {
        content = payload;
      }

      // Cláusula de guarda: Validar contenido antes de procesar
      if (!content || content.trim() === "") {
        if (typeof callback === "function") {
          callback({ success: false, error: "El mensaje no puede estar vacío." });
        }
        return;
      }

      // Intentar persistencia y difusión asíncrona controlando excepciones
      try {
        const savedMsg = await messageRepository.save({
          user: currentUser,
          content: content
        });

        // Difusión global enriquecida con el ID temporal del cliente para la conciliación
        io.emit("message", {
          ...savedMsg,
          clientMsgId
        });

        // Enviamos el ACK de éxito al cliente emisor (Confirmación Transaccional)
        if (typeof callback === "function") {
          callback({ success: true, id: savedMsg.id });
        }
      } catch (error) {
        // Registrar el error en Sentry con tags e información extra
        Sentry.captureException(error, { 
          tags: { source: "socked.io", event: "message" },
          extra: { socketId: socket.id }
        });

        console.error(`Error al procesar mensaje de ${currentUser}:`, error.message);
        
        // Enviamos el ACK de fallo con el motivo al emisor
        if (typeof callback === "function") {
          callback({ success: false, error: "No se pudo guardar el mensaje." });
        }
      }
    });

    // ====================================================================
    // EVENTOS DE ESCRITURA (Typing indicator)
    // ====================================================================
    socket.on("typing", () => {
      if (!typingUsers.includes(currentUser)) {
        typingUsers.push(currentUser);
      }
      io.emit("updateTyping", { typingUsers });
    });

    socket.on("stopTyping", () => {
      typingUsers = typingUsers.filter((user) => user !== currentUser);
      io.emit("updateTyping", { typingUsers });
    });

    // ====================================================================
    // EVENTO: Captura de errores del socket (Observabilidad)
    // ====================================================================
    socket.on("error", (err) => {
      Sentry.captureException(err, {
        tags: { source: "socket.io", event: "error" },
        extra: { socketId: socket.id },
      });
    });

    // ====================================================================
    // EVENTO: Desconexión del usuario (Limpieza segura del estado)
    // ====================================================================
    socket.on("disconnect", () => {
      // Removemos al usuario del repositorio de activos
      userRepository.remove(currentUser);
      
      // Limpiamos la lista de typing
      typingUsers = typingUsers.filter((user) => user !== currentUser);
      
      // Notificamos a todos los clientes del nuevo estado
      io.emit("updateTyping", { typingUsers });
      io.emit("updateUserCount", { count: userRepository.count() });
    });
  });
};
