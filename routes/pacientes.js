const express = require("express");
const Paciente = require("../models/Paciente");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Función para registrar logs de acceso a datos de pacientes
function logAccesoPaciente(tipo, usuario, pacienteId, detalles = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    tipo,
    usuario: usuario || 'desconocido',
    pacienteId,
    ip: detalles.ip || 'N/A',
    userAgent: detalles.userAgent || 'N/A',
    ...detalles
  };

  const logFile = path.join(__dirname, '../logs/acceso-pacientes.log');
  const logDir = path.dirname(logFile);

  // Crear directorio si no existe
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logLine = JSON.stringify(logEntry) + '\n';

  try {
    fs.appendFileSync(logFile, logLine);
    console.log(`📋 LOG PACIENTE [${tipo}]: ${usuario || 'desconocido'} - Paciente: ${pacienteId} - ${detalles.accion || 'Sin acción'}`);
  } catch (error) {
    console.error('❌ Error escribiendo log de acceso a pacientes:', error);
  }
}

// Middleware para logging de acceso a pacientes
const logAccesoMiddleware = (accion) => {
  return (req, res, next) => {
    const usuario = req.usuario?.usuario || 'desconocido';
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const pacienteId = req.params.id || 'multiple';

    logAccesoPaciente('ACCESO_PACIENTE', usuario, pacienteId, {
      ip: clientIP,
      userAgent,
      accion,
      metodo: req.method,
      endpoint: req.originalUrl
    });

    next();
  };
};

router.post("/", async (req, res) => {
  try {
    console.log("Datos recibidos en el backend:", req.body); // <-- AQUÍ
    const existe = await Paciente.findOne({ registroCivil: req.body.registroCivil });
    if (existe) {
      return res.status(400).json({ error: "El paciente ya existe" });
    }
     const paciente = new Paciente(req.body);
    await paciente.save();
    res.json({ mensaje: "Paciente registrado correctamente" });
  } catch (error) {
    console.error("Error al registrar paciente:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});
router.get("/", logAccesoMiddleware('LISTAR_PACIENTES'), async (req, res) => {
  try {
    const pacientes = await Paciente.find().sort({ nombres: 1 });
    res.json(pacientes);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener pacientes" });
  }
});

router.get("/buscar", logAccesoMiddleware('BUSCAR_PACIENTES'), async (req, res) => {
  const { q } = req.query; // Usamos "q" como parámetro de búsqueda general
  try {
    if (!q || q.trim() === "") {
      return res.json([]);
    }
    const pacientes = await Paciente.find({
      $or: [
        { nombres: { $regex: q, $options: "i" } },
        { registroCivil: { $regex: q, $options: "i" } },
        { cedula: { $regex: q, $options: "i" } }
      ]
    }).sort({ nombres: 1 }).limit(20);
    res.json(pacientes);
  } catch (e) {
    console.error("Error en /buscar:", e);
    res.json([]);
  }
});

router.get("/recientes", async (req, res) => {
  try {
    const pacientes = await Paciente.find().sort({ _id: -1 }).limit(10);
    res.json(pacientes);
  } catch (e) {
    res.status(500).json({ error: "Error al obtener pacientes recientes" });
  }
});

// ¡AHORA la ruta con parámetro va al final!
router.get("/:id", logAccesoMiddleware('CONSULTAR_PACIENTE'), async (req, res) => {
  try {
    const paciente = await Paciente.findById(req.params.id);
    if (!paciente) return res.status(404).json({ error: "No encontrado" });
    res.json(paciente);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener paciente" });
  }
});
router.delete("/:id", logAccesoMiddleware('ELIMINAR_PACIENTE'), async (req, res) => {
  try {
    await Paciente.findByIdAndDelete(req.params.id);
    res.json({ mensaje: "Paciente eliminado correctamente" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Actualizar paciente por ID
router.put('/:id', logAccesoMiddleware('ACTUALIZAR_PACIENTE'), async (req, res) => {
  try {
    const actualizado = await Paciente.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!actualizado) {
      return res.status(404).json({ mensaje: 'Paciente no encontrado' });
    }
    res.json({ mensaje: 'Paciente actualizado correctamente', paciente: actualizado });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar paciente', error });
  }
});

module.exports = router;