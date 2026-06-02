const express = require('express');
const router = express.Router();
const { CIE10 } = require('../models-sequelize/index');
const { Op } = require('sequelize');

// GET /api/cie10?q=texto&limit=15
// Busca por código o nombre en la tabla CIE-10
router.get('/', async (req, res) => {
    try {
        const { q = '', limit = 15 } = req.query;
        const lim = Math.min(parseInt(limit) || 15, 50);

        if (!q || q.trim().length < 1) {
            return res.json([]);
        }

        const query = q.trim();

        const results = await CIE10.findAll({
            where: {
                [Op.or]: [
                    { codigo: { [Op.iLike]: `${query}%` } },
                    { descripcion: { [Op.iLike]: `%${query}%` } }
                ]
            },
            order: [['codigo', 'ASC']],
            limit: lim
        });

        res.json(results.map(r => ({
            codigo: r.codigo,
            descripcion: r.descripcion
        })));
    } catch (err) {
        console.error('Error buscando CIE-10:', err);
        res.status(500).json({ error: 'Error en búsqueda CIE-10' });
    }
});

module.exports = router;
