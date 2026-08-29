const express = require("express");
const { Log } = require("../models-sequelize");
const { Op } = require("sequelize");
const { verificarToken } = require("./auth");
const router = express.Router();

// Endpoint para consultar logs (Solo administración)
router.get("/", verificarToken(["administracion"]), async (req, res) => {
  try {
    const {
      limit = 50,
      page = 1,
      category,
      level,
      user,
      username,
      method,
      startDate,
      endDate,
    } = req.query;

    let whereClause = {};
    if (category) whereClause.category = category;
    if (level) whereClause.level = level;
    if (method) whereClause.method = method.toUpperCase();

    const searchUser = user || username;
    if (searchUser) {
      whereClause.username = { [Op.iLike]: `%${searchUser}%` };
    }

    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) whereClause.created_at[Op.gte] = new Date(startDate);
      if (endDate) whereClause.created_at[Op.lte] = new Date(endDate);
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const offset = (parsedPage - 1) * parsedLimit;

    const { count, rows: logs } = await Log.findAndCountAll({
      where: whereClause,
      order: [["created_at", "DESC"]],
      limit: parsedLimit,
      offset,
    });

    res.json({
      total: count,
      page: parsedPage,
      totalPages: Math.ceil(count / parsedLimit),
      logs,
    });
  } catch (error) {
    console.error("Error obteniendo logs:", error);
    res.status(500).json({ error: "Error obteniendo logs", details: error.message });
  }
});

module.exports = router;
