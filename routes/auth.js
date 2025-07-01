require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const router = express.Router();

// Esquema y modelo de usuario
const usuarioSchema = new mongoose.Schema({
  email: { type: String, unique: true, sparse: true }, // Opcional
  usuario: { type: String, unique: true, sparse: true }, // Opcional
  passwordHash: { type: String, required: true },
  nombre: { type: String, required: true }
});
const Usuario = mongoose.model("Usuario", usuarioSchema);

// Ruta de login
router.post("/login", async (req, res) => {
  const { email, usuario, password } = req.body;
  try {
    let usuarioDoc = null;
    if (usuario) {
      usuarioDoc = await Usuario.findOne({ usuario });
    }
    if (!usuarioDoc && email) {
      usuarioDoc = await Usuario.findOne({ email });
    }
    if (!usuarioDoc) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }
    const valido = await bcrypt.compare(password, usuarioDoc.passwordHash);
    if (!valido) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }
    // Verifica que el secreto JWT esté definido
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET no está definido");
      return res.status(500).json({ error: "Configuración del servidor incompleta" });
    }
    const token = jwt.sign(
      { email: usuarioDoc.email, usuario: usuarioDoc.usuario, nombre: usuarioDoc.nombre, id: usuarioDoc._id },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );
    res.json({ token, nombre: usuarioDoc.nombre });
  } catch (error) {
    console.error("Error en login:", error); // <--- Agrega este log
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Ruta para registrar un usuario (solo para pruebas, puedes eliminarla en producción)
router.post("/register", async (req, res) => {
  const { email, usuario, password, nombre } = req.body;
  if (!usuario && !email) {
    return res.status(400).json({ error: "Debes ingresar un usuario o un correo electrónico" });
  }
  // Valida entradas antes de usarlas
  if (usuario && typeof usuario !== "string") return res.status(400).json({ error: "Usuario inválido" });
  if (email && typeof email !== "string") return res.status(400).json({ error: "Email inválido" });
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
    const usuarioNuevo = new Usuario({ email, usuario, passwordHash, nombre });
    await usuarioNuevo.save();
    res.json({ mensaje: "Usuario registrado correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

module.exports = router;