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

    // Devolver con alias de compatibilidad
    res.json({
      ...paciente.toJSON(),
      cedula: paciente.num_documento_identificacion,
      genero: paciente.cod_sexo,
      direccion: null,
      telefono: null,
      acompanante: paciente.nombre_madre || paciente.nombre_padre,
      telefonoAcompanante: null,
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
