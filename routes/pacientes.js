const express = require("express");
const Paciente = require("../models/Paciente");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// FunciÃ³n para registrar logs de acceso a datos de pacientes
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

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logLine = JSON.stringify(logEntry) + '\n';

  try {
    fs.appendFileSync(logFile, logLine);
    console.log(`ðŸ“‹ LOG PACIENTE [${tipo}]: ${usuario || 'desconocido'} - Paciente: ${pacienteId} - ${detalles.accion || 'Sin acciÃ³n'}`);
  } catch (error) {
    console.error('â Œ Error escribiendo log de acceso a pacientes:', error);
  }
}

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

// --- RUTAS DE PACIENTE UNIFICADO ---

router.post("/", async (req, res) => {
  try {
    console.log("ðŸ“ Datos recibidos en el backend:", req.body);

    // Mapeo de compatibilidad para el frontend legacy
    const docNum = req.body.numDocumentoIdentificacion || req.body.registroCivil || req.body.cedula;
    const tipoDoc = req.body.tipoDocumentoIdentificacion || req.body.tipoDocumento || (req.body.cedula ? 'CC' : 'RC');

    if (!docNum) {
      return res.status(400).json({ error: "El nÃºmero de documento es obligatorio" });
    }

    const existe = await Paciente.findOne({ numDocumentoIdentificacion: docNum });
    if (existe) {
      return res.status(400).json({ error: "El paciente ya existe" });
    }

    // Preparar objeto para el nuevo modelo
    const data = {
      ...req.body,
      numDocumentoIdentificacion: docNum,
      tipoDocumentoIdentificacion: tipoDoc,
      // Si no vienen nombres/apellidos separados, intentar separar nombres
      nombres: req.body.nombres,
      apellidos: req.body.apellidos || (req.body.nombres ? '' : 'SIN APELLIDO')
    };

    // Mapear datos de contacto si vienen en formato plano (legacy)
    if (!data.datosContacto) {
      data.datosContacto = {
        direccion: req.body.direccion,
        telefono: req.body.telefono || req.body.celular,
        nombreAcompanante: req.body.acompanante || req.body.nombreMadre || req.body.nombrePadre,
        telefonoAcompanante: req.body.telefonoAcompanante
      };
    }

    const paciente = new Paciente(data);
    await paciente.save();
    res.json({ mensaje: "Paciente registrado correctamente", id: paciente._id });
  } catch (error) {
    console.error("â Œ Error al registrar paciente:", error);
    res.status(500).json({ error: "Error en el servidor", details: error.message });
  }
});

router.get("/", logAccesoMiddleware('LISTAR_PACIENTES'), async (req, res) => {
  try {
    const { tipo } = req.query;
    let query = {};

    if (tipo === 'nino') {
      query.tipoDocumentoIdentificacion = { $in: ['RC', 'TI', 'MS', 'AS', 'CD', 'CN', 'SC'] };
    } else if (tipo === 'adulto') {
      query.tipoDocumentoIdentificacion = { $in: ['CC', 'CE', 'PA', 'PE'] };
    }

    const pacientes = await Paciente.find(query)
      .select('nombres apellidos numDocumentoIdentificacion tipoDocumentoIdentificacion codSexo fechaNacimiento aseguradora datosContacto createdAt')
      .sort({ nombres: 1 });

    const mapiado = pacientes.map(p => {
      let edad = 0;
      if (p.fechaNacimiento) {
        const hoy = new Date();
        const nacimiento = new Date(p.fechaNacimiento);

        // Si es niño (RC/TI), calcular edad en meses para el frontend legacy
        const esNino = ['RC', 'TI', 'CN'].includes(p.tipoDocumentoIdentificacion);
        if (esNino) {
          edad = (hoy.getFullYear() - nacimiento.getFullYear()) * 12 + (hoy.getMonth() - nacimiento.getMonth());
        } else {
          // Si es adulto, edad en años
          edad = hoy.getFullYear() - nacimiento.getFullYear();
          if (hoy.getMonth() < nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())) {
            edad--;
          }
        }
      }

      return {
        ...p._doc,
        nombres: `${p.nombres || ''} ${p.apellidos || ''}`.trim(),
        registroCivil: p.numDocumentoIdentificacion, // Alias legacy
        cedula: p.numDocumentoIdentificacion, // Alias legacy
        genero: p.codSexo,
        edad: edad,
        celular: p.datosContacto?.telefono || p.datosContacto?.telefonoAcompanante || "N/A",
        nombreMadre: p.datosContacto?.nombreAcompanante || "N/A",
        nombrePadre: "N/A"
      };
    });

    res.json(mapiado);
  } catch (error) {
    console.error("Error en LISTAR_PACIENTES:", error);
    res.status(500).json({ error: "Error al obtener pacientes" });
  }
});

router.get("/buscar", logAccesoMiddleware('BUSCAR_PACIENTES'), async (req, res) => {
  const { q, tipo } = req.query;
  try {
    if (!q || q.trim() === "") {
      return res.json([]);
    }

    let query = {
      $or: [
        { nombres: { $regex: q, $options: "i" } },
        { apellidos: { $regex: q, $options: "i" } },
        { numDocumentoIdentificacion: { $regex: q, $options: "i" } }
      ]
    };

    if (tipo === 'nino') {
      query.tipoDocumentoIdentificacion = { $in: ['RC', 'TI', 'MS', 'AS', 'CD', 'CN', 'SC'] };
    } else if (tipo === 'adulto') {
      query.tipoDocumentoIdentificacion = { $in: ['CC', 'CE', 'PA', 'PE'] };
    }

    const pacientes = await Paciente.find(query).sort({ nombres: 1 }).limit(20);

    const mapiado = pacientes.map(p => {
      let edad = 0;
      if (p.fechaNacimiento) {
        const hoy = new Date();
        const nacimiento = new Date(p.fechaNacimiento);
        const esNino = ['RC', 'TI', 'CN'].includes(p.tipoDocumentoIdentificacion);
        if (esNino) {
          edad = (hoy.getFullYear() - nacimiento.getFullYear()) * 12 + (hoy.getMonth() - nacimiento.getMonth());
        } else {
          edad = hoy.getFullYear() - nacimiento.getFullYear();
          if (hoy.getMonth() < nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())) {
            edad--;
          }
        }
      }

      return {
        ...p._doc,
        nombres: `${p.nombres || ''} ${p.apellidos || ''}`.trim(),
        registroCivil: p.numDocumentoIdentificacion,
        cedula: p.numDocumentoIdentificacion,
        genero: p.codSexo,
        edad: edad,
        celular: p.datosContacto?.telefono || p.datosContacto?.telefonoAcompanante || "N/A"
      };
    });

    res.json(mapiado);
  } catch (e) {
    console.error("Error en /buscar:", e);
    res.json([]);
  }
});

router.get("/recientes", async (req, res) => {
  try {
    const pacientes = await Paciente.find().sort({ createdAt: -1 }).limit(10);
    res.json(pacientes);
  } catch (e) {
    res.status(500).json({ error: "Error al obtener pacientes recientes" });
  }
});

router.get("/:id", logAccesoMiddleware('CONSULTAR_PACIENTE'), async (req, res) => {
  try {
    const paciente = await Paciente.findById(req.params.id);
    if (!paciente) return res.status(404).json({ error: "No encontrado" });

    // Envolver en compatibilidad
    const data = {
      ...paciente._doc,
      registroCivil: paciente.numDocumentoIdentificacion,
      cedula: paciente.numDocumentoIdentificacion,
      genero: paciente.codSexo,
      direccion: paciente.datosContacto?.direccion,
      telefono: paciente.datosContacto?.telefono,
      acompanante: paciente.datosContacto?.nombreAcompanante
    };

    res.json(data);
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

router.put('/:id', logAccesoMiddleware('ACTUALIZAR_PACIENTE'), async (req, res) => {
  try {
    // Al actualizar, tambiÃ©n manejamos la estructura anidada si el frontend manda datos planos
    const updateData = { ...req.body };

    if (req.body.direccion || req.body.telefono || req.body.celular || req.body.acompanante) {
      updateData.datosContacto = {
        direccion: req.body.direccion || (updateData.datosContacto?.direccion),
        telefono: req.body.telefono || req.body.celular || (updateData.datosContacto?.telefono),
        nombreAcompanante: req.body.acompanante || (updateData.datosContacto?.nombreAcompanante),
        telefonoAcompanante: req.body.telefonoAcompanante || (updateData.datosContacto?.telefonoAcompanante)
      };
    }

    const actualizado = await Paciente.findByIdAndUpdate(
      req.params.id,
      updateData,
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