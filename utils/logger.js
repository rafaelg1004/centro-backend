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
   * Validador de formato UUID v4
   */
  isValidUUID(uuid) {
    if (!uuid || typeof uuid !== "string") return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
  }

  /**
   * Sanitiza el body de la petición para ocultar contraseñas y reducir payloads gigantes
   */
  sanitizeBody(body) {
    if (!body || typeof body !== "object") return body;
    const sanitized = Array.isArray(body) ? [...body] : { ...body };
    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token")
      ) {
        sanitized[key] = "***";
      } else if (
        typeof sanitized[key] === "string" &&
        sanitized[key].startsWith("data:image") &&
        sanitized[key].length > 100
      ) {
        sanitized[key] = "[BASE64_IMAGE_TRUNCATED]";
      }
    }
    return sanitized;
  }

  /**
   * Verifica si la ruta es un endpoint ruidoso de infraestructura/polling que no debe auditarse
   */
  isIgnoredPath(path) {
    if (!path) return false;
    const cleanPath = path.split("?")[0];
    const ignoredPaths = [
      "/",
      "/favicon.ico",
      "/manifest.json",
      "/api/health",
      "/api/system/health",
      "/api/system/metrics",
      "/api/proxy-images",
      "/api/proxyImages",
    ];
    if (ignoredPaths.includes(cleanPath)) return true;
    if (cleanPath.startsWith("/static/") || cleanPath.endsWith(".png") || cleanPath.endsWith(".ico")) {
      return true;
    }
    return false;
  }

  /**
   * Método principal de logging
   */
  async log(level, category, action, data = {}) {
    // Verificar si el nivel está habilitado
    if (this.levels[level] > this.levels[this.currentLevel]) {
      return;
    }

    const validPacienteId = this.isValidUUID(data.paciente)
      ? data.paciente
      : this.isValidUUID(data.paciente_id)
      ? data.paciente_id
      : null;

    const logData = {
      level: level || "INFO",
      category: category || "API",
      action: action || "ACCION",
      username: data.user || data.username || "desconocido",
      paciente_id: validPacienteId,
      valoracion_id: data.valoracion ? String(data.valoracion).substring(0, 100) : null,
      method: data.details?.method || data.method || null,
      path: data.details?.path || data.path || null,
      body: data.details?.body || data.body || null,
      details: data.details || {},
      ip: data.ip || "",
      user_agent: data.userAgent || data.user_agent || "",
    };

    // Formato para consola usando la hora local
    const consoleMessage = `[${new Date().toLocaleString()}] ${level} [${logData.category}]: ${action} - Usuario: ${logData.username} - Paciente: ${logData.paciente_id || data.paciente || "desconocido"}`;

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

    // Guardado en base de datos
    try {
      if (Log && typeof Log.createLog === "function") {
        await Log.createLog(logData);
      } else if (Log && typeof Log.create === "function") {
        await Log.create(logData);
      }
    } catch (dbError) {
      console.error("❌ Error guardando log en BD:", dbError.message);
    }
  }

  /**
   * Middleware de Auditoría - Registra operaciones importantes sin saturar con GETs repetitivos
   */
  auditMiddleware() {
    return (req, res, next) => {
      // Ignorar pings de health check y assets estáticos
      if (this.isIgnoredPath(req.path)) {
        return next();
      }

      const startTime = Date.now();
      const sanitizedBody = ["POST", "PUT", "PATCH"].includes(req.method)
        ? this.sanitizeBody(req.body)
        : undefined;

      // Interceptar res.json para registrar el resultado completo una sola vez
      const originalJson = res.json;
      const self = this;

      res.json = function (data) {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;

        // Determinar si esta petición debe guardarse en auditoría
        const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
        const isAuthAction =
          req.originalUrl.includes("/auth/login") ||
          req.originalUrl.includes("/auth/verify-2fa") ||
          req.originalUrl.includes("/auth/cambiar-password") ||
          req.originalUrl.includes("/auth/recuperar-password");
        const isError = statusCode >= 400;

        // Guardar si es modificación, evento de autenticación o error
        const shouldAudit = isMutation || isAuthAction || isError;

        if (shouldAudit) {
          // Extraer usuario autenticado o desde el body
          const username =
            req.usuario?.username ||
            req.usuario?.usuario ||
            req.body?.usuario ||
            req.body?.username ||
            "desconocido";

          // Determinar categoría según ruta
          let category = "API";
          const pathLower = req.originalUrl.toLowerCase();
          if (pathLower.includes("/pacientes")) category = "PACIENTE";
          else if (pathLower.includes("/valoraciones") || pathLower.includes("/consentimiento")) category = "VALORACION";
          else if (pathLower.includes("/auth")) category = "AUTH";
          else if (pathLower.includes("/clases")) category = "CLASE";
          else if (pathLower.includes("/rips")) category = "RIPS";
          else if (pathLower.includes("/sesiones")) category = "VALORACION";
          else if (pathLower.includes("/borradores")) category = "PACIENTE";

          const level = statusCode >= 500 ? "ERROR" : statusCode >= 400 ? "WARN" : "INFO";
          const action = `${req.method}_${category}`;

          // Extraer paciente ID si existe en params o body
          const pacienteCandidate =
            req.params?.id ||
            req.params?.pacienteId ||
            req.body?.paciente ||
            req.body?.pacienteId ||
            req.body?.paciente_id ||
            (category === "PACIENTE" && data?.id ? data.id : null);

          self.log(level, category, action, {
            user: username,
            paciente: pacienteCandidate,
            valoracion: pathLower.includes("/valoraciones") ? req.params?.id : null,
            ip: req.ip || req.connection?.remoteAddress || "",
            userAgent: req.get("User-Agent") || "",
            details: {
              path: req.originalUrl,
              method: req.method,
              statusCode,
              duration: `${duration}ms`,
              body: sanitizedBody,
              response: isError ? data : undefined,
            },
          });
        }

        return originalJson.call(this, data);
      };

      next();
    };
  }

  /**
   * Middleware para Express (alias de compatibilidad)
   */
  middleware() {
    return this.auditMiddleware();
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
