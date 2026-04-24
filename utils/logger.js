const { Log } = require("../models-sequelize");

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
      DEBUG: 3,
    };
    this.currentLevel = process.env.LOG_LEVEL || "INFO";
  }

  /**
   * Log a nivel ERROR
   */
  error(category, action, data = {}) {
    this.log("ERROR", category, action, data);
  }

  /**
   * Log a nivel WARN
   */
  warn(category, action, data = {}) {
    this.log("WARN", category, action, data);
  }

  /**
   * Log a nivel INFO
   */
  info(category, action, data = {}) {
    this.log("INFO", category, action, data);
  }

  /**
   * Log a nivel DEBUG
   */
  debug(category, action, data = {}) {
    this.log("DEBUG", category, action, data);
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
      username: data.user || "desconocido",
      paciente_id: data.paciente || null,
      valoracion_id: data.valoracion || "desconocido",
      details: data.details || {},
      ip: data.ip || "",
      user_agent: data.userAgent || "",
    };

    // Formato para consola
    const consoleMessage = `[${new Date().toISOString()}] ${level} [${category}]: ${action} - Usuario: ${logData.username} - Paciente: ${data.paciente || "desconocido"} - Valoración: ${logData.valoracion_id}`;

    // Log en consola
    switch (level) {
      case "ERROR":
        console.error(`🔴 ${consoleMessage}`, logData.details);
        break;
      case "WARN":
        console.warn(`🟡 ${consoleMessage}`, logData.details);
        break;
      case "INFO":
        console.log(`📋 ${consoleMessage}`, logData.details);
        break;
      case "DEBUG":
        console.debug(`🔵 ${consoleMessage}`, logData.details);
        break;
    }

    // NOTA: Guardado en base de datos desactivado. Solo logs en consola.
    // Para reactivar, descomenta las siguientes líneas:
    // try {
    //   await Log.createLog(logData);
    // } catch (dbError) {
    //   console.error("❌ Error guardando log en BD:", dbError.message);
    // }
  }

  /**
   * Middleware de Auditoría - Filtra qué eventos registrar en BD
   */
  auditMiddleware() {
    return (req, res, next) => {
      // Solo registrar operaciones de modificación (POST, PUT, DELETE) y login
      const shouldLog =
        ["POST", "PUT", "DELETE"].includes(req.method) ||
        req.path.includes("/auth/login") ||
        req.path.includes("/auth/verify-2fa-login");

      if (shouldLog) {
        return this.middleware()(req, res, next);
      }
      next();
    };
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
        userAgent: req.get("User-Agent") || "",
        user:
          req.usuario?.usuario ||
          req.body?.usuario ||
          req.body?.username ||
          "desconocido",
      };

      // Log del acceso inicial (opcional, podrías solo loggear al final)
      this.info("API", `ACCESO_${req.method}`, {
        ...logData,
        details: {
          path: req.originalUrl,
          method: req.method,
        },
      });

      // Interceptor de respuesta para loggear resultado final
      const originalJson = res.json;
      res.json = function (data) {
        const duration = Date.now() - startTime;

        logger.info("API", `RESPUESTA_${req.method}`, {
          ...logData,
          details: {
            path: req.originalUrl,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            response: res.statusCode >= 400 ? data : undefined, // Solo loggear error bodies
          },
        });

        return originalJson.call(this, data);
      };

      next();
    };
  }

  /**
   * Método específico para logging de autenticación
   */
  logAuth(action, data = {}) {
    this.info("AUTH", action, data);
  }

  /**
   * Método específico para logging de pacientes
   */
  logPaciente(action, data = {}) {
    this.info("PACIENTE", action, data);
  }

  /**
   * Método específico para logging de valoraciones
   */
  logValoracion(action, data = {}) {
    this.info("VALORACION", action, data);
  }

  /**
   * Método específico para logging de RIPS
   */
  logRIPS(action, data = {}) {
    this.info("RIPS", action, data);
  }
}

// Instancia global del logger
const logger = new Logger();

module.exports = logger;
