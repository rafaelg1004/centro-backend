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
      "/api/auth/me",
      "/api/proxy-images",
      "/api/proxyImages",
      "/api/logs", // Evitar loggear la propia consulta de logs
    ];
    if (ignoredPaths.includes(cleanPath)) return true;
    if (
      cleanPath.startsWith("/api/system/") ||
      cleanPath.startsWith("/static/") ||
      cleanPath.endsWith(".png") ||
      cleanPath.endsWith(".ico")
    ) {
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
      method: data.method || data.details?.method || null,
      path: data.path || data.details?.path || null,
      body: data.body || data.details?.body || null,
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
   * Sanitiza y resume de forma segura la respuesta para que no sature la BD ni filtre secretos
   */
  sanitizeResponse(data) {
    if (data === undefined || data === null) return undefined;
    if (typeof data !== "object") return data;

    // Si es un array grande (ej: lista de 200 pacientes), guardar cantidad y muestra de los primeros
    if (Array.isArray(data)) {
      if (data.length > 5) {
        return {
          totalElementos: data.length,
          muestra: data.slice(0, 3).map((item) => this.sanitizeBody(item)),
        };
      }
      return data.map((item) => this.sanitizeBody(item));
    }

    // Si es un objeto, sanitizar campos sensibles y arrays internos grandes
    const sanitized = this.sanitizeBody(data);
    for (const key of Object.keys(sanitized)) {
      if (Array.isArray(sanitized[key]) && sanitized[key].length > 5) {
        sanitized[key] = {
          total: sanitized[key].length,
          muestra: sanitized[key].slice(0, 3).map((it) => this.sanitizeBody(it)),
        };
      }
    }

    return sanitized;
  }

  /**
   * Middleware de Auditoría - Registra operaciones importantes sin saturar con GETs repetitivos
   */
  auditMiddleware() {
    return (req, res, next) => {
      // Ignorar pings de health check, polling y assets estáticos
      if (this.isIgnoredPath(req.path) || this.isIgnoredPath(req.originalUrl)) {
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
        else if (pathLower.includes("/pagopaquete")) category = "PAGOS";
        else if (pathLower.includes("/configuracion")) category = "CONFIGURACION";

        const level = statusCode >= 500 ? "ERROR" : statusCode >= 400 ? "WARN" : "INFO";
        const action = req.method === "GET" ? `CONSULTAR_${category}` : `${req.method}_${category}`;

        // Extraer paciente ID si existe en params, query o body
        const pacienteCandidate =
          req.params?.id ||
          req.params?.pacienteId ||
          req.query?.pacienteId ||
          req.body?.paciente ||
          req.body?.pacienteId ||
          req.body?.paciente_id ||
          (category === "PACIENTE" && data?.id ? data.id : null);

        const sanitizedResponse = self.sanitizeResponse(data);

        self.log(level, category, action, {
          user: username,
          paciente: pacienteCandidate,
          valoracion: pathLower.includes("/valoraciones") ? req.params?.id : null,
          method: req.method,
          path: req.originalUrl,
          ip: req.ip || req.connection?.remoteAddress || "",
          userAgent: req.get("User-Agent") || "",
          details: {
            path: req.originalUrl,
            method: req.method,
            statusCode,
            duration: `${duration}ms`,
            params: Object.keys(req.query || {}).length > 0 ? req.query : undefined,
            body: sanitizedBody,
            response: sanitizedResponse,
          },
        });

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
