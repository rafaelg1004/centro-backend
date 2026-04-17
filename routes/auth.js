require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const logger = require("../utils/logger");
const { Usuario } = require("../models-sequelize");

const router = express.Router();

// Ruta de login
router.post("/login", async (req, res) => {
  const { email, usuario, password } = req.body;
  const clientIP =
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    "unknown";
  const userAgent = req.headers["user-agent"] || "unknown";

  try {
    let usuarioDoc = null;
    if (usuario) {
      usuarioDoc = await Usuario.findOne({ where: { username: usuario } });
    }
    if (!usuarioDoc && email) {
      usuarioDoc = await Usuario.findOne({ where: { email } });
    }

    if (!usuarioDoc) {
      logger.logAuth("LOGIN_FALLIDO", {
        user: usuario || email,
        ip: clientIP,
        userAgent,
        details: {
          mensaje: "Usuario no encontrado",
          tipoFallo: "usuario_no_existe",
        },
      });
      return res
        .status(401)
        .json({ error: "Usuario o contraseña incorrectos" });
    }

    // Verificar si el usuario está bloqueado
    if (usuarioDoc.bloqueado_hasta && usuarioDoc.bloqueado_hasta > new Date()) {
      const tiempoRestante = Math.ceil(
        (usuarioDoc.bloqueado_hasta - new Date()) / 1000 / 60,
      );
      logger.logAuth("LOGIN_BLOQUEADO", {
        user: usuarioDoc.username,
        ip: clientIP,
        userAgent,
        details: {
          mensaje: `Cuenta bloqueada - tiempo restante: ${tiempoRestante} minutos`,
          tiempoRestante,
        },
      });
      return res.status(429).json({
        error: `Cuenta bloqueada temporalmente. Intente nuevamente en ${tiempoRestante} minutos.`,
      });
    }

    const valido = await bcrypt.compare(password, usuarioDoc.password_hash);
    if (!valido) {
      // Incrementar intentos fallidos
      usuarioDoc.intentos_fallidos += 1;

      // Bloquear cuenta después de 5 intentos fallidos
      if (usuarioDoc.intentos_fallidos >= 5) {
        usuarioDoc.bloqueado_hasta = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
        usuarioDoc.intentos_fallidos = 0;
        await usuarioDoc.update({
          bloqueado_hasta: usuarioDoc.bloqueado_hasta,
          intentos_fallidos: usuarioDoc.intentos_fallidos,
        });
        logger.logAuth("CUENTA_BLOQUEADA", {
          user: usuarioDoc.username,
          ip: clientIP,
          userAgent,
          details: {
            mensaje: "Cuenta bloqueada por múltiples intentos fallidos",
            intentosFallidos: 5,
          },
        });
        return res.status(429).json({
          error:
            "Cuenta bloqueada por múltiples intentos fallidos. Intente nuevamente en 15 minutos.",
        });
      }

      await usuarioDoc.update({
        bloqueado_hasta: usuarioDoc.bloqueado_hasta,
        intentos_fallidos: usuarioDoc.intentos_fallidos,
      });
      logger.logAuth("LOGIN_FALLIDO", {
        user: usuarioDoc.username,
        ip: clientIP,
        userAgent,
        details: {
          mensaje: "Contraseña incorrecta",
          tipoFallo: "password_incorrecta",
          intentosFallidos: usuarioDoc.intentosFallidos,
        },
      });
      return res
        .status(401)
        .json({ error: "Usuario o contraseña incorrectos" });
    }

    // Resetear intentos fallidos en login exitoso
    usuarioDoc.intentos_fallidos = 0;
    usuarioDoc.ultimo_acceso = new Date();
    await usuarioDoc.save();

    logger.logAuth("LOGIN_EXITOSO", {
      user: usuarioDoc.username,
      ip: clientIP,
      userAgent,
      details: {
        mensaje: "Login exitoso - primera fase",
        rol: usuarioDoc.rol,
      },
    });

    // Verifica que el secreto JWT esté definido
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET no está definido");
      return res
        .status(500)
        .json({ error: "Configuración del servidor incompleta" });
    }

    const token = jwt.sign(
      {
        email: usuarioDoc.email,
        usuario: usuarioDoc.username,
        nombre: usuarioDoc.nombre,
        id: usuarioDoc.id,
        rol: usuarioDoc.rol,
        registroMedico: usuarioDoc.registro_medico,
        two_factor_enabled: usuarioDoc.two_factor_enabled,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" },
    );

    // Si 2FA está habilitado, requerir verificación adicional
    if (usuarioDoc.two_factor_enabled) {
      logger.logAuth("LOGIN_2FA_REQUERIDO", {
        user: usuarioDoc.username,
        ip: clientIP,
        userAgent,
        details: {
          mensaje: "2FA requerido para completar login",
          rol: usuarioDoc.rol,
        },
      });
      return res.json({
        token,
        nombre: usuarioDoc.nombre,
        rol: usuarioDoc.rol,
        requiere2FA: true,
        mensaje: "Se requiere verificación de dos factores",
      });
    }

    logger.logAuth("LOGIN_COMPLETADO", {
      user: usuarioDoc.username,
      ip: clientIP,
      userAgent,
      details: {
        mensaje: "Login completado sin 2FA",
        rol: usuarioDoc.rol,
      },
    });

    res.json({
      token,
      nombre: usuarioDoc.nombre,
      rol: usuarioDoc.rol,
      registroMedico: usuarioDoc.registro_medico,
      requiere2FA: false,
    });
  } catch (error) {
    console.error("Error en login:", error);
    logger.logAuth("LOGIN_ERROR", {
      user: usuario || email,
      ip: clientIP,
      userAgent,
      details: {
        mensaje: `Error en login: ${error.message}`,
        error: error.message,
      },
    });
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Ruta para registrar un usuario (solo para administración)
router.post("/register", async (req, res) => {
  const { email, usuario, password, nombre, rol, registroMedico } = req.body;
  if (!usuario && !email) {
    return res
      .status(400)
      .json({ error: "Debes ingresar un usuario o un correo electrónico" });
  }
  // Valida entradas antes de usarlas
  if (usuario && typeof usuario !== "string")
    return res.status(400).json({ error: "Usuario inválido" });
  if (email && typeof email !== "string")
    return res.status(400).json({ error: "Email inválido" });
  if (!["fisioterapeuta", "auxiliar", "administracion"].includes(rol)) {
    return res.status(400).json({
      error:
        "Rol inválido. Debe ser: fisioterapeuta, auxiliar o administracion",
    });
  }
  try {
    // Verifica que no exista ni el usuario ni el email
    if (usuario) {
      const existeUsuario = await Usuario.findOne({
        where: { username: usuario },
      });
      if (existeUsuario)
        return res.status(400).json({ error: "El usuario ya existe" });
    }
    if (email) {
      const existeEmail = await Usuario.findOne({ where: { email } });
      if (existeEmail)
        return res.status(400).json({ error: "El correo ya existe" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const usuarioNuevo = await Usuario.create({
      email,
      username: usuario,
      password_hash: passwordHash,
      nombre_completo: nombre,
      rol: rol || "auxiliar",
      registro_medico: registroMedico || "",
    });

    // Generar 2FA para el nuevo usuario
    const secret = speakeasy.generateSecret({
      name: `Centro Estimulación (${usuarioNuevo.nombre})`,
      issuer: "Centro Estimulación Perinatal",
    });
    usuarioNuevo.two_factor_secret = secret.base32;
    usuarioNuevo.two_factor_enabled = true;

    // Usuario ya creado con create()

    // Generar QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    res.json({
      mensaje: "Usuario registrado correctamente",
      usuario: {
        nombre: usuarioNuevo.nombre,
        rol: usuarioNuevo.rol,
        email: usuarioNuevo.email,
        usuario: usuarioNuevo.username,
      },
      twoFactorSetup: {
        enabled: true,
        secret: secret.base32,
        qrCode: qrCodeUrl,
        instrucciones:
          "Escanea el código QR con tu aplicación de autenticación (Google Authenticator, Authy, etc.) para configurar la autenticación de dos factores",
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Middleware para verificar autenticación y roles
const verificarToken = (rolesPermitidos = []) => {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const clientIP =
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    if (!token) {
      logger.logAuth("ACCESO_SIN_TOKEN", {
        user: "desconocido",
        ip: clientIP,
        userAgent,
        details: {
          mensaje: "Intento de acceso sin token de autenticación",
          endpoint: req.originalUrl,
          metodo: req.method,
        },
      });
      return res
        .status(401)
        .json({ error: "Token de autenticación requerido" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Verificar si el usuario tiene un rol permitido
      if (
        rolesPermitidos.length > 0 &&
        !rolesPermitidos.includes(decoded.rol)
      ) {
        logger.logAuth("ACCESO_DENEGADO", {
          user: decoded.username,
          ip: clientIP,
          userAgent,
          details: {
            mensaje: `Acceso denegado - rol insuficiente`,
            endpoint: req.originalUrl,
            metodo: req.method,
            rolUsuario: decoded.rol,
            rolesRequeridos: rolesPermitidos,
          },
        });
        return res.status(403).json({
          error:
            "Acceso denegado. No tienes permisos suficientes para esta acción.",
        });
      }

      logger.logAuth("ACCESO_PERMITIDO", {
        user: decoded.username,
        ip: clientIP,
        userAgent,
        details: {
          mensaje: "Acceso permitido a endpoint protegido",
          endpoint: req.originalUrl,
          metodo: req.method,
          rol: decoded.rol,
        },
      });

      req.usuario = decoded;
      next();
    } catch (error) {
      logger.logAuth("TOKEN_INVALIDO", {
        user: "desconocido",
        ip: clientIP,
        userAgent,
        details: {
          mensaje: `Token inválido: ${error.message}`,
          endpoint: req.originalUrl,
          metodo: req.method,
        },
      });
      return res.status(401).json({ error: "Token inválido o expirado" });
    }
  };
};

// Ruta para habilitar 2FA
router.post(
  "/enable-2fa",
  verificarToken(["administracion"]),
  async (req, res) => {
    try {
      const { userId } = req.body;
      const targetUserId = userId || req.usuario.id;
      const usuario = await Usuario.findByPk(targetUserId);
      if (!usuario) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      // Generar secreto TOTP
      const secret = speakeasy.generateSecret({
        name: `Centro Estimulación (${usuario.nombre_completo})`,
        issuer: "Centro Estimulación Perinatal",
      });

      usuario.two_factor_secret = secret.base32;
      usuario.two_factor_enabled = userId ? true : false; // Si es admin habilitando para otro, activar inmediatamente
      await usuario.save();

      // Generar QR code
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

      res.json({
        mensaje: "Configuración 2FA iniciada",
        secret: secret.base32,
        qrCode: qrCodeUrl,
        instrucciones:
          "Escanea el código QR con tu aplicación de autenticación (Google Authenticator, Authy, etc.)",
      });
    } catch (error) {
      console.error("Error habilitando 2FA:", error);
      res.status(500).json({ error: "Error en el servidor" });
    }
  },
);

// Ruta para verificar y activar 2FA
router.post(
  "/verify-2fa",
  verificarToken(["administracion"]),
  async (req, res) => {
    const { token: totpToken } = req.body;

    try {
      const usuario = await Usuario.findByPk(req.usuario.id);
      if (!usuario || !usuario.two_factor_secret) {
        return res.status(400).json({ error: "Configuración 2FA no iniciada" });
      }

      const verificado = speakeasy.totp.verify({
        secret: usuario.two_factor_secret,
        encoding: "base32",
        token: totpToken,
        window: 2, // Permitir 2 tokens de tolerancia
      });

      if (!verificado) {
        return res.status(400).json({ error: "Código 2FA inválido" });
      }

      usuario.two_factor_enabled = true;
      await usuario.save();

      res.json({
        mensaje: "Autenticación de dos factores habilitada correctamente",
      });
    } catch (error) {
      console.error("Error verificando 2FA:", error);
      res.status(500).json({ error: "Error en el servidor" });
    }
  },
);

// Ruta para verificar 2FA durante login
router.post("/verify-2fa-login", async (req, res) => {
  const { token: totpToken, tempToken } = req.body;
  const clientIP =
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    "unknown";
  const userAgent = req.headers["user-agent"] || "unknown";

  try {
    // Verificar el token temporal
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);

    const usuario = await Usuario.findByPk(decoded.id);
    if (!usuario || !usuario.two_factor_enabled || !usuario.two_factor_secret) {
      logger.logAuth("2FA_VERIFICACION_FALLIDA", {
        user: decoded.username,
        ip: clientIP,
        userAgent,
        details: {
          mensaje: "Configuración 2FA inválida",
          tipoFallo: "configuracion_invalida",
        },
      });
      return res.status(400).json({ error: "Configuración 2FA inválida" });
    }

    const verificado = speakeasy.totp.verify({
      secret: usuario.two_factor_secret,
      encoding: "base32",
      token: totpToken,
      window: 2,
    });

    if (!verificado) {
      logger.logAuth("2FA_VERIFICACION_FALLIDA", {
        user: usuario.username,
        ip: clientIP,
        userAgent,
        details: {
          mensaje: "Código 2FA inválido",
          tipoFallo: "codigo_invalido",
        },
      });
      return res.status(400).json({ error: "Código 2FA inválido" });
    }

    // Generar token final con acceso completo
    const token = jwt.sign(
      {
        email: usuario.email,
        usuario: usuario.username,
        nombre: usuario.nombre,
        id: usuario.id,
        rol: usuario.rol,
        registro_medico: usuario.registro_medico,
        two_factor_enabled: usuario.two_factor_enabled,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" },
    );

    logger.logAuth("LOGIN_COMPLETADO_2FA", {
      user: usuario.usuario,
      ip: clientIP,
      userAgent,
      details: {
        mensaje: "Login completado con 2FA",
        rol: usuario.rol,
      },
    });

    res.json({
      token,
      nombre: usuario.nombre,
      rol: usuario.rol,
      mensaje: "Autenticación completada",
    });
  } catch (error) {
    console.error("Error en verificación 2FA login:", error);
    logger.logAuth("2FA_VERIFICACION_ERROR", {
      user: "desconocido",
      ip: clientIP,
      userAgent,
      details: {
        mensaje: `Error en verificación 2FA: ${error.message}`,
        error: error.message,
      },
    });
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Ruta para deshabilitar 2FA
router.post(
  "/disable-2fa",
  verificarToken(["administracion"]),
  async (req, res) => {
    try {
      const usuario = await Usuario.findByPk(req.usuario.id);
      if (!usuario) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      usuario.two_factor_enabled = false;
      usuario.two_factor_secret = null;
      await usuario.save();

      res.json({ mensaje: "Autenticación de dos factores deshabilitada" });
    } catch (error) {
      console.error("Error deshabilitando 2FA:", error);
      res.status(500).json({ error: "Error en el servidor" });
    }
  },
);

// Ruta para obtener información del usuario actual
router.get("/me", verificarToken(), async (req, res) => {
  const clientIP =
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    "unknown";
  const userAgent = req.headers["user-agent"] || "unknown";

  try {
    const usuario = await Usuario.findByPk(req.usuario.id, {
      attributes: { exclude: ["password_hash", "two_factor_secret"] },
    });
    if (!usuario) {
      logger.logAuth("INFO_USUARIO_NO_ENCONTRADO", {
        user: req.usuario.usuario,
        ip: clientIP,
        userAgent,
        details: {
          mensaje: "Usuario no encontrado al obtener información",
        },
      });
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    logger.logAuth("INFO_USUARIO_CONSULTADA", {
      user: usuario.usuario,
      ip: clientIP,
      userAgent,
      details: {
        mensaje: "Información del usuario consultada",
        rol: usuario.rol,
      },
    });

    res.json({
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      usuario: usuario.usuario,
      rol: usuario.rol,
      registro_medico: usuario.registro_medico,
      firma_url: usuario.firma_url || null,
      two_factor_enabled: usuario.two_factor_enabled,
      ultimo_acceso: usuario.ultimo_acceso,
    });
  } catch (error) {
    console.error("Error obteniendo info usuario:", error);
    logger.logAuth("ERROR_INFO_USUARIO", {
      user: req.usuario.usuario,
      ip: clientIP,
      userAgent,
      details: {
        mensaje: `Error obteniendo info usuario: ${error.message}`,
        error: error.message,
      },
    });
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Ruta para obtener lista de usuarios (solo admin)
router.get("/users", verificarToken(["administracion"]), async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      attributes: { exclude: ["password_hash", "two_factor_secret"] },
    });
    res.json(usuarios);
  } catch (error) {
    console.error("Error obteniendo usuarios :", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Ruta para bloquear usuario
router.post(
  "/block-user/:id",
  verificarToken(["administracion"]),
  async (req, res) => {
    try {
      const usuario = await Usuario.findByPk(req.params.id);
      if (!usuario) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      usuario.bloqueado_hasta = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
      usuario.intentos_fallidos = 0;
      await usuario.save();
      res.json({ mensaje: "Usuario bloqueado por 15 minutos" });
    } catch (error) {
      console.error("Error bloqueando usuario:", error);
      res.status(500).json({ error: "Error en el servidor" });
    }
  },
);

// Ruta para desbloquear usuario
router.post(
  "/unblock-user/:id",
  verificarToken(["administracion"]),
  async (req, res) => {
    try {
      const usuario = await Usuario.findByPk(req.params.id);
      if (!usuario) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      usuario.bloqueado_hasta = null;
      await usuario.save();
      res.json({ mensaje: "Usuario desbloqueado" });
    } catch (error) {
      console.error("Error desbloqueando usuario:", error);
      res.status(500).json({ error: "Error en el servidor" });
    }
  },
);

// Ruta para deshabilitar 2FA de un usuario
router.post(
  "/disable-2fa/:id",
  verificarToken(["administracion"]),
  async (req, res) => {
    try {
      const usuario = await Usuario.findByPk(req.params.id);
      if (!usuario) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      usuario.two_factor_enabled = false;
      usuario.two_factor_secret = null;
      await usuario.save();
      res.json({ mensaje: "Autenticación de dos factores deshabilitada" });
    } catch (error) {
      console.error("Error deshabilitando 2FA:", error);
      res.status(500).json({ error: "Error en el servidor" });
    }
  },
);

// Ruta para cambiar contraseña de un usuario
router.post(
  "/change-password/:id",
  verificarToken(["administracion"]),
  async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }
    try {
      const usuario = await Usuario.findByPk(req.params.id);
      if (!usuario) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      const passwordHash = await bcrypt.hash(newPassword, 10);
      usuario.password_hash = passwordHash;
      await usuario.save();
      res.json({ mensaje: "Contraseña cambiada correctamente" });
    } catch (error) {
      console.error("Error cambiando contraseña:", error);
      res.status(500).json({ error: "Error en el servidor" });
    }
  },
);

// Actualizar perfil del usuario actual (nombre, registroMedico, firmaUrl)
router.put("/me", verificarToken(), async (req, res) => {
  try {
    const { nombre, registroMedico, firmaUrl } = req.body;
    const actualizacion = {};
    if (nombre !== undefined) actualizacion.nombre = nombre;
    if (registroMedico !== undefined)
      actualizacion.registroMedico = registroMedico;
    if (firmaUrl !== undefined) actualizacion.firmaUrl = firmaUrl;

    const usuario = await Usuario.findByPk(req.usuario.id);
    if (!usuario)
      return res.status(404).json({ error: "Usuario no encontrado" });
    await usuario.update(actualizacion);
    if (!usuario)
      return res.status(404).json({ error: "Usuario no encontrado" });

    res.json({
      id: usuario.id,
      nombre: usuario.nombre,
      registroMedico: usuario.registroMedico,
      firmaUrl: usuario.firmaUrl || null,
    });
  } catch (error) {
    console.error("Error actualizando perfil:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Exportar router y middleware
router.verificarToken = verificarToken;
router.Usuario = Usuario;
module.exports = router;
