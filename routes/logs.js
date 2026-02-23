const express = require('express');
const Log = require('../models/Log');
const { verificarToken } = require('./auth');
const router = express.Router();

// Endpoint para consultar logs (Solo administración)
router.get('/', verificarToken(['administracion']), async (req, res) => {
    try {
        const { limit = 50, category, level, user } = req.query;

        let query = {};
        if (category) query.category = category;
        if (level) query.level = level;
        if (user) query.user = user;

        const logs = await Log.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .select('-__v');

        res.json({
            total: logs.length,
            logs: logs
        });
    } catch (error) {
        console.error('Error obteniendo logs:', error);
        res.status(500).json({ error: 'Error obteniendo logs' });
    }
});

module.exports = router;
