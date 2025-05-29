const express = require('express');
const router = express.Router();
const ValoracionIngreso = require('../models/ValoracionIngreso');

router.post('/valoraciones', async (req, res) => {
  try {
    const nuevaValoracion = new ValoracionIngreso(req.body);
    await nuevaValoracion.save();
    res.status(201).json({ mensaje: 'Valoración guardada correctamente' });
  } catch (error) {
    console.error('Error al guardar valoración:', error);
    res.status(500).json({ mensaje: 'Error en el servidor', error });
  }
});

router.get('/valoraciones', async (req, res) => {
  try {
    const { documento, fechaInicio, fechaFin } = req.query;
    const filtro = {};

    // Buscar por cédula (registroCivil)
    if (documento) {
      filtro.registroCivil = { $regex: documento, $options: "i" };
    }

    // Buscar por rango de fechas
    if (fechaInicio || fechaFin) {
      filtro.fecha = {};
      if (fechaInicio) filtro.fecha.$gte = fechaInicio;
      if (fechaFin) filtro.fecha.$lte = fechaFin;
    }

    const valoraciones = await ValoracionIngreso.find(filtro);
    res.json(valoraciones);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener valoraciones', error });
  }
});

router.get('/valoraciones/:id', async (req, res) => {
  try {
    const valoracion = await ValoracionIngreso.findById(req.params.id);
    if (!valoracion) {
      return res.status(404).json({ mensaje: 'Valoración no encontrada' });
    }
    res.json(valoracion);
  } catch (error) {
    console.error('Error al obtener valoración por ID:', error);
    res.status(500).json({ mensaje: 'Error al obtener valoración', error });
  }
});

module.exports = router;
