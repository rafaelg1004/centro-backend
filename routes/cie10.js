const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// GET /api/cie10?q=texto&limit=15
// Busca por código o nombre en la tabla CIE-10
router.get('/', async (req, res) => {
    try {
        const { q = '', limit = 15 } = req.query;
        const lim = Math.min(parseInt(limit) || 15, 50);

        if (!q || q.trim().length < 1) {
            return res.json([]);
        }

        const db = mongoose.connection.db;
        const query = q.trim();

        // Buscar por coincidencia de código (exacto o prefijo) O por texto en nombre
        const results = await db.collection('cie10s').find({
            $or: [
                { codigo: { $regex: `^${query}`, $options: 'i' } },
                { descripcion: { $regex: query, $options: 'i' } }
            ]
        })
            .sort({ codigo: 1 })
            .limit(lim)
            .toArray();

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
