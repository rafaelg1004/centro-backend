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

// Endpoint temporal para reasignar las historias clínicas a la doctora correcta
router.get('/fix-creador', async (req, res) => {
    try {
        const { ValoracionFisioterapia } = require('../models-sequelize/index');
        
        // ID del usuario incorrecto (auxiliar)
        const wrongId = '1d5a869a-1c2d-4896-96f2-7c6224e02dd7';
        
        // ID de la doctora correcta (Dayanvillegas)
        const correctId = 'e4cd1eb3-5890-46eb-b881-baf6a2415345';

        // Actualizar valoraciones que tengan el ID incorrecto o estén vacías
        const [updatedRows1] = await ValoracionFisioterapia.update(
            { creado_por: correctId },
            { where: { creado_por: wrongId } }
        );

        const [updatedRows2] = await ValoracionFisioterapia.update(
            { creado_por: correctId },
            { where: { creado_por: null } }
        );

        res.json({
            status: 'ok',
            message: `Corregido con éxito. Se reasignaron ${updatedRows1 + updatedRows2} historias a la doctora Dayanvillegas.`
        });

    } catch (error) {
        console.error('Error fixing creador:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
