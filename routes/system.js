const express = require('express');
const { sequelize } = require('../models-sequelize/index');
const router = express.Router();

// Health check endpoint para monitoreo
router.get('/health', async (req, res) => {
    try {
        // Verificar conexión a base de datos
        let dbStatus = 'connected';
        try {
            await sequelize.authenticate();
        } catch (error) {
            dbStatus = 'disconnected';
            console.error('Error connecting to PostgreSQL:', error);
        }

        // Información básica del sistema
        const healthCheck = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            database: {
                status: dbStatus,
                name: sequelize.config.database
            },
            environment: process.env.NODE_ENV || 'development',
            version: '1.0.0'
        };

        // Si la BD no está conectada, cambiar status
        if (dbStatus !== 'connected') {
            healthCheck.status = 'error';
            res.status(503);
        }

        res.json(healthCheck);
    } catch (error) {
        console.error('Error en health check:', error);
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Endpoint temporal para arreglar valoraciones sin creador
router.get('/fix-creador', async (req, res) => {
    try {
        const { Usuario, ValoracionFisioterapia } = require('../models-sequelize/index');
        const { Op } = require('sequelize');
        
        // Buscar a la doctora (Dayan Ivonne Villegas)
        const doctora = await Usuario.findOne({ 
            where: { nombre: { [Op.iLike]: '%Dayan%' } } 
        });

        if (!doctora) {
            return res.status(404).json({ message: "No se encontró el usuario de la Doctora Dayan." });
        }

        // Actualizar valoraciones donde creado_por sea null
        const [updatedRows] = await ValoracionFisioterapia.update(
            { creado_por: doctora.id },
            { where: { creado_por: null } }
        );

        res.json({
            status: 'ok',
            message: `Se asignaron ${updatedRows} valoraciones a la doctora ${doctora.nombre}`
        });

    } catch (error) {
        console.error('Error fixing creador:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
