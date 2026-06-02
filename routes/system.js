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
        
        // Buscar a la doctora por varios nombres posibles o tomar el primer administrador
        let doctora = await Usuario.findOne({ 
            where: { 
                [Op.or]: [
                    { nombre: { [Op.iLike]: '%Dayan%' } },
                    { nombre: { [Op.iLike]: '%Ivonne%' } },
                    { email: { [Op.iLike]: '%contacto@dmamitas.com%' } }
                ]
            } 
        });

        // Si no se encuentra, tomar el primer usuario creado (suele ser el admin principal)
        if (!doctora) {
            doctora = await Usuario.findOne({ order: [['createdAt', 'ASC']] });
        }

        if (!doctora) {
            return res.status(404).json({ message: "No hay ningún usuario registrado en el sistema." });
        }

        // Actualizar valoraciones donde creado_por sea null
        const [updatedRows] = await ValoracionFisioterapia.update(
            { creado_por: doctora.id },
            { where: { creado_por: null } }
        );

        res.json({
            status: 'ok',
            message: `Se asignaron ${updatedRows} valoraciones al usuario: ${doctora.nombre} (ID: ${doctora.id})`
        });

    } catch (error) {
        console.error('Error fixing creador:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
