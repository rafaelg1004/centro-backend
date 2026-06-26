/**
 * RUTA LEGACY: /api/pacientes-adultos
 *
 * Este archivo ahora actúa como un proxy hacia el modelo unificado `Paciente`.
 * Mantiene la compatibilidad con el frontend anterior que usa rutas separadas
 * para pacientes pediátricos y adultos.
 *
 * Todos los pacientes (adultos y niños) ahora se guardan en la misma colección
 * usando el modelo `Paciente` unificado.
 */
const express = require("express");
const { Paciente } = require("../models-sequelize");
const { Op } = require("sequelize");

const router = express.Router();

// Registrar paciente adulto (Proxy al modelo Paciente unificado)
router.post("/", async (req, res) => {
  try {
    const docNum = req.body.numDocumentoIdentificacion || req.body.cedula;
    const tipoDoc = req.body.tipoDocumentoIdentificacion || "CC";

    if (!docNum) {
      return res.status(400).json({ error: "La cédula es obligatoria." });
    }

    const existe = await Paciente.findOne({
      where: { num_documento_identificacion: docNum },
    });
    if (existe) {
      return res
        .status(400)
        .json({ error: "El paciente ya existe", id: existe.id });
    }

    // Mapear campos del formulario legacy al nuevo modelo
    const nameParts = (req.body.nombres || "").trim().split(" ");
    const nombres = nameParts
      .slice(0, Math.ceil(nameParts.length / 2))
      .join(" ");
    const apellidos =
      nameParts.slice(Math.ceil(nameParts.length / 2)).join(" ") ||
      "SIN APELLIDO";

    const data = {
      ...req.body,
      nombres,
      apellidos,
      tipo_documento_identificacion: tipoDoc,
      num_documento_identificacion: docNum,
      fecha_nacimiento: req.body.fechaNacimiento
        ? new Date(req.body.fechaNacimiento)
        : new Date(1990, 0, 1),
      cod_sexo:
        req.body.genero && req.body.genero.toLowerCase().startsWith("m")
          ? "M"
          : "F",
      estado_civil: req.body.estadoCivil,
      ocupacion: req.body.ocupacion,
      es_adulto: true,
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

    const paciente = await Paciente.create(data);
    res.json({ mensaje: "Paciente registrado correctamente", id: paciente.id });
  } catch (error) {
    console.error("Error al registrar paciente adulto:", error);
    res
      .status(500)
      .json({ error: "Error al registrar paciente", details: error.message });
  }
});

// Obtener todos los pacientes adultos (Filtra por tipo de documento adulto)
router.get("/", async (req, res) => {
  try {
    const pacientes = await Paciente.findAll({
      where: {
        tipo_documento_identificacion: { [Op.in]: ["CC", "CE", "PA"] },
        es_adulto: true,
      },
      order: [["nombres", "ASC"]],
    });

    // Mapeo de compatibilidad
    const mapiado = pacientes.map((p) => {
      // Calcular edad
      let edad = 0;
      if (p.fecha_nacimiento) {
        const hoy = new Date();
        const nacimiento = new Date(p.fecha_nacimiento);
        edad = hoy.getFullYear() - nacimiento.getFullYear();
        if (
          hoy.getMonth() < nacimiento.getMonth() ||
          (hoy.getMonth() === nacimiento.getMonth() &&
            hoy.getDate() < nacimiento.getDate())
        ) {
          edad--;
        }
      }

      return {
        ...p.toJSON(),
        nombres:
          `${p.nombres || ""} ${p.apellidos || ""}`.trim() || "SIN NOMBRE",
        cedula: p.num_documento_identificacion,
        genero: p.cod_sexo,
        celular: "N/A",
        edad: edad,
        aseguradora: p.aseguradora,
        createdAt: p.created_at,
      };
    });
    res.json(mapiado);
  } catch (error) {
    console.error("Error obteniendo pacientes adultos:", error);
    res.status(500).json({ error: "Error al obtener pacientes" });
  }
});

// Buscar pacientes adultos por nombre o cédula
router.get("/buscar", async (req, res) => {
  try {
    const q = req.query.q || "";
    const pacientes = await Paciente.findAll({
      where: {
        tipo_documento_identificacion: { [Op.in]: ["CC", "CE", "PA"] },
        es_adulto: true,
        [Op.or]: [
          { nombres: { [Op.iLike]: `%${q}%` } },
          { apellidos: { [Op.iLike]: `%${q}%` } },
          { num_documento_identificacion: { [Op.iLike]: `%${q}%` } },
        ],
      },
      limit: 20,
    });

    const mapiado = pacientes.map((p) => ({
      _id: p.id,
      nombres: `${p.nombres} ${p.apellidos}`.trim(),
      cedula: p.num_documento_identificacion,
      aseguradora: p.aseguradora,
    }));
    res.json(mapiado);
  } catch (error) {
    res.status(500).json({ error: "Error al buscar pacientes" });
  }
});

// Obtener paciente adulto por ID
router.get("/:id", async (req, res) => {
  try {
    const paciente = await Paciente.findByPk(req.params.id);
    if (!paciente) return res.status(404).json({ error: "No encontrado" });

    const contactInfo = paciente.datos_contacto || {};

    // Devolver con alias de compatibilidad
    res.json({
      ...paciente.toJSON(),
      // Compatibilidad camelCase
      esAdulto: paciente.es_adulto,
      tipoDocumentoIdentificacion: paciente.tipo_documento_identificacion,
      numDocumentoIdentificacion: paciente.num_documento_identificacion,
      fechaNacimiento: paciente.fecha_nacimiento,
      codSexo: paciente.cod_sexo,
      lugarNacimiento: paciente.lugar_nacimiento,
      estadoCivil: paciente.estado_civil,
      nivelEducativo: paciente.nivel_educativo,
      medicoTratante: paciente.medico_tratante,
      estadoEmbarazo: paciente.estado_embarazo,
      nombreBebe: paciente.nombre_bebe,
      semanasGestacion: paciente.semanas_gestacion,
      fechaProbableParto: paciente.fecha_probable_parto,
      tipoDocumentoMadre: paciente.tipo_documento_madre,
      numDocumentoMadre: paciente.num_documento_madre,
      tipoDocumentoPadre: paciente.tipo_documento_padre,
      numDocumentoPadre: paciente.num_documento_padre,
      nombreMadre: paciente.nombre_madre,
      edadMadre: paciente.edad_madre,
      ocupacionMadre: paciente.ocupacion_madre,
      nombrePadre: paciente.nombre_padre,
      edadPadre: paciente.edad_padre,
      ocupacionPadre: paciente.ocupacion_padre,
      pediatra: paciente.pediatra,
      peso: paciente.peso,
      talla: paciente.talla,
      cedula: paciente.num_documento_identificacion,
      genero: paciente.cod_sexo,
      direccion: contactInfo.direccion || null,
      telefono: contactInfo.telefono || null,
      celular: contactInfo.celular || contactInfo.telefono || null,
      acompanante: contactInfo.nombreAcompanante || contactInfo.acompanante || paciente.nombre_madre || paciente.nombre_padre || null,
      telefonoAcompanante: contactInfo.telefonoAcompanante || null,
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener paciente" });
  }
});

// Actualizar paciente adulto
router.put("/:id", async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (req.body.cedula)
      updateData.num_documento_identificacion = req.body.cedula;

    const paciente = await Paciente.findByPk(req.params.id);
    if (!paciente) return res.status(404).json({ mensaje: "No encontrado" });

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
      mensaje: "Actualizado correctamente",
      paciente: paciente.toJSON(),
    });
  } catch (error) {
    res
      .status(500)
      .json({ mensaje: "Error al actualizar", error: error.message });
  }
});

// Eliminar paciente adulto
router.delete("/:id", async (req, res) => {
  try {
    const paciente = await Paciente.findByPk(req.params.id);
    if (!paciente) return res.status(404).json({ mensaje: "No encontrado" });
    await paciente.destroy();
    res.json({ mensaje: "Eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
