// ============================================================================
// SCRIPT PRINCIPAL - ESPEChat
// ============================================================================
// Este archivo maneja la lógica del cliente para el chat en tiempo real.
// Responsabilidades:
// - Captura eventos de entrada del usuario (escritura, envío de mensajes)
// - Emite eventos al servidor a través de Socket.IO
// - Escucha eventos del servidor y actualiza el DOM dinámicamente
// - Gestiona el indicador de "está escribiendo..."
// ============================================================================

const socket = io();

// ============================================================================
// ELEMENTOS DEL DOM
// ============================================================================
const sendButton = document.querySelector('#send-message');
const messageInput = document.querySelector('#message');
const messagesContainer = document.querySelector('#all-messages');
const typingIndicator = document.querySelector('#typing-indicator');
const userCountDisplay = document.querySelector('#online-count');

// ============================================================================
// ESTADO DEL CLIENTE
// ============================================================================
let currentUsername = '';              // Nombre del usuario conectado
let isCurrentlyTyping = false;          // Flag para rastrear estado de escritura

// ============================================================================
// FUNCIÓN DE NOTIFICACIÓN DE SONIDO
// ============================================================================
/**
 * Reproduce un sonido de notificación cuando llega un nuevo mensaje
 * Utiliza Web Audio API para generar un sonido simple sin archivo externo
 */
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (e) {
    console.log('No se pudo reproducir sonido:', e);
  }
}

// ============================================================================
// MANEJO DE ENVÍO DE MENSAJES
// ============================================================================
/**
 * Envía un mensaje al servidor cuando el usuario:
 * 1. Hace clic en el botón de envío
 * 2. Presiona la tecla Enter
 */
function sendMessage() {
  const messageText = messageInput.value.trim();
  
  if (messageText !== '') {
    // Emitir el mensaje al servidor
    socket.emit('message', messageText);
    
    // Limpiar el campo de entrada
    messageInput.value = '';
    
    // Reiniciar el estado de escritura
    isCurrentlyTyping = false;
    
    // Notificar al servidor que el usuario dejó de escribir
    socket.emit('stopTyping');
  }
}

sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keyup', (event) => {
  if (event.key === 'Enter') {
    sendMessage();
  }
});

// ============================================================================
// DETECCIÓN DE ESCRITURA (Typing Indicator)
// ============================================================================
messageInput.addEventListener('input', () => {
  const hasText = messageInput.value.trim() !== '';
  
  if (hasText && !isCurrentlyTyping) {
    socket.emit('typing');
    isCurrentlyTyping = true;
  } else if (!hasText && isCurrentlyTyping) {
    socket.emit('stopTyping');
    isCurrentlyTyping = false;
  }
});

// ============================================================================
// EVENTOS DE SOCKET - CONEXIÓN
// ============================================================================
socket.on('connected', (userInfo) => {
  currentUsername = userInfo.name;
});

// ============================================================================
// EVENTOS DE SOCKET - CONTADOR DE USUARIOS
// ============================================================================
/**
 * Evento: updateUserCount
 * Se recibe cuando un usuario se conecta o desconecta.
 * Actualiza el contador de usuarios online en el header.
 */
socket.on('updateUserCount', ({ count }) => {
  userCountDisplay.innerText = count;
});

// ============================================================================
// EVENTOS DE SOCKET - MENSAJES
// ============================================================================
/**
 * Evento: message
 * Se recibe cuando cualquier usuario envía un mensaje.
 */
socket.on('message', ({ user, message, date }) => {
  // Determinar si el mensaje es del usuario actual
  const messageClass = user === currentUsername ? 'message own' : 'message';
  
  // Generar URL del avatar usando DiceBear API
  // Cada usuario obtiene un avatar único y consistente basado en su nombre
  const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user)}`;
  
  // Crear el elemento HTML del mensaje
  const messageElement = document.createRange().createContextualFragment(`
    <div class="${messageClass}">
      <div class="image-container">
        <img src="${avatarUrl}" alt="Avatar de ${user}" />
      </div>
      <div class="message-body">
        <div class="user-info">
          <span class="username">${user}</span>
          <span class="time">${date}</span>
        </div>
        <p>${message}</p>
      </div>
    </div>
  `);
  
  // Añadir el mensaje al contenedor
  messagesContainer.appendChild(messageElement);
  
  // Reproducir sonido de notificación si no es un mensaje propio
  if (user !== currentUsername) {
    playNotificationSound();
  }
  
  // Desplazar la vista al último mensaje (auto-scroll)
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

// ============================================================================
// EVENTOS DE SOCKET - INDICADOR DE ESCRITURA
// ============================================================================
socket.on('updateTyping', ({ typingUsers }) => {
  const otherTypingUsers = typingUsers.filter((user) => user !== currentUsername);
  
  if (otherTypingUsers.length === 0) {
    typingIndicator.innerText = '';
  } else if (otherTypingUsers.length === 1) {
    typingIndicator.innerText = `${otherTypingUsers[0]} está escribiendo...`;
  } else if (otherTypingUsers.length === 2) {
    typingIndicator.innerText = `${otherTypingUsers[0]} y ${otherTypingUsers[1]} están escribiendo...`;
  } else {
    typingIndicator.innerText = 'Varios usuarios están escribiendo...';
  }
});
