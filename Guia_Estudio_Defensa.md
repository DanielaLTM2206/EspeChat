# Guía de Estudio y Defensa: ESPEChat
## Refactorización Arquitectónica, SOLID y Resiliencia Transaccional

Esta guía contiene la teoría, la explicación del código, las **preguntas y respuestas típicas** que te hará tu docente durante la defensa de este proyecto, y los **fragmentos de código clave** que debes copiar e incluir en tu informe (o tomarles captura de pantalla).

---

## 1. Arquitectura y SOLID (Estructura del Proyecto)

El objetivo de la refactorización fue limpiar el código aplicando principios del proyecto de clase **`cleansolid`**:

### Antes (Código Acoplado)
Todo el código estaba dentro de un único archivo (`realTimeServer.js`). Este archivo se encargaba de:
1. Parsear cookies de forma manual y frágil.
2. Gestionar la conexión de red (Sockets).
3. Llevar las listas de usuarios en memoria.
4. Escribir/leer datos.

*Esto violaba el principio **S (Responsabilidad Única)** de SOLID.*

### Después (Arquitectura en Capas)
Dividimos las responsabilidades en clases independientes:
*   **[`CookieHelper.js`](./src/utils/cookieHelper.js)**: Utilidad de infraestructura para el análisis seguro de cookies.
*   **[`UserRepository.js`](./src/repositories/UserRepository.js)**: Capa de datos en memoria para usuarios activos.
*   **[`MessageRepository.js`](./src/repositories/MessageRepository.js)**: Capa de persistencia resiliente a fallos.
*   **[`realTimeServer.js`](./src/realTimeServer.js)**: Controlador de infraestructura de red (WebSockets).

> 💡 **Cómo defender esto:** 
> *"Profesor, se aplicó el principio de **Responsabilidad Única (S de SOLID)** separando el protocolo de sockets del almacenamiento físico de datos. La lógica de persistencia ahora está encapsulada en repositorios, lo que permite cambiar el almacenamiento (de archivos JSON a una base de datos distribuida como Redis o PostgreSQL) de forma transparente y sin modificar la lógica del servidor de red."*

---

## 2. Resiliencia Transaccional (Durabilidad y Consistencia)

La resiliencia transaccional consiste en asegurar que los datos no se corrompan y que las transacciones (en este caso, guardar un mensaje de chat) se completen de manera segura.

### A. Escritura Atómica (Patrón Write-Swap)
Cuando escribimos en un archivo común mediante `fs.writeFile`, si el proceso se detiene o se corta la luz a la mitad del proceso, el archivo queda truncado o con sintaxis JSON inválida, arruinando todo el historial.
*   **Nuestra solución:**
    1. Escribimos los datos en un archivo temporal intermedio (`messages.json.tmp`).
    2. Creamos un respaldo de seguridad del archivo maestro previo (`messages.json.bak`).
    3. Renombramos el archivo temporal al original (`messages.json`) usando `fs.rename`.
*   **Teoría de Sistemas Operativos:** La operación `rename` es **atómica** a nivel del Kernel del sistema operativo (NTFS en Windows / ext4 en Linux). Esto significa que se realiza en un solo ciclo físico de disco; o se reemplaza por completo o no se hace nada. El archivo jamás quedará corrupto.

### B. Control de Concurrencia (Mutex Asíncrono)
Si dos usuarios envían mensajes de forma simultánea, las funciones asíncronas de lectura/escritura en disco pueden superponerse (Race Conditions), haciendo que una escritura sobreescriba a la otra.
*   **Nuestra solución:** `MessageRepository` implementa una cola secuencial usando promesas en cascada (`writeQueue = writeQueue.then(...)`). Esto garantiza la **consistencia** (propiedad C de ACID) encolando las transacciones para que se ejecuten una por una de forma ordenada.

### C. Tolerancia a Fallos (Autocuración)
Si el archivo maestro `messages.json` resulta dañado, el método de lectura `loadAll()` atrapa el error (`try/catch`), lee automáticamente la copia de respaldo (`.bak`), reescribe el principal para auto-repararlo y el chat sigue funcionando sin caídas.

---

## 3. Protocolo de Comunicación Resiliente (Conexión y Sockets)

El chat original era *"Fire-and-Forget"* (dispara y olvida). El cliente enviaba un mensaje por socket y no sabía si el servidor realmente lo había guardado o no.

### El Nuevo Flujo ACK (Confirmación Transaccional)
1.  **UI Optimista (Optimistic UI):** Al hacer clic en enviar, el frontend ([`script.js`](./src/public/js/script.js)) genera un identificador único de cliente (`clientMsgId`) y renderiza el mensaje de inmediato de forma opaca/translúcida aplicando la clase CSS `.sending`.
2.  **Llamada con Confirmación (ACK):** El cliente emite el mensaje incluyendo un callback. El servidor procesa el mensaje dentro de un bloque `try/catch`.
3.  **Conciliación:**
    *   **Si el servidor guarda exitosamente:** Responde al callback `{ success: true, id: messageId }` y difunde el mensaje de forma global con su `clientMsgId`. El cliente emisor detecta que el ID coincide, retira la opacidad (`.sending`) y el mensaje queda marcado como "enviado".
    *   **Si el servidor falla:** Captura el error en el `catch` y responde al callback `{ success: false, error: '...' }`. El cliente retira la clase `.sending`, le añade la clase `.failed` (borde rojo de error) y muestra el aviso de **"No enviado - Clic para reintentar"**.
4.  **Reintento manual:** El usuario puede pulsar el mensaje en rojo para reenviarlo con el mismo `clientMsgId`, logrando la retransmisión transaccional de forma controlada y sin duplicar mensajes en la pantalla.

---

## 4. Anexo: Código e Imágenes para el Informe

Utiliza los siguientes fragmentos para incluirlos en tu informe o tomarles capturas de pantalla desde tu IDE (Visual Studio Code):

### 📷 Imagen 1: Escritura Atómica (Write-Swap)
**Ubicación:** [src/repositories/MessageRepository.js](./src/repositories/MessageRepository.js) (Líneas 67 - 90)
*Muestra cómo se garantiza la atomicidad escribiendo primero en un archivo temporal.*
```javascript
  async writeAtomic(data) {
    const jsonString = JSON.stringify(data, null, 2);

    // 1. Escribimos los datos en el archivo temporal (.tmp)
    await fs.writeFile(this.tempPath, jsonString, 'utf8');

    // 2. Si el archivo principal existe, creamos una copia de seguridad (.bak)
    try {
      const fileExists = await fs.access(this.filePath).then(() => true).catch(() => false);
      if (fileExists) {
        await fs.copyFile(this.filePath, this.backupPath);
      }
    } catch (err) {
      console.warn('No se pudo generar copia de respaldo:', err.message);
    }

    // 3. Renombramos el archivo temporal al maestro de manera atómica (Garantizado por el OS)
    await fs.rename(this.tempPath, this.filePath);
  }
```

---

### 📷 Imagen 2: Control de Concurrencia (Cola de Escritura)
**Ubicación:** [src/repositories/MessageRepository.js](./src/repositories/MessageRepository.js) (Líneas 43 - 62)
*Muestra cómo encadenar promesas para evitar que dos usuarios escriban al mismo tiempo en el JSON.*
```javascript
    // Usamos encadenamiento de promesas para serializar escrituras concurrentes (Locks)
    return new Promise((resolve, reject) => {
      this.writeQueue = this.writeQueue
        .then(async () => {
          const messages = await this.loadAll();
          
          const newMessage = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            user: message.user.trim(),
            content: message.content.trim(),
            date: message.date || new Date().toLocaleTimeString()
          };

          messages.push(newMessage);

          await this.writeAtomic(messages);
          resolve(newMessage);
        })
        .catch((error) => {
          reject(new Error('Fallo del sistema al persistir el mensaje.'));
        });
    });
```

---

### 📷 Imagen 3: Cláusulas de Guarda en Sockets
**Ubicación:** [src/realTimeServer.js](./src/realTimeServer.js) (Líneas 23 - 35)
*Muestra un código limpio aplicando la salida rápida o cláusula de guarda si no existe cookie.*
```javascript
  io.on("connection", async (socket) => {
    
    // 1. Cláusula de Guarda: Obtener y validar el usuario desde cookies de forma segura
    const cookieHeader = socket.request.headers.cookie;
    const currentUser = CookieHelper.get(cookieHeader, "username");
    
    if (!currentUser) {
      console.warn("Conexión rechazada: Cookie 'username' ausente.");
      socket.disconnect(true);
      return; // Salida rápida (Guard Clause)
    }
```

---

### 📷 Imagen 4: Envío Optimista y Confirmación (ACK) del Cliente
**Ubicación:** [src/public/js/script.js](./src/public/js/script.js) (Líneas 114 - 138)
*Muestra cómo el cliente renderiza de forma optimista con clase 'sending' y maneja la respuesta (ACK).*
```javascript
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
```

---

## 5. Banco de Preguntas Frecuentes del Docente (Q&A)

**Q1: ¿Por qué creaste repositorios en lugar de dejar el código como estaba?**
> *R: Por el principio SOLID de Responsabilidad Única. El servidor de sockets no debe saber cómo se guardan físicamente los mensajes en el disco. Al aislar la base de datos en un repositorio, el sistema es modular, escalable y mantenible.*

**Q2: ¿Qué pasa si el servidor se desconecta a mitad de la escritura de un mensaje en el disco?**
> *R: Implementamos la técnica de Write-Swap (Escritura Atómica). Los datos se escriben en un archivo temporal `.tmp` y luego se renombran de manera atómica al original usando `fs.rename`. Si el servidor se apaga a mitad de la escritura en el archivo temporal, el archivo maestro original no sufre daños y al reiniciar se recuperará el último estado consistente.*

**Q3: ¿Cómo manejas las condiciones de carrera (Race Conditions) si muchos usuarios escriben al mismo tiempo?**
> *R: En `MessageRepository` implementamos un semáforo/cola de escritura asíncrona mediante encadenamiento de promesas. Esto obliga a que las solicitudes concurrentes se resuelvan en orden secuencial, garantizando la consistencia de los datos en el disco.*

**Q4: ¿Qué hace tu cliente (frontend) si se pierde la conexión de red mientras el usuario envía un mensaje?**
> *R: El cliente no pierde el mensaje. Lo coloca en estado temporal de carga (`.sending`). Si la confirmación de red (ACK) del servidor falla, el mensaje pasa a estado de fallo (`.failed`) en color rojo. El usuario puede simplemente hacer clic en el mensaje para reintentarlo de forma segura.*

**Q5: ¿Por qué usas un `Set` en lugar de un `Array` para almacenar los usuarios en línea?**
> *R: Porque un `Set` impide almacenar valores duplicados de forma nativa. Si un mismo usuario abre el chat en tres pestañas diferentes, el sistema lo cuenta como un único usuario activo, lo cual es más consistente con las reglas de negocio reales.*
