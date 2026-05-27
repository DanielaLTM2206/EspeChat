const fs = require('fs').promises;
const path = require('path');

/**
 * MessageRepository: Encargado de la persistencia persistente de mensajes en un archivo JSON.
 * Implementa el principio de Responsabilidad Única (S de SOLID).
 * Garantiza resiliencia mediante una cola de concurrencia y escritura atómica (Write-Swap).
 */
class MessageRepository {
  constructor(filePath) {
    // Definimos las rutas del archivo de datos y de respaldo
    this.filePath = filePath || path.join(__dirname, '../../data/messages.json');
    this.backupPath = `${this.filePath}.bak`;
    this.tempPath = `${this.filePath}.tmp`;
    
    // Cola asíncrona simple para sincronizar escrituras concurrentes (Control de Concurrencia)
    this.writeQueue = Promise.resolve();
    
    // Aseguramos que el directorio exista al instanciar el repositorio
    const dir = path.dirname(this.filePath);
    const fsSync = require('fs');
    if (!fsSync.existsSync(dir)) {
      fsSync.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Carga de forma segura todos los mensajes desde el disco.
   * Tolerante a fallos: Si el archivo está corrupto o no existe, intenta cargar el respaldo.
   * @returns {Promise<Array>}
   */
  async loadAll() {
    try {
      return await this.safeReadFile(this.filePath);
    } catch (error) {
      console.warn('Advertencia: Archivo de mensajes corrupto o ausente. Recuperando desde el backup...');
      try {
        const backupData = await this.safeReadFile(this.backupPath);
        // Restauramos el archivo maestro dañado de forma atómica
        await this.writeAtomic(backupData);
        return backupData;
      } catch (backupError) {
        console.error('Fallo Crítico: No se pudo leer el archivo de respaldo. Iniciando base de datos vacía.');
        return [];
      }
    }
  }

  /**
   * Guarda un nuevo mensaje con garantías de consistencia y atomicidad (ACID).
   * @param {Object} message - Objeto con datos del mensaje { user, content, date }
   * @returns {Promise<Object>}
   */
  async save(message) {
    if (!message.user || !message.content) {
      throw new Error('Validación fallida: El remitente y el contenido son requeridos.');
    }

    // Usamos encadenamiento de promesas para serializar escrituras concurrentes (Locks)
    return new Promise((resolve, reject) => {
      this.writeQueue = this.writeQueue
        .then(async () => {
          const messages = await this.loadAll();
          
          // Creamos el mensaje con formato estructurado
          const newMessage = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            user: message.user.trim(),
            content: message.content.trim(),
            date: message.date || new Date().toLocaleTimeString()
          };

          messages.push(newMessage);

          // Guardamos con la técnica Write-Swap (Escritura atómica)
          await this.writeAtomic(messages);
          resolve(newMessage);
        })
        .catch((error) => {
          console.error('Error al guardar el mensaje de forma resiliente:', error);
          reject(new Error('Fallo del sistema al persistir el mensaje.'));
        });
    });
  }

  /**
   * Patrón de Escritura Atómica (Write-Swap) para simular transacciones fiables a nivel físico.
   * @param {Array} data - Lista de mensajes
   */
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

  /**
   * Lee un archivo JSON de forma segura y tolera fallos de parseo.
   * @param {string} file 
   * @returns {Promise<Array>}
   */
  async safeReadFile(file) {
    try {
      const rawContent = await fs.readFile(file, 'utf8');
      if (!rawContent || rawContent.trim() === '') return [];
      return JSON.parse(rawContent);
    } catch (error) {
      // Si el archivo no existe (ENOENT) es normal la primera vez, retornamos vacío.
      if (error.code === 'ENOENT') return [];
      throw error; // Propagamos otros errores (ej. JSON corrupto) para activar el backup
    }
  }
}

module.exports = MessageRepository;
