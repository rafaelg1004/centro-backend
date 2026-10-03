const rateLimit = require("express-rate-limit");

/**
 * Función auxiliar para formatear el tiempo restante de forma legible
 */
const calcularTiempoRestante = (req) => {
  const resetTime = req.rateLimit?.resetTime;
  const timeLeftMs = resetTime
    ? Math.max(0, resetTime.getTime() - Date.now())
    : 15 * 60 * 1000;
  const seconds = Math.ceil(timeLeftMs / 1000);
  const minutes = Math.ceil(seconds / 60);

  const tiempoTexto =
    minutes > 1
      ? `${minutes} minutos`
      : `${seconds} segundo${seconds === 1 ? "" : "s"}`;

  return {
    tiempoTexto,
    seconds,
    minutes,
    resetTime: resetTime ? resetTime.toISOString() : null,
  };
};

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
  handler: (req, res) => {
    const { tiempoTexto, seconds, minutes, resetTime } = calcularTiempoRestante(req);
    res.status(429).json({
      error: `Demasiadas peticiones desde esta IP. Por favor intente nuevamente en ${tiempoTexto}.`,
      tiempoRestanteSegundos: seconds,
      tiempoRestanteMinutos: minutes,
      resetTime,
    });
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
  handler: (req, res) => {
    const { tiempoTexto, seconds, minutes, resetTime } = calcularTiempoRestante(req);
    res.status(429).json({
      error: `Demasiados intentos de acceso desde esta IP. Por seguridad, intente nuevamente en ${tiempoTexto}.`,
      tiempoRestanteSegundos: seconds,
      tiempoRestanteMinutos: minutes,
      resetTime,
    });
  },
});

module.exports = {
  globalLimiter,
  authLimiter,
};
