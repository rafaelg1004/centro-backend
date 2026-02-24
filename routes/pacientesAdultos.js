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
const Paciente = require("../models/Paciente");

const router = express.Router();

// Registrar paciente adulto (Proxy al modelo Paciente unificado)
router.post("/", async (req, res) => {
  try {
    const docNum = req.body.numDocumentoIdentificacion || req.body.cedula;
    const tipoDoc = req.body.tipoDocumentoIdentificacion || 'CC';

    if (!docNum) {
      return res.status(400).json({ error: "La cédula es obligatoria." });
    }

    const existe = await Paciente.findOne({ numDocumentoIdentificacion: docNum });
    if (existe) {
      return res.status(400).json({ error: "El paciente ya existe", id: existe._id });
    }

    // Mapear campos del formulario legacy al nuevo modelo
    const nameParts = (req.body.nombres || '').trim().split(' ');
    const nombres = nameParts.slice(0, Math.ceil(nameParts.length / 2)).join(' ');
    const apellidos = nameParts.slice(Math.ceil(nameParts.length / 2)).join(' ') || 'SIN APELLIDO';

    const data = {
      ...req.body,
      nombres,
      apellidos,
      tipoDocumentoIdentificacion: tipoDoc,
      numDocumentoIdentificacion: docNum,
      fechaNacimiento: req.body.fechaNacimiento ? new Date(req.body.fechaNacimiento) : new Date(1990, 0, 1),
      codSexo: (req.body.genero && req.body.genero.toLowerCase().startsWith('m')) ? 'M' : 'F',
      estadoCivil: req.body.estadoCivil,
      ocupacion: req.body.ocupacion,
      datosContacto: {
        direccion: req.body.direccion,
        telefono: req.body.telefono || req.body.celular,
        nombreAcompanante: req.body.acompanante,
        telefonoAcompanante: req.body.telefonoAcompanante
      }
    };

    const paciente = new Paciente(data);
    await paciente.save();
    res.json({ mensaje: "Paciente registrado correctamente", id: paciente._id });
  } catch (error) {
    console.error("Error al registrar paciente adulto:", error);
    res.status(500).json({ error: "Error al registrar paciente", details: error.message });
  }
});

// Obtener todos los pacientes adultos (Filtra por tipo de documento adulto)
router.get("/", async (req, res) => {
  try {
    const pacientes = await Paciente.find({
      tipoDocumentoIdentificacion: { $in: ['CC', 'CE', 'PA'] }
    })
      .select('nombres apellidos numDocumentoIdentificacion codSexo fechaNacimiento aseguradora datosContacto createdAt')
      .sort({ nombres: 1 });

    // Mapeo de compatibilidad
    const mapiado = pacientes.map(p => {
      // Calcular edad
      let edad = 0;
      if (p.fechaNacimiento) {
        const hoy = new Date();
        const nacimiento = new Date(p.fechaNacimiento);
        edad = hoy.getFullYear() - nacimiento.getFullYear();
        if (hoy.getMonth() < nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())) {
          edad--;
        }
      }

      return {
        ...p._doc,
        nombres: `${p.nombres || ''} ${p.apellidos || ''}`.trim() || 'SIN NOMBRE',
        cedula: p.numDocumentoIdentificacion,
        genero: p.codSexo,
        celular: p.datosContacto?.telefono || p.datosContacto?.telefonoAcompanante || "N/A",
        edad: edad,
        aseguradora: p.aseguradora,
        createdAt: p.createdAt
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
    const pacientes = await Paciente.find({
      tipoDocumentoIdentificacion: { $in: ['CC', 'CE', 'PA'] },
      $or: [
        { nombres: { $regex: q, $options: "i" } },
        { apellidos: { $regex: q, $options: "i" } },
        { numDocumentoIdentificacion: { $regex: q, $options: "i" } }
      ]
    }).limit(20);

    const mapiado = pacientes.map(p => ({
      _id: p._id,
      nombres: `${p.nombres} ${p.apellidos}`.trim(),
      cedula: p.numDocumentoIdentificacion,
      aseguradora: p.aseguradora
    }));
    res.json(mapiado);
  } catch (error) {
    res.status(500).json({ error: "Error al buscar pacientes" });
  }
});

// Obtener paciente adulto por ID
router.get("/:id", async (req, res) => {
  try {
    const paciente = await Paciente.findById(req.params.id);
    if (!paciente) return res.status(404).json({ error: "No encontrado" });

    // Devolver con alias de compatibilidad
    res.json({
      ...paciente._doc,
      cedula: paciente.numDocumentoIdentificacion,
      genero: paciente.codSexo,
      direccion: paciente.datosContacto?.direccion,
      telefono: paciente.datosContacto?.telefono,
      acompanante: paciente.datosContacto?.nombreAcompanante,
      telefonoAcompanante: paciente.datosContacto?.telefonoAcompanante
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener paciente" });
  }
});

// Actualizar paciente adulto
router.put("/:id", async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (req.body.cedula) updateData.numDocumentoIdentificacion = req.body.cedula;

    const actualizado = await Paciente.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!actualizado) return res.status(404).json({ mensaje: "No encontrado" });

    res.json({ mensaje: "Actualizado correctamente", paciente: actualizado });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al actualizar", error: error.message });
  }
});

// Eliminar paciente adulto
router.delete("/:id", async (req, res) => {
  try {
    await Paciente.findByIdAndDelete(req.params.id);
    res.json({ mensaje: "Eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;