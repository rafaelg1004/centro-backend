const express = require("express");
const router = express.Router();
const { CupsCatalogo } = require("../models-sequelize");
const { Op } = require("sequelize");

/**
 * GET /api/cups-catalogo
 * Busca códigos CUPS oficiales por código o nombre
 * Uso típico: Autocompletado en el frontend
 */
router.get("/", async (req, res) => {
  try {
    const { q, limit = 15 } = req.query;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    const resultados = await CupsCatalogo.findAll({
      where: {
        activo: true,
        [Op.or]: [
          { codigo_cups: { [Op.iLike]: `%${q}%` } },
          { descripcion: { [Op.iLike]: `%${q}%` } },
        ],
      },
      limit: parseInt(limit),
      order: [["codigo_cups", "ASC"]],
    });

    res.json(resultados.map((r) => r.toJSON()));
  } catch (error) {
    console.error("Error buscando CUPS en catálogo oficial:", error);
    res.status(500).json({ error: "Error del servidor buscando CUPS" });
  }
});

module.exports = router;
