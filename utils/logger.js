const Log = require('../models/Log');

/**
 * Logger utility para el sistema de salud
 * Maneja logging tanto en consola como en base de datos
 */
class Logger {
  constructor() {
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    this.currentLevel = process.env.LOG_LEVEL || 'INFO';
  }

  /**
   * Log a nivel ERROR
   */
  error(category, action, data = {}) {
    this.log('ERROR', category, action, data);
  }

  /**
   * Log a nivel WARN
   */
  warn(category, action, data = {}) {
    this.log('WARN', category, action, data);
  }

  /**
   * Log a nivel INFO
   */
  info(category, action, data = {}) {
    this.log('INFO', category, action, data);
  }

  /**
   * Log a nivel DEBUG
   */
  debug(category, action, data = {}) {
    this.log('DEBUG', category, action, data);
  }

  /**
   * Método principal de logging
   */
  async log(level, category, action, data = {}) {
    // Verificar si el nivel está habilitado
    if (this.levels[level] > this.levels[this.currentLevel]) {
      return;
    }

    const logData = {
      level,
      category,
      action,
      user: data.user || 'desconocido',
      paciente: data.paciente || 'desconocido',
      valoracion: data.valoracion || 'desconocido',
      details: data.details || {},
      ip: data.ip || '',
      userAgent: data.userAgent || ''
    };

    // Formato para consola
    const consoleMessage = `[${new Date().toISOString()}] ${level} [${category}]: ${action} - Usuario: ${logData.user} - Paciente: ${logData.paciente} - Valoración: ${logData.valoracion}`;

    // Log en consola
    switch (level) {
      case 'ERROR':
        console.error(`🔴 ${consoleMessage}`, logData.details);
        break;
      case 'WARN':
        console.warn(`🟡 ${consoleMessage}`, logData.details);
        break;
      case 'INFO':
        console.log(`📋 ${consoleMessage}`, logData.details);
        break;
      case 'DEBUG':
        console.debug(`🔵 ${consoleMessage}`, logData.details);
        break;
    }

    // Guardar en base de datos (de forma asíncrona para no bloquear)
    try {
      await Log.createLog(logData);
    } catch (dbError) {
      console.error('❌ Error guardando log en base de datos:', dbError.message);
    }
  }

  /**
   * Middleware para Express que añade logging automático
   */
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();

      // Datos del request
      const logData = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent') || '',
        user: req.user?.username || req.body?.username || 'desconocido'
      };

      // Log del acceso
      this.info('API', `ACCESO_${req.method}`, {
        ...logData,
        details: {
          path: req.path,
          method: req.method,
          query: req.query,
          body: req.method !== 'GET' ? req.body : undefined
        }
      });

      // Interceptar respuesta para log de tiempo
      const originalSend = res.send;
      res.send = function(data) {
        const duration = Date.now() - startTime;

        logger.info('API', `RESPUESTA_${req.method}`, {
          ...logData,
          details: {
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            responseSize: data ? data.length : 0
          }
        });

        originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Método específico para logging de autenticación
   */
  logAuth(action, data = {}) {
    this.info('AUTH', action, data);
  }

  /**
   * Método específico para logging de pacientes
   */
  logPaciente(action, data = {}) {
    this.info('PACIENTE', action, data);
  }

  /**
   * Método específico para logging de valoraciones
   */
  logValoracion(action, data = {}) {
    this.info('VALORACION', action, data);
  }

  /**
   * Método específico para logging de RIPS
   */
  logRIPS(action, data = {}) {
    this.info('RIPS', action, data);
  }
}

// Instancia global del logger
const logger = new Logger();

module.exports = logger;