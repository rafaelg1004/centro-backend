require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const logger = require('../utils/logger');

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
      logger.logAuth('LOGIN_FALLIDO', {
        user: usuario || email,
        ip: clientIP,
        userAgent,
        details: {
          mensaje: 'Usuario no encontrado',
          tipoFallo: 'usuario_no_existe'
        }
      });
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }

    // Verificar si el usuario está bloqueado
    if (usuarioDoc.bloqueadoHasta && usuarioDoc.bloqueadoHasta > new Date()) {
      const tiempoRestante = Math.ceil((usuarioDoc.bloqueadoHasta - new Date()) / 1000 / 60);
      logger.logAuth('LOGIN_BLOQUEADO', {
        user: usuarioDoc.usuario,
        ip: clientIP,
        userAgent,
        details: {
          mensaje: `Cuenta bloqueada - tiempo restante: ${tiempoRestante} minutos`,
          tiempoRestante
        }
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
        logger.logAuth('CUENTA_BLOQUEADA', {
          user: usuarioDoc.usuario,
          ip: clientIP,
          userAgent,
          details: {
            mensaje: 'Cuenta bloqueada por múltiples intentos fallidos',
            intentosFallidos: 5
          }
        });
        return res.status(429).json({
          error: "Cuenta bloqueada por múltiples intentos fallidos. Intente nuevamente en 15 minutos."
        });
      }

      await usuarioDoc.save();
      logger.logAuth('LOGIN_FALLIDO', {
        user: usuarioDoc.usuario,
        ip: clientIP,
        userAgent,
        details: {
          mensaje: 'Contraseña incorrecta',
          tipoFallo: 'password_incorrecta',
          intentosFallidos: usuarioDoc.intentosFallidos
        }
      });
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }

    // Resetear intentos fallidos en login exitoso
    usuarioDoc.intentosFallidos = 0;
    usuarioDoc.ultimoAcceso = new Date();
    await usuarioDoc.save();

    logger.logAuth('LOGIN_EXITOSO', {
      user: usuarioDoc.usuario,
      ip: clientIP,
      userAgent,
      details: {
        mensaje: 'Login exitoso - primera fase',
        rol: usuarioDoc.rol
      }
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
      logger.logAuth('LOGIN_2FA_REQUERIDO', {
        user: usuarioDoc.usuario,
        ip: clientIP,
        userAgent,
        details: {
          mensaje: '2FA requerido para completar login',
          rol: usuarioDoc.rol
        }
      });
      return res.json({
        token,
        nombre: usuarioDoc.nombre,
        rol: usuarioDoc.rol,
        requiere2FA: true,
        mensaje: "Se requiere verificación de dos factores"
      });
    }

    logger.logAuth('LOGIN_COMPLETADO', {
      user: usuarioDoc.usuario,
      ip: clientIP,
      userAgent,
      details: {
        mensaje: 'Login completado sin 2FA',
        rol: usuarioDoc.rol
      }
    });

    res.json({
      token,
      nombre: usuarioDoc.nombre,
      rol: usuarioDoc.rol,
      requiere2FA: false
    });
  } catch (error) {
    console.error("Error en login:", error);
    logger.logAuth('LOGIN_ERROR', {
      user: usuario || email,
      ip: clientIP,
      userAgent,
      details: {
        mensaje: `Error en login: ${error.message}`,
        error: error.message
      }
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
      logger.logAuth('ACCESO_SIN_TOKEN', {
        user: 'desconocido',
        ip: clientIP,
        userAgent,
        details: {
          mensaje: 'Intento de acceso sin token de autenticación',
          endpoint: req.originalUrl,
          metodo: req.method
        }
      });
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Verificar si el usuario tiene un rol permitido
      if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(decoded.rol)) {
        logger.logAuth('ACCESO_DENEGADO', {
          user: decoded.usuario,
          ip: clientIP,
          userAgent,
          details: {
            mensaje: `Acceso denegado - rol insuficiente`,
            endpoint: req.originalUrl,
            metodo: req.method,
            rolUsuario: decoded.rol,
            rolesRequeridos: rolesPermitidos
          }
        });
        return res.status(403).json({
          error: 'Acceso denegado. No tienes permisos suficientes para esta acción.'
        });
      }

      logger.logAuth('ACCESO_PERMITIDO', {
        user: decoded.usuario,
        ip: clientIP,
        userAgent,
        details: {
          mensaje: 'Acceso permitido a endpoint protegido',
          endpoint: req.originalUrl,
          metodo: req.method,
          rol: decoded.rol
        }
      });

      req.usuario = decoded;
      next();
    } catch (error) {
      logger.logAuth('TOKEN_INVALIDO', {
        user: 'desconocido',
        ip: clientIP,
        userAgent,
        details: {
          mensaje: `Token inválido: ${error.message}`,
          endpoint: req.originalUrl,
          metodo: req.method
        }
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
      logger.logAuth('2FA_VERIFICACION_FALLIDA', {
        user: decoded.usuario,
        ip: clientIP,
        userAgent,
        details: {
          mensaje: 'Configuración 2FA inválida',
          tipoFallo: 'configuracion_invalida'
        }
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
      logger.logAuth('2FA_VERIFICACION_FALLIDA', {
        user: usuario.usuario,
        ip: clientIP,
        userAgent,
        details: {
          mensaje: 'Código 2FA inválido',
          tipoFallo: 'codigo_invalido'
        }
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

    logger.logAuth('LOGIN_COMPLETADO_2FA', {
      user: usuario.usuario,
      ip: clientIP,
      userAgent,
      details: {
        mensaje: 'Login completado con 2FA',
        rol: usuario.rol
      }
    });

    res.json({
      token,
      nombre: usuario.nombre,
      rol: usuario.rol,
      mensaje: "Autenticación completada"
    });
  } catch (error) {
    console.error("Error en verificación 2FA login:", error);
    logger.logAuth('2FA_VERIFICACION_ERROR', {
      user: 'desconocido',
      ip: clientIP,
      userAgent,
      details: {
        mensaje: `Error en verificación 2FA: ${error.message}`,
        error: error.message
      }
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
      logger.logAuth('INFO_USUARIO_NO_ENCONTRADO', {
        user: req.usuario.usuario,
        ip: clientIP,
        userAgent,
        details: {
          mensaje: 'Usuario no encontrado al obtener información'
        }
      });
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    logger.logAuth('INFO_USUARIO_CONSULTADA', {
      user: usuario.usuario,
      ip: clientIP,
      userAgent,
      details: {
        mensaje: 'Información del usuario consultada',
        rol: usuario.rol
      }
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
    logger.logAuth('ERROR_INFO_USUARIO', {
      user: req.usuario.usuario,
      ip: clientIP,
      userAgent,
      details: {
        mensaje: `Error obteniendo info usuario: ${error.message}`,
        error: error.message
      }
    });
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Exportar middleware para usar en otras rutas
module.exports = router;