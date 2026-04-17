const express = require("express");
const { Paciente } = require("../models-sequelize");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// FunciÃ³n para registrar logs de acceso a datos de pacientes
function logAccesoPaciente(tipo, usuario, pacienteId, detalles = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    tipo,
    usuario: usuario || "desconocido",
    pacienteId,
    ip: detalles.ip || "N/A",
    userAgent: detalles.userAgent || "N/A",
    ...detalles,
  };

  const logFile = path.join(__dirname, "../logs/acceso-pacientes.log");
  const logDir = path.dirname(logFile);

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logLine = JSON.stringify(logEntry) + "\n";

  try {
    fs.appendFileSync(logFile, logLine);
    console.log(
      `ðŸ“‹ LOG PACIENTE [${tipo}]: ${usuario || "desconocido"} - Paciente: ${pacienteId} - ${detalles.accion || "Sin acciÃ³n"}`,
    );
  } catch (error) {
    console.error("â Œ Error escribiendo log de acceso a pacientes:", error);
  }
}

const logAccesoMiddleware = (accion) => {
  return (req, res, next) => {
    const usuario = req.usuario?.username || "desconocido";
    const clientIP =
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    const pacienteId = req.params.id || "multiple";

    logAccesoPaciente("ACCESO_PACIENTE", usuario, pacienteId, {
      ip: clientIP,
      userAgent,
      accion,
      metodo: req.method,
      endpoint: req.originalUrl,
    });

    next();
  };
};

// --- RUTAS DE PACIENTE UNIFICADO ---

router.post("/", async (req, res) => {
  try {
    console.log("ðŸ“ Datos recibidos en el backend:", req.body);

    // Mapeo de compatibilidad para el frontend legacy
    const docNum =
      req.body.numDocumentoIdentificacion ||
      req.body.registroCivil ||
      req.body.cedula;
    const tipoDoc =
      req.body.tipoDocumentoIdentificacion ||
      req.body.tipoDocumento ||
      (req.body.cedula ? "CC" : "RC");

    if (!docNum) {
      return res
        .status(400)
        .json({ error: "El nÃºmero de documento es obligatorio" });
    }

    const existe = await Paciente.findOne({
      where: { num_documento_identificacion: docNum },
    });
    if (existe) {
      return res.status(400).json({ error: "El paciente ya existe" });
    }

    // Preparar objeto para el nuevo modelo (mapear a snake_case para Sequelize)
    const data = {
      ...req.body,
      num_documento_identificacion: docNum,
      tipo_documento_identificacion: tipoDoc,
      // Si no vienen nombres/apellidos separados, intentar separar nombres
      nombres: req.body.nombres,
      apellidos: req.body.apellidos || (req.body.nombres ? "" : "SIN APELLIDO"),
      // Sanitizar esAdulto para evitar errores de casteo (especialmente con strings vacÃos)
      es_adulto: req.body.esAdulto === true || req.body.esAdulto === "true",
    };

    // Mapear datos de contacto si vienen en formato plano (legacy)
    if (!data.datosContacto) {
      data.datosContacto = {
        direccion: req.body.direccion,
        telefono: req.body.telefono || req.body.celular,
        nombreAcompanante:
          req.body.acompanante || req.body.nombreMadre || req.body.nombrePadre,
        telefonoAcompanante: req.body.telefonoAcompanante,
      };
    }

    const paciente = await Paciente.create(data);
    res.json({ mensaje: "Paciente registrado correctamente", id: paciente.id });
  } catch (error) {
    console.error("â Œ Error al registrar paciente:", error);
    res.status(500).json({
      error: error.message || "Error en el servidor",
      details: error.message,
    });
  }
});

router.get("/", logAccesoMiddleware("LISTAR_PACIENTES"), async (req, res) => {
  try {
    const { tipo } = req.query;
    let whereClause = {};

    if (tipo === "nino") {
      whereClause.es_adulto = false;
    } else if (tipo === "adulto") {
      whereClause.es_adulto = true;
    }

    const pacientes = await Paciente.findAll({
      where: whereClause,
      order: [["nombres", "ASC"]],
    });

    console.log(
      `[DEBUG] Pacientes encontrados: ${pacientes.length} (query: ${JSON.stringify(whereClause)})`,
    );

    const mapiado = pacientes.map((p) => {
      let edad = 0;
      const fechaNac = p.fecha_nacimiento;
      if (fechaNac) {
        const hoy = new Date();
        const nacimiento = new Date(fechaNac);

        // Si es niño (RC/TI), calcular edad en meses para el frontend legacy
        const esNino = !p.es_adulto;
        if (esNino) {
          edad =
            (hoy.getFullYear() - nacimiento.getFullYear()) * 12 +
            (hoy.getMonth() - nacimiento.getMonth());
        } else {
          // Si es adulto, edad en años
          edad = hoy.getFullYear() - nacimiento.getFullYear();
          if (
            hoy.getMonth() < nacimiento.getMonth() ||
            (hoy.getMonth() === nacimiento.getMonth() &&
              hoy.getDate() < nacimiento.getDate())
          ) {
            edad--;
          }
        }
      }

      return {
        ...p.toJSON(),
        registroCivil: p.num_documento_identificacion, // Alias legacy
        cedula: p.num_documento_identificacion, // Alias legacy
        genero: p.cod_sexo,
        edad: edad,
        celular: "N/A", // TODO: agregar campo telefono al modelo
        nombreMadre: p.nombre_madre || "N/A",
        nombrePadre: p.nombre_padre || "N/A",
      };
    });

    res.json(mapiado);
  } catch (error) {
    console.error("Error en LISTAR_PACIENTES:", error);
    res.status(500).json({ error: "Error al obtener pacientes" });
  }
});

router.get(
  "/buscar",
  logAccesoMiddleware("BUSCAR_PACIENTES"),
  async (req, res) => {
    const { q, tipo } = req.query;
    try {
      if (!q || q.trim() === "") {
        return res.json([]);
      }

      const { Op } = require("sequelize");
      let whereClause = {
        [Op.or]: [
          { nombres: { [Op.iLike]: `%${q}%` } },
          { apellidos: { [Op.iLike]: `%${q}%` } },
          { num_documento_identificacion: { [Op.iLike]: `%${q}%` } },
        ],
      };

      if (tipo === "nino") {
        whereClause.es_adulto = false;
      } else if (tipo === "adulto") {
        whereClause.es_adulto = true;
      }

      const pacientes = await Paciente.findAll({
        where: whereClause,
        order: [["nombres", "ASC"]],
        limit: 20,
      });

      const mapiado = pacientes.map((p) => {
        let edad = 0;
        const fechaNac = p.fecha_nacimiento;
        if (fechaNac) {
          const hoy = new Date();
          const nacimiento = new Date(fechaNac);
          const esNino = !p.es_adulto;
          if (esNino) {
            edad =
              (hoy.getFullYear() - nacimiento.getFullYear()) * 12 +
              (hoy.getMonth() - nacimiento.getMonth());
          } else {
            edad = hoy.getFullYear() - nacimiento.getFullYear();
            if (
              hoy.getMonth() < nacimiento.getMonth() ||
              (hoy.getMonth() === nacimiento.getMonth() &&
                hoy.getDate() < nacimiento.getDate())
            ) {
              edad--;
            }
          }
        }

        return {
          ...p.toJSON(),
          registroCivil: p.num_documento_identificacion,
          cedula: p.num_documento_identificacion,
          genero: p.cod_sexo,
          edad: edad,
          celular: "N/A",
        };
      });

      res.json(mapiado);
    } catch (e) {
      console.error("Error en /buscar:", e);
      res.json([]);
    }
  },
);

router.get("/recientes", async (req, res) => {
  try {
    const pacientes = await Paciente.findAll({
      order: [["created_at", "DESC"]],
      limit: 10,
    });
    res.json(pacientes);
  } catch (e) {
    res.status(500).json({ error: "Error al obtener pacientes recientes" });
  }
});

router.get(
  "/:id",
  logAccesoMiddleware("CONSULTAR_PACIENTE"),
  async (req, res) => {
    try {
      const paciente = await Paciente.findByPk(req.params.id);
      if (!paciente) return res.status(404).json({ error: "No encontrado" });

      // Envolver en compatibilidad
      const data = {
        ...paciente.toJSON(),
        registroCivil: paciente.num_documento_identificacion,
        cedula: paciente.num_documento_identificacion,
        genero: paciente.cod_sexo,
        direccion: null, // TODO: agregar campo direccion al modelo
        telefono: null, // TODO: agregar campo telefono al modelo
        acompanante: paciente.nombre_madre || paciente.nombre_padre,
      };

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener paciente" });
    }
  },
);

router.delete(
  "/:id",
  logAccesoMiddleware("ELIMINAR_PACIENTE"),
  async (req, res) => {
    try {
      const paciente = await Paciente.findByPk(req.params.id);
      if (!paciente)
        return res.status(404).json({ error: "Paciente no encontrado" });
      await paciente.destroy();
      res.json({ mensaje: "Paciente eliminado correctamente" });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

router.put(
  "/:id",
  logAccesoMiddleware("ACTUALIZAR_PACIENTE"),
  async (req, res) => {
    try {
      const paciente = await Paciente.findByPk(req.params.id);
      if (!paciente) {
        return res.status(404).json({ mensaje: "Paciente no encontrado" });
      }

      // Al actualizar, tambiÃ©n manejamos la estructura anidada si el frontend manda datos planos
      const updateData = { ...req.body };

      if (req.body.esAdulto !== undefined) {
        updateData.es_adulto =
          req.body.esAdulto === true || req.body.esAdulto === "true";
      }

      await paciente.update(updateData);
      res.json({
        mensaje: "Paciente actualizado correctamente",
        paciente: paciente.toJSON(),
      });
    } catch (error) {
      res.status(500).json({ mensaje: "Error al actualizar paciente", error });
    }
  },
);

module.exports = router;
