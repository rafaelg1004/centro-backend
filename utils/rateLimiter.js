const rateLimit = require("express-rate-limit");

/**
 * Limitador global para la API (/api/*)
 * Previene ataques DoS y abuso generalizado de peticiones.
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500, // Máximo 500 peticiones por ventana de 15 min por IP
  standardHeaders: true, // Cabeceras estándar RFC `RateLimit-*`
  legacyHeaders: false, // Desactivar cabeceras obsoletas `X-RateLimit-*`
  skip: (req) => {
    // Ignorar endpoints de health check para monitoreo y pings
    const path = req.originalUrl || req.url;
    return path.includes("/health") || path.includes("/system/health");
  },
  message: {
    error: "Demasiadas peticiones desde esta IP. Por favor intente nuevamente más tarde.",
    retryAfterMinutes: 15,
  },
});

/**
 * Limitador estricto para autenticación e inicio de sesión (/api/auth/login, etc.)
 * Previene ataques de fuerza bruta y adivinación de contraseñas.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Máximo 10 intentos de autenticación por IP cada 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos de acceso desde esta IP. Por seguridad, intente en 15 minutos.",
    retryAfterMinutes: 15,
  },
});

module.exports = {
  globalLimiter,
  authLimiter,
};
