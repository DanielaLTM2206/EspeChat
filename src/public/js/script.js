// ============================================================================
// SCRIPT PRINCIPAL - ESPEChat (Refactorizado)
// ============================================================================
// Lógica de cliente para mensajería en tiempo real con resiliencia transaccional.
// ============================================================================

const socket = io();

// Elementos del DOM
const sendButton = document.querySelector('#send-message');
const messageInput = document.querySelector('#message');
const messagesContainer = document.querySelector('#all-messages');
const typingIndicator = document.querySelector('#typing-indicator');
const userCountDisplay = document.querySelector('#online-count');

// Estado local
let currentUsername = '';
let isCurrentlyTyping = false;

// ============================================================================
// ALERTA DE SONIDO
// ============================================================================
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
// RENDERIZADOR Y CONCILIADOR DE MENSAJES (Resiliencia Transaccional)
// ============================================================================
/**
 * Renderiza o actualiza el estado de un mensaje en el DOM.
 * @param {Object} msg - Datos del mensaje
 * @param {'sent'|'sending'|'failed'} [status] - Estado actual del envío
 * @param {string} [clientMsgId] - ID único temporal del cliente
 */
function renderMessage(msg, status = 'sent', clientMsgId = null) {
  const user = msg.user;
  const text = msg.content || msg.message;
  const date = msg.date || new Date().toLocaleTimeString();
  const id = msg.id || '';

  // 1. Conciliación: Si el mensaje ya existe con este ID temporal, actualizamos su estado
  if (clientMsgId) {
    const existingElement = document.querySelector(`[data-client-id="${clientMsgId}"]`);
    if (existingElement) {
      if (status === 'sent') {
        existingElement.classList.remove('sending', 'failed');
        existingElement.querySelector('.time').innerText = date;
        if (id) existingElement.setAttribute('data-id', id);
        const errIndicator = existingElement.querySelector('.error-indicator');
        if (errIndicator) errIndicator.style.display = 'none';
      }
      return existingElement;
    }
  }

  // 2. Evitar duplicar mensajes cargados del historial por su ID real de base de datos
  if (id) {
    const existingById = document.querySelector(`[data-id="${id}"]`);
    if (existingById) return existingById;
  }

  const isOwnMessage = user === currentUsername;
  const messageClass = isOwnMessage ? 'message own' : 'message';
  const statusClass = status === 'sending' ? ' sending' : (status === 'failed' ? ' failed' : '');
  const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user)}`;

  const messageElement = document.createElement('div');
  messageElement.className = `${messageClass}${statusClass}`;
  if (clientMsgId) messageElement.setAttribute('data-client-id', clientMsgId);
  if (id) messageElement.setAttribute('data-id', id);

  // Mensaje de error para el reintento
  const errorIndicatorHtml = isOwnMessage 
    ? `<div class="error-indicator" style="color: #ff4a4a; font-size: 0.75rem; margin-top: 4px; display: ${status === 'failed' ? 'block' : 'none'}; font-weight: bold;">⚠️ No enviado. Clic para reintentar.</div>`
    : '';

  messageElement.innerHTML = `
    <div class="image-container">
      <img src="${avatarUrl}" alt="Avatar de ${user}" />
    </div>
    <div class="message-body">
      <div class="user-info">
        <span class="username">${user}</span>
        <span class="time">${date}</span>
      </div>
      <p>${text}</p>
      ${errorIndicatorHtml}
    </div>
  `;

  // Añadimos el listener de clic para el reintento de envío si el mensaje falló
  if (isOwnMessage) {
    messageElement.addEventListener('click', () => {
      if (messageElement.classList.contains('failed')) {
        resendMessage(messageElement, text, clientMsgId);
      }
    });
  }

  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return messageElement;
}

// ============================================================================
// FLUJO TRANSACCIONAL DE ENVÍO Y REINTENTOS
// ============================================================================
function sendMessage() {
  const messageText = messageInput.value.trim();
  
  if (messageText !== '') {
    // 1. Generar un ID temporal para rastrear este envío
    const clientMsgId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 2. Pintar en el DOM en estado "sending" de forma optimista (Latency Hiding)
    renderMessage({ user: currentUsername, content: messageText }, 'sending', clientMsgId);
    
    // 3. Emitir mensaje al servidor junto con el callback de confirmación (ACK)
    socket.emit('message', { content: messageText, clientMsgId }, (ack) => {
      handleServerAck(clientMsgId, ack);
    });
    
    // Limpieza de inputs y estados
    messageInput.value = '';
    isCurrentlyTyping = false;
    socket.emit('stopTyping');
  }
}

/**
 * Reintenta enviar un mensaje fallido.
 */
function resendMessage(element, text, clientMsgId) {
  element.classList.remove('failed');
  element.classList.add('sending');
  const errorIndicator = element.querySelector('.error-indicator');
  if (errorIndicator) errorIndicator.style.display = 'none';

  socket.emit('message', { content: text, clientMsgId }, (ack) => {
    handleServerAck(clientMsgId, ack);
  });
}

/**
 * Procesa la respuesta de confirmación (ACK) del servidor.
 */
function handleServerAck(clientMsgId, ack) {
  const el = document.querySelector(`[data-client-id="${clientMsgId}"]`);
  if (!el) return;

  if (ack && ack.success) {
    // Éxito: Quitar estilos de carga
    el.classList.remove('sending', 'failed');
    if (ack.id) el.setAttribute('data-id', ack.id);
  } else {
    // Error: Mostrar alerta de reintento
    el.classList.remove('sending');
    el.classList.add('failed');
    const errorIndicator = el.querySelector('.error-indicator');
    if (errorIndicator) {
      errorIndicator.style.display = 'block';
      errorIndicator.innerText = `⚠️ Error: ${ack?.error || 'Sin conexión'}. Clic para reintentar.`;
    }
  }
}

sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keyup', (event) => {
  if (event.key === 'Enter') {
    sendMessage();
  }
});

// Detección de escritura
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
// EVENTOS RECIBIDOS POR SOCKET.IO
// ============================================================================
socket.on('connected', (userInfo) => {
  currentUsername = userInfo.name;
});

// Carga completa del historial (Sincronización robusta ante reconexión)
socket.on('history', (historyMessages) => {
  messagesContainer.innerHTML = ''; // Limpiamos para evitar duplicados
  historyMessages.forEach(msg => {
    renderMessage(msg, 'sent');
  });
});

socket.on('updateUserCount', ({ count }) => {
  userCountDisplay.innerText = count;
});

// Recepción de mensaje difuminado por el servidor
socket.on('message', (msg) => {
  const isOwn = msg.user === currentUsername;
  
  if (isOwn) {
    // Conciliar mensaje propio usando el ID temporal
    renderMessage(msg, 'sent', msg.clientMsgId);
  } else {
    // Renderizar mensaje de otros y hacer sonar alerta
    renderMessage(msg, 'sent');
    playNotificationSound();
  }
});

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
