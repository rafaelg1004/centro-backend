const express = require("express");
const { Log } = require("../models-sequelize");
const { Op } = require("sequelize");
const { verificarToken } = require("./auth");
const router = express.Router();

// Endpoint para consultar logs (Solo administración)
router.get("/", verificarToken(["administracion"]), async (req, res) => {
  try {
    const { limit = 50, category, level, user } = req.query;

    let whereClause = {};
    if (category) whereClause.category = category;
    if (level) whereClause.level = level;
    if (user) whereClause.user = { [Op.iLike]: `%${user}%` };

    const logs = await Log.findAll({
      where: whereClause,
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
    });

    res.json({
      total: logs.length,
      logs: logs,
    });
  } catch (error) {
    console.error("Error obteniendo logs:", error);
    res.status(500).json({ error: "Error obteniendo logs" });
  }
});

module.exports = router;
