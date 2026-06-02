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
module.exports = router;
