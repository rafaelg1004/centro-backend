const express = require("express");
const { Paciente } = require("../models-sequelize");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// FunciÃ³n para registrar logs de acceso a datos de pacientes
function logAccesoPaciente(tipo, usuario, pacienteId, detalles = {}) {
  // Log generation disabled per user request
  return;
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
      // Sanitizar esAdulto para evitar errores de casteo (especialmente con strings vacíos)
      es_adulto: req.body.esAdulto === true || req.body.esAdulto === "true",
      fecha_nacimiento: req.body.fechaNacimiento,
      cod_sexo: req.body.codSexo,
      lugar_nacimiento: req.body.lugarNacimiento,
      estado_civil: req.body.estadoCivil,
      nivel_educativo: req.body.nivelEducativo,
      medico_tratante: req.body.medicoTratante,
      estado_embarazo: req.body.estadoEmbarazo,
      nombre_bebe: req.body.nombreBebe,
      fum: req.body.fum,
      semanas_gestacion: req.body.semanasGestacion,
      fecha_probable_parto: req.body.fechaProbableParto,
    };

    // Mapear datos de contacto si vienen en formato plano o anidado
    const contactInfo = req.body.datos_contacto || req.body.datosContacto || {};
    data.datos_contacto = {
      direccion: req.body.direccion || contactInfo.direccion || null,
      telefono: req.body.telefono || contactInfo.telefono || null,
      celular: req.body.celular || contactInfo.celular || null,
      nombreAcompanante: req.body.acompanante || contactInfo.nombreAcompanante || contactInfo.acompanante || req.body.nombreMadre || req.body.nombrePadre || null,
      telefonoAcompanante: req.body.telefonoAcompanante || contactInfo.telefonoAcompanante || null,
    };
    data.datosContacto = data.datos_contacto; // Retrocompatibilidad en memoria

    // Mapear explícitamente los campos nuevos a snake_case
    data.tipo_documento_madre = req.body.tipoDocumentoMadre;
    data.num_documento_madre = req.body.numDocumentoMadre;
    data.tipo_documento_padre = req.body.tipoDocumentoPadre;
    data.num_documento_padre = req.body.numDocumentoPadre;
    data.nombre_madre = req.body.nombreMadre;
    data.edad_madre = req.body.edadMadre;
    data.ocupacion_madre = req.body.ocupacionMadre;
    data.nombre_padre = req.body.nombrePadre;
    data.edad_padre = req.body.edadPadre;
    data.ocupacion_padre = req.body.ocupacionPadre;

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

      const contactInfo = p.datos_contacto || {};
      return {
        ...p.toJSON(),
        registroCivil: p.num_documento_identificacion, // Alias legacy
        cedula: p.num_documento_identificacion, // Alias legacy
        genero: p.cod_sexo,
        edad: edad,
        direccion: contactInfo.direccion || null,
        telefono: contactInfo.telefono || null,
        celular: contactInfo.celular || contactInfo.telefono || "N/A",
        acompanante: contactInfo.nombreAcompanante || contactInfo.acompanante || p.nombre_madre || p.nombre_padre || "N/A",
        telefonoAcompanante: contactInfo.telefonoAcompanante || null,
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

        const contactInfo = p.datos_contacto || {};
        return {
          ...p.toJSON(),
          registroCivil: p.num_documento_identificacion,
          cedula: p.num_documento_identificacion,
          genero: p.cod_sexo,
          edad: edad,
          direccion: contactInfo.direccion || null,
          telefono: contactInfo.telefono || null,
          celular: contactInfo.celular || contactInfo.telefono || "N/A",
          acompanante: contactInfo.nombreAcompanante || contactInfo.acompanante || p.nombre_madre || p.nombre_padre || "N/A",
          telefonoAcompanante: contactInfo.telefonoAcompanante || null,
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

      const contactInfo = paciente.datos_contacto || {};
      // Envolver en compatibilidad
      const data = {
        ...paciente.toJSON(),
        registroCivil: paciente.num_documento_identificacion,
        cedula: paciente.num_documento_identificacion,
        genero: paciente.cod_sexo,
        direccion: contactInfo.direccion || null,
        telefono: contactInfo.telefono || null,
        celular: contactInfo.celular || contactInfo.telefono || null,
        acompanante: contactInfo.nombreAcompanante || contactInfo.acompanante || paciente.nombre_madre || paciente.nombre_padre || null,
        telefonoAcompanante: contactInfo.telefonoAcompanante || null,
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

      // Al actualizar, también manejamos la estructura anidada si el frontend manda datos planos
      const updateData = { ...req.body };

      if (req.body.esAdulto !== undefined) {
        updateData.es_adulto = req.body.esAdulto === true || req.body.esAdulto === "true";
      }
      if (req.body.numDocumentoIdentificacion !== undefined) {
        updateData.num_documento_identificacion = req.body.numDocumentoIdentificacion;
      }
      if (req.body.tipoDocumentoIdentificacion !== undefined) {
        updateData.tipo_documento_identificacion = req.body.tipoDocumentoIdentificacion;
      }
      if (req.body.fechaNacimiento !== undefined) {
        updateData.fecha_nacimiento = req.body.fechaNacimiento;
      }
      if (req.body.codSexo !== undefined) {
        updateData.cod_sexo = req.body.codSexo;
      }
      if (req.body.lugarNacimiento !== undefined) {
        updateData.lugar_nacimiento = req.body.lugarNacimiento;
      }
      if (req.body.estadoCivil !== undefined) {
        updateData.estado_civil = req.body.estadoCivil;
      }
      if (req.body.nivelEducativo !== undefined) {
        updateData.nivel_educativo = req.body.nivelEducativo;
      }
      if (req.body.medicoTratante !== undefined) {
        updateData.medico_tratante = req.body.medicoTratante;
      }
      if (req.body.estadoEmbarazo !== undefined) {
        updateData.estado_embarazo = req.body.estadoEmbarazo;
      }
      if (req.body.nombreBebe !== undefined) {
        updateData.nombre_bebe = req.body.nombreBebe;
      }
      if (req.body.semanasGestacion !== undefined) {
        updateData.semanas_gestacion = req.body.semanasGestacion;
      }
      if (req.body.fechaProbableParto !== undefined) {
        updateData.fecha_probable_parto = req.body.fechaProbableParto;
      }

      // Datos Pediátricos
      if (req.body.tipoDocumentoMadre !== undefined) updateData.tipo_documento_madre = req.body.tipoDocumentoMadre;
      if (req.body.numDocumentoMadre !== undefined) updateData.num_documento_madre = req.body.numDocumentoMadre;
      if (req.body.tipoDocumentoPadre !== undefined) updateData.tipo_documento_padre = req.body.tipoDocumentoPadre;
      if (req.body.numDocumentoPadre !== undefined) updateData.num_documento_padre = req.body.numDocumentoPadre;
      if (req.body.nombreMadre !== undefined) updateData.nombre_madre = req.body.nombreMadre;
      if (req.body.edadMadre !== undefined) updateData.edad_madre = req.body.edadMadre;
      if (req.body.ocupacionMadre !== undefined) updateData.ocupacion_madre = req.body.ocupacionMadre;
      if (req.body.nombrePadre !== undefined) updateData.nombre_padre = req.body.nombrePadre;
      if (req.body.edadPadre !== undefined) updateData.edad_padre = req.body.edadPadre;
      if (req.body.ocupacionPadre !== undefined) updateData.ocupacion_padre = req.body.ocupacionPadre;

      // Mapear datos de contacto
      const currentContact = paciente.datos_contacto || {};
      const contactInfo = req.body.datos_contacto || req.body.datosContacto || {};
      
      const newDireccion = req.body.direccion !== undefined ? req.body.direccion : (contactInfo.direccion !== undefined ? contactInfo.direccion : currentContact.direccion);
      const newTelefono = req.body.telefono !== undefined ? req.body.telefono : (contactInfo.telefono !== undefined ? contactInfo.telefono : currentContact.telefono);
      const newCelular = req.body.celular !== undefined ? req.body.celular : (contactInfo.celular !== undefined ? contactInfo.celular : currentContact.celular);
      const newAcompanante = req.body.acompanante !== undefined ? req.body.acompanante : (contactInfo.nombreAcompanante !== undefined ? contactInfo.nombreAcompanante : (contactInfo.acompanante !== undefined ? contactInfo.acompanante : currentContact.nombreAcompanante));
      const newTelefonoAcompanante = req.body.telefonoAcompanante !== undefined ? req.body.telefonoAcompanante : (contactInfo.telefonoAcompanante !== undefined ? contactInfo.telefonoAcompanante : currentContact.telefonoAcompanante);

      updateData.datos_contacto = {
        direccion: newDireccion || "",
        telefono: newTelefono || "",
        celular: newCelular || "",
        nombreAcompanante: newAcompanante || "",
        telefonoAcompanante: newTelefonoAcompanante || "",
      };

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
