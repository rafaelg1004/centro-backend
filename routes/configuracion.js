const express = require("express");
const router = express.Router();
const { ConfiguracionClinica } = require("../models-sequelize");
const { verificarToken } = require("./auth");

/**
 * GET /api/configuracion
 * Obtiene la configuración de la clínica
 */
router.get("/", async (req, res) => {
  try {
    let config = await ConfiguracionClinica.findOne();
    if (!config) {
      config = await ConfiguracionClinica.create({
        nombre_clinica: "D'Mamitas & Babies",
        slogan: "Centro de Estimulación, Fisioterapia y Programas Perinatales",
      });
    }
    res.json(config);
  } catch (error) {
    console.error("Error obteniendo configuración:", error);
    res.status(500).json({ message: "Error interno del servidor", error: error.message });
  }
});

/**
 * PUT /api/configuracion
 * Actualiza la configuración de la clínica (Solo admin)
 */
router.put("/", verificarToken(["administracion"]), async (req, res) => {
  try {
    let config = await ConfiguracionClinica.findOne();
    
    if (!config) {
      config = await ConfiguracionClinica.create(req.body);
    } else {
      await config.update(req.body);
    }
    
    res.json({ message: "Configuración actualizada correctamente", configuracion: config });
  } catch (error) {
    console.error("Error actualizando configuración:", error);
    res.status(500).json({ message: "Error interno del servidor", error: error.message });
  }
});

module.exports = router;
