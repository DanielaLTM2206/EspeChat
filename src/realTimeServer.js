// ============================================================================
// SERVIDOR DE CHAT EN TIEMPO REAL - Socket.IO
// ============================================================================
// Este módulo configura Socket.IO para manejar la comunicación en tiempo real
// entre múltiples clientes del chat.
//
// Responsabilidades:
// - Gestionar conexiones de usuarios
// - Retransmitir mensajes a todos los clientes
// - Mantener lista de usuarios escribiendo (typing indicator)
// - Limpiar el estado cuando usuarios se desconectan
// ============================================================================

module.exports = (httpServer) => {
  const { Server } = require("socket.io");
  const io = new Server(httpServer);
  
  // Array que mantiene el registro de usuarios actualmente escribiendo
  let typingUsers = [];
  let connectedUsers = [];

  // ========================================================================
  // EVENTO: Conexión de nuevo usuario
  // ========================================================================
  io.on("connection", (socket) => {
    // Extraer el nombre del usuario de la cookie del navegador
    const cookie = socket.request.headers.cookie;
    const currentUser = cookie.split("=").pop();
    
    // Agregar usuario a la lista de conectados
    connectedUsers.push(currentUser);
    
    // Notificar al cliente que se conectó exitosamente
    // Se envía el nombre del usuario para que el cliente lo guarde
    socket.emit("connected", { name: currentUser });
    
    // Emitir el número actualizado de usuarios conectados a todos
    io.emit("updateUserCount", { count: connectedUsers.length });

    // ====================================================================
    // EVENTO: Recepción de un nuevo mensaje
    // ====================================================================
    socket.on("message", (messageContent) => {
      io.emit("message", {
        user: currentUser,
        message: messageContent,
        date: new Date().toLocaleTimeString(),
      });
    });

    // ====================================================================
    // EVENTO: Usuario empieza a escribir (typing)
    // ====================================================================
    socket.on("typing", () => {
      if (!typingUsers.includes(currentUser)) {
        typingUsers.push(currentUser);
      }
      io.emit("updateTyping", { typingUsers });
    });

    // ====================================================================
    // EVENTO: Usuario deja de escribir (stopTyping)
    // ====================================================================
    socket.on("stopTyping", () => {
      typingUsers = typingUsers.filter((user) => user !== currentUser);
      io.emit("updateTyping", { typingUsers });
    });

    // ====================================================================
    // EVENTO: Desconexión del usuario
    // ====================================================================
    socket.on("disconnect", () => {
      typingUsers = typingUsers.filter((user) => user !== currentUser);
      connectedUsers = connectedUsers.filter((user) => user !== currentUser);
      io.emit("updateTyping", { typingUsers });
      io.emit("updateUserCount", { count: connectedUsers.length });
    });
  });
};
