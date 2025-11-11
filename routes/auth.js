require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const fs = require("fs");
const path = require("path");

// Función para registrar logs de seguridad
function logSeguridad(tipo, usuario, detalles = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    tipo,
    usuario: usuario || 'desconocido',
    ip: detalles.ip || 'N/A',
    userAgent: detalles.userAgent || 'N/A',
    ...detalles
  };

  const logFile = path.join(__dirname, '../logs/seguridad.log');
  const logDir = path.dirname(logFile);

  // Crear directorio si no existe
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logLine = JSON.stringify(logEntry) + '\n';

  try {
    fs.appendFileSync(logFile, logLine);
    console.log(`🔐 LOG [${tipo}]: ${usuario || 'desconocido'} - ${detalles.mensaje || 'Sin mensaje'}`);
  } catch (error) {
    console.error('❌ Error escribiendo log de seguridad:', error);
  }
}

const router = express.Router();

// Esquema y modelo de usuario
const usuarioSchema = new mongoose.Schema({
  email: { type: String, unique: true, sparse: true }, // Opcional
  usuario: { type: String, unique: true, sparse: true }, // Opcional
  passwordHash: { type: String, required: true },
  nombre: { type: String, required: true },
  rol: {
    type: String,
    enum: ['fisioterapeuta', 'auxiliar', 'administracion'],
    default: 'auxiliar'
  },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: null },
  ultimoAcceso: { type: Date, default: null },
  intentosFallidos: { type: Number, default: 0 },
  bloqueadoHasta: { type: Date, default: null }
});
const Usuario = mongoose.model("Usuario", usuarioSchema);

// Ruta de login
router.post("/login", async (req, res) => {
  const { email, usuario, password } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    let usuarioDoc = null;
    if (usuario) {
      usuarioDoc = await Usuario.findOne({ usuario });
    }
    if (!usuarioDoc && email) {
      usuarioDoc = await Usuario.findOne({ email });
    }

    if (!usuarioDoc) {
      logSeguridad('LOGIN_FALLIDO', usuario || email, {
        ip: clientIP,
        userAgent,
        mensaje: 'Usuario no encontrado',
        tipoFallo: 'usuario_no_existe'
      });
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }

    // Verificar si el usuario está bloqueado
    if (usuarioDoc.bloqueadoHasta && usuarioDoc.bloqueadoHasta > new Date()) {
      const tiempoRestante = Math.ceil((usuarioDoc.bloqueadoHasta - new Date()) / 1000 / 60);
      logSeguridad('LOGIN_BLOQUEADO', usuarioDoc.usuario, {
        ip: clientIP,
        userAgent,
        mensaje: `Cuenta bloqueada - tiempo restante: ${tiempoRestante} minutos`,
        tiempoRestante
      });
      return res.status(429).json({
        error: `Cuenta bloqueada temporalmente. Intente nuevamente en ${tiempoRestante} minutos.`
      });
    }

    const valido = await bcrypt.compare(password, usuarioDoc.passwordHash);
    if (!valido) {
      // Incrementar intentos fallidos
      usuarioDoc.intentosFallidos += 1;

      // Bloquear cuenta después de 5 intentos fallidos
      if (usuarioDoc.intentosFallidos >= 5) {
        usuarioDoc.bloqueadoHasta = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
        usuarioDoc.intentosFallidos = 0;
        await usuarioDoc.save();
        logSeguridad('CUENTA_BLOQUEADA', usuarioDoc.usuario, {
          ip: clientIP,
          userAgent,
          mensaje: 'Cuenta bloqueada por múltiples intentos fallidos',
          intentosFallidos: 5
        });
        return res.status(429).json({
          error: "Cuenta bloqueada por múltiples intentos fallidos. Intente nuevamente en 15 minutos."
        });
      }

      await usuarioDoc.save();
      logSeguridad('LOGIN_FALLIDO', usuarioDoc.usuario, {
        ip: clientIP,
        userAgent,
        mensaje: 'Contraseña incorrecta',
        tipoFallo: 'password_incorrecta',
        intentosFallidos: usuarioDoc.intentosFallidos
      });
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }

    // Resetear intentos fallidos en login exitoso
    usuarioDoc.intentosFallidos = 0;
    usuarioDoc.ultimoAcceso = new Date();
    await usuarioDoc.save();

    logSeguridad('LOGIN_EXITOSO', usuarioDoc.usuario, {
      ip: clientIP,
      userAgent,
      mensaje: 'Login exitoso - primera fase',
      rol: usuarioDoc.rol
    });

    // Verifica que el secreto JWT esté definido
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET no está definido");
      return res.status(500).json({ error: "Configuración del servidor incompleta" });
    }

    const token = jwt.sign(
      {
        email: usuarioDoc.email,
        usuario: usuarioDoc.usuario,
        nombre: usuarioDoc.nombre,
        id: usuarioDoc._id,
        rol: usuarioDoc.rol,
        twoFactorEnabled: usuarioDoc.twoFactorEnabled
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    // Si 2FA está habilitado, requerir verificación adicional
    if (usuarioDoc.twoFactorEnabled) {
      logSeguridad('LOGIN_2FA_REQUERIDO', usuarioDoc.usuario, {
        ip: clientIP,
        userAgent,
        mensaje: '2FA requerido para completar login',
        rol: usuarioDoc.rol
      });
      return res.json({
        token,
        nombre: usuarioDoc.nombre,
        rol: usuarioDoc.rol,
        requiere2FA: true,
        mensaje: "Se requiere verificación de dos factores"
      });
    }

    logSeguridad('LOGIN_COMPLETADO', usuarioDoc.usuario, {
      ip: clientIP,
      userAgent,
      mensaje: 'Login completado sin 2FA',
      rol: usuarioDoc.rol
    });

    res.json({
      token,
      nombre: usuarioDoc.nombre,
      rol: usuarioDoc.rol,
      requiere2FA: false
    });
  } catch (error) {
    console.error("Error en login:", error);
    logSeguridad('LOGIN_ERROR', usuario || email, {
      ip: clientIP,
      userAgent,
      mensaje: `Error en login: ${error.message}`,
      error: error.message
    });
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Ruta para registrar un usuario (solo para administración)
router.post("/register", async (req, res) => {
  const { email, usuario, password, nombre, rol } = req.body;
  if (!usuario && !email) {
    return res.status(400).json({ error: "Debes ingresar un usuario o un correo electrónico" });
  }
  // Valida entradas antes de usarlas
  if (usuario && typeof usuario !== "string") return res.status(400).json({ error: "Usuario inválido" });
  if (email && typeof email !== "string") return res.status(400).json({ error: "Email inválido" });
  if (!['fisioterapeuta', 'auxiliar', 'administracion'].includes(rol)) {
    return res.status(400).json({ error: "Rol inválido. Debe ser: fisioterapeuta, auxiliar o administracion" });
  }
  try {
    // Verifica que no exista ni el usuario ni el email
    if (usuario) {
      const existeUsuario = await Usuario.findOne({ usuario });
      if (existeUsuario) return res.status(400).json({ error: "El usuario ya existe" });
    }
    if (email) {
      const existeEmail = await Usuario.findOne({ email });
      if (existeEmail) return res.status(400).json({ error: "El correo ya existe" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const usuarioNuevo = new Usuario({
      email,
      usuario,
      passwordHash,
      nombre,
      rol: rol || 'auxiliar'
    });
    await usuarioNuevo.save();
    res.json({
      mensaje: "Usuario registrado correctamente",
      usuario: {
        nombre: usuarioNuevo.nombre,
        rol: usuarioNuevo.rol,
        email: usuarioNuevo.email,
        usuario: usuarioNuevo.usuario
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Middleware para verificar autenticación y roles
const verificarToken = (rolesPermitidos = []) => {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!token) {
      logSeguridad('ACCESO_SIN_TOKEN', 'desconocido', {
        ip: clientIP,
        userAgent,
        mensaje: 'Intento de acceso sin token de autenticación',
        endpoint: req.originalUrl,
        metodo: req.method
      });
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Verificar si el usuario tiene un rol permitido
      if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(decoded.rol)) {
        logSeguridad('ACCESO_DENEGADO', decoded.usuario, {
          ip: clientIP,
          userAgent,
          mensaje: `Acceso denegado - rol insuficiente`,
          endpoint: req.originalUrl,
          metodo: req.method,
          rolUsuario: decoded.rol,
          rolesRequeridos: rolesPermitidos
        });
        return res.status(403).json({
          error: 'Acceso denegado. No tienes permisos suficientes para esta acción.'
        });
      }

      logSeguridad('ACCESO_PERMITIDO', decoded.usuario, {
        ip: clientIP,
        userAgent,
        mensaje: 'Acceso permitido a endpoint protegido',
        endpoint: req.originalUrl,
        metodo: req.method,
        rol: decoded.rol
      });

      req.usuario = decoded;
      next();
    } catch (error) {
      logSeguridad('TOKEN_INVALIDO', 'desconocido', {
        ip: clientIP,
        userAgent,
        mensaje: `Token inválido: ${error.message}`,
        endpoint: req.originalUrl,
        metodo: req.method
      });
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
  };
};

// Ruta para habilitar 2FA
router.post("/enable-2fa", verificarToken(['administracion']), async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario.id);
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Generar secreto TOTP
    const secret = speakeasy.generateSecret({
      name: `Centro Estimulación (${usuario.nombre})`,
      issuer: 'Centro Estimulación Perinatal'
    });

    usuario.twoFactorSecret = secret.base32;
    usuario.twoFactorEnabled = false; // Se habilita después de verificar
    await usuario.save();

    // Generar QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    res.json({
      mensaje: "Configuración 2FA iniciada",
      secret: secret.base32,
      qrCode: qrCodeUrl,
      instrucciones: "Escanea el código QR con tu aplicación de autenticación (Google Authenticator, Authy, etc.)"
    });
  } catch (error) {
    console.error("Error habilitando 2FA:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Ruta para verificar y activar 2FA
router.post("/verify-2fa", verificarToken(['administracion']), async (req, res) => {
  const { token: totpToken } = req.body;

  try {
    const usuario = await Usuario.findById(req.usuario.id);
    if (!usuario || !usuario.twoFactorSecret) {
      return res.status(400).json({ error: "Configuración 2FA no iniciada" });
    }

    const verificado = speakeasy.totp.verify({
      secret: usuario.twoFactorSecret,
      encoding: 'base32',
      token: totpToken,
      window: 2 // Permitir 2 tokens de tolerancia
    });

    if (!verificado) {
      return res.status(400).json({ error: "Código 2FA inválido" });
    }

    usuario.twoFactorEnabled = true;
    await usuario.save();

    res.json({ mensaje: "Autenticación de dos factores habilitada correctamente" });
  } catch (error) {
    console.error("Error verificando 2FA:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Ruta para verificar 2FA durante login
router.post("/verify-2fa-login", async (req, res) => {
  const { token: totpToken, tempToken } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    // Verificar el token temporal
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);

    const usuario = await Usuario.findById(decoded.id);
    if (!usuario || !usuario.twoFactorEnabled || !usuario.twoFactorSecret) {
      logSeguridad('2FA_VERIFICACION_FALLIDA', decoded.usuario, {
        ip: clientIP,
        userAgent,
        mensaje: 'Configuración 2FA inválida',
        tipoFallo: 'configuracion_invalida'
      });
      return res.status(400).json({ error: "Configuración 2FA inválida" });
    }

    const verificado = speakeasy.totp.verify({
      secret: usuario.twoFactorSecret,
      encoding: 'base32',
      token: totpToken,
      window: 2
    });

    if (!verificado) {
      logSeguridad('2FA_VERIFICACION_FALLIDA', usuario.usuario, {
        ip: clientIP,
        userAgent,
        mensaje: 'Código 2FA inválido',
        tipoFallo: 'codigo_invalido'
      });
      return res.status(400).json({ error: "Código 2FA inválido" });
    }

    // Generar token final con acceso completo
    const token = jwt.sign(
      {
        email: usuario.email,
        usuario: usuario.usuario,
        nombre: usuario.nombre,
        id: usuario._id,
        rol: usuario.rol,
        twoFactorEnabled: usuario.twoFactorEnabled
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    logSeguridad('LOGIN_COMPLETADO_2FA', usuario.usuario, {
      ip: clientIP,
      userAgent,
      mensaje: 'Login completado con 2FA',
      rol: usuario.rol
    });

    res.json({
      token,
      nombre: usuario.nombre,
      rol: usuario.rol,
      mensaje: "Autenticación completada"
    });
  } catch (error) {
    console.error("Error en verificación 2FA login:", error);
    logSeguridad('2FA_VERIFICACION_ERROR', 'desconocido', {
      ip: clientIP,
      userAgent,
      mensaje: `Error en verificación 2FA: ${error.message}`,
      error: error.message
    });
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Ruta para deshabilitar 2FA
router.post("/disable-2fa", verificarToken(['administracion']), async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario.id);
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    usuario.twoFactorEnabled = false;
    usuario.twoFactorSecret = null;
    await usuario.save();

    res.json({ mensaje: "Autenticación de dos factores deshabilitada" });
  } catch (error) {
    console.error("Error deshabilitando 2FA:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Ruta para obtener información del usuario actual
router.get("/me", verificarToken(), async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    const usuario = await Usuario.findById(req.usuario.id).select('-passwordHash -twoFactorSecret');
    if (!usuario) {
      logSeguridad('INFO_USUARIO_NO_ENCONTRADO', req.usuario.usuario, {
        ip: clientIP,
        userAgent,
        mensaje: 'Usuario no encontrado al obtener información'
      });
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    logSeguridad('INFO_USUARIO_CONSULTADA', usuario.usuario, {
      ip: clientIP,
      userAgent,
      mensaje: 'Información del usuario consultada',
      rol: usuario.rol
    });

    res.json({
      id: usuario._id,
      nombre: usuario.nombre,
      email: usuario.email,
      usuario: usuario.usuario,
      rol: usuario.rol,
      twoFactorEnabled: usuario.twoFactorEnabled,
      ultimoAcceso: usuario.ultimoAcceso
    });
  } catch (error) {
    console.error("Error obteniendo info usuario:", error);
    logSeguridad('ERROR_INFO_USUARIO', req.usuario.usuario, {
      ip: clientIP,
      userAgent,
      mensaje: `Error obteniendo info usuario: ${error.message}`,
      error: error.message
    });
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Exportar middleware para usar en otras rutas
module.exports = router;