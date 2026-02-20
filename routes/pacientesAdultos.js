const express = require("express");
const PacienteAdulto = require("../models/PacienteAdulto");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Función para registrar logs de acceso a datos de pacientes adultos
function logAccesoPacienteAdulto(tipo, usuario, pacienteId, detalles = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    tipo,
    usuario: usuario || 'desconocido',
    pacienteId,
    ip: detalles.ip || 'N/A',
    userAgent: detalles.userAgent || 'N/A',
    ...detalles
  };

  const logFile = path.join(__dirname, '../logs/acceso-pacientes-adultos.log');
  const logDir = path.dirname(logFile);

  // Crear directorio si no existe
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logLine = JSON.stringify(logEntry) + '\n';

  try {
    fs.appendFileSync(logFile, logLine);
    console.log(`📋 LOG PACIENTE ADULTO [${tipo}]: ${usuario || 'desconocido'} - Paciente: ${pacienteId} - ${detalles.accion || 'Sin acción'}`);
  } catch (error) {
    console.error('❌ Error escribiendo log de acceso a pacientes adultos:', error);
  }
}

// Middleware para logging de acceso a pacientes adultos
const logAccesoAdultoMiddleware = (accion) => {
  return (req, res, next) => {
    const usuario = req.usuario?.usuario || 'desconocido';
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const pacienteId = req.params.id || 'multiple';

    logAccesoPacienteAdulto('ACCESO_PACIENTE_ADULTO', usuario, pacienteId, {
      ip: clientIP,
      userAgent,
      accion,
      metodo: req.method,
      endpoint: req.originalUrl
    });

    next();
  };
};

// Registrar paciente adulto
router.post("/", async (req, res) => {
  try {
    console.log("📝 Datos recibidos para registro:", req.body);

    const existe = await PacienteAdulto.findOne({ cedula: req.body.cedula });
    if (existe) {
      return res.status(400).json({ error: "El paciente adulto ya existe" });
    }

    // Validar que el estadoEmbarazo sea válido
    if (req.body.estadoEmbarazo && !['gestacion', 'posparto'].includes(req.body.estadoEmbarazo)) {
      return res.status(400).json({ error: "Estado de embarazo inválido" });
    }

    const paciente = new PacienteAdulto(req.body);
    await paciente.save();

    console.log("✅ Paciente adulto registrado:", paciente._id);
    res.json({ mensaje: "Paciente adulto registrado correctamente" });
  } catch (error) {
    console.error("❌ Error al registrar paciente adulto:", error);
    res.status(500).json({ error: "Error al registrar paciente adulto", details: error.message });
  }
});

// Obtener todos los pacientes adultos
router.get("/", logAccesoAdultoMiddleware('LISTAR_PACIENTES_ADULTOS'), async (req, res) => {
  try {
    const pacientes = await PacienteAdulto.find()
      .select('nombres cedula genero edad estadoEmbarazo aseguradora')
      .sort({ nombres: 1 });
    res.json(pacientes);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener pacientes adultos" });
  }
});

// Buscar pacientes adultos por nombre o cédula
router.get("/buscar", logAccesoAdultoMiddleware('BUSCAR_PACIENTES_ADULTOS'), async (req, res) => {
  try {
    const q = req.query.q || "";
    console.log("Buscando adultos con:", q);
    const pacientes = await PacienteAdulto.find({
      $or: [
        { nombres: { $regex: q, $options: "i" } },
        { cedula: { $regex: q, $options: "i" } }
      ]
    });
    res.json(pacientes);
  } catch (error) {
    console.error("Error en /buscar adultos:", error);
    res.status(500).json({ error: "Error al buscar pacientes adultos" });
  }
});

// Obtener paciente adulto por ID
router.get("/:id", logAccesoAdultoMiddleware('CONSULTAR_PACIENTE_ADULTO'), async (req, res) => {
  try {
    const paciente = await PacienteAdulto.findById(req.params.id);
    if (!paciente) return res.status(404).json({ error: "No encontrado" });
    res.json(paciente);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener paciente adulto" });
  }
});

// Actualizar paciente adulto por ID
router.put("/:id", logAccesoAdultoMiddleware('ACTUALIZAR_PACIENTE_ADULTO'), async (req, res) => {
  try {
    console.log("📝 Datos recibidos para actualización:", req.body);

    // Validar que el estadoEmbarazo sea válido si está presente
    if (req.body.estadoEmbarazo && !['gestacion', 'posparto'].includes(req.body.estadoEmbarazo)) {
      return res.status(400).json({ error: "Estado de embarazo inválido" });
    }

    const actualizado = await PacienteAdulto.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!actualizado) {
      return res.status(404).json({ mensaje: "Paciente adulto no encontrado" });
    }

    console.log("✅ Paciente adulto actualizado:", actualizado._id);
    res.json({ mensaje: "Paciente adulto actualizado correctamente", paciente: actualizado });
  } catch (error) {
    console.error("❌ Error al actualizar paciente adulto:", error);
    res.status(500).json({ mensaje: "Error al actualizar paciente adulto", error: error.message });
  }
});

// Eliminar paciente adulto por ID
router.delete("/:id", logAccesoAdultoMiddleware('ELIMINAR_PACIENTE_ADULTO'), async (req, res) => {
  try {
    await PacienteAdulto.findByIdAndDelete(req.params.id);
    res.json({ mensaje: "Paciente adulto eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;