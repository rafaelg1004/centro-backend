const express = require('express');
const router = express.Router();
const { BorradorFormulario } = require('../models-sequelize');
const { verificarBloqueo } = require('../utils/hcMiddleware');
const { Op } = require('sequelize');

// Obtener todos los borradores del usuario actual (para notificación en Home)
router.get('/mis-borradores', async (req, res) => {
    try {
        const usuarioId = req.usuario.id || req.usuario.usuario || req.usuario.username;
        if (!usuarioId) {
            return res.status(401).json({ mensaje: "Usuario no autenticado." });
        }

        const borradores = await BorradorFormulario.findAll({
            where: { usuarioId }
        });

        res.json(borradores);
    } catch (error) {
        console.error("Error obteniendo borradores:", error);
        res.status(500).json({ mensaje: "Error del servidor al obtener borradores.", error: error.message });
    }
});

// Obtener un borrador específico por ID
router.get('/:id', async (req, res) => {
    try {
        const usuarioId = req.usuario.id || req.usuario.usuario || req.usuario.username;
        const borrador = await BorradorFormulario.findOne({
            where: {
                id: req.params.id,
                usuarioId
            }
        });

        if (!borrador) {
            return res.status(404).json({ mensaje: "Borrador no encontrado o no pertenece a este usuario." });
        }

        res.json(borrador);
    } catch (error) {
        console.error("Error obteniendo borrador específico:", error);
        res.status(500).json({ mensaje: "Error del servidor.", error: error.message });
    }
});

// Crear o actualizar un borrador (Autoguardado)
router.post('/', async (req, res) => {
    try {
        const usuarioId = req.usuario.id || req.usuario.usuario || req.usuario.username;
        const { pacienteId, tipoFormulario, nombrePaciente, datos } = req.body;

        if (!pacienteId || !tipoFormulario || !datos) {
            return res.status(400).json({ mensaje: "Faltan datos requeridos (pacienteId, tipoFormulario, datos)." });
        }

        // Buscar si ya existe un borrador para este usuario, paciente y tipo
        let borrador = await BorradorFormulario.findOne({
            where: {
                usuarioId,
                pacienteId,
                tipoFormulario
            }
        });

        if (borrador) {
            // Actualizar
            borrador.datos = datos;
            borrador.nombrePaciente = nombrePaciente || borrador.nombrePaciente;
            await borrador.save();
        } else {
            // Crear
            borrador = await BorradorFormulario.create({
                usuarioId,
                pacienteId,
                tipoFormulario,
                nombrePaciente,
                datos
            });
        }

        res.json({ mensaje: "Borrador guardado exitosamente.", borrador });
    } catch (error) {
        console.error("Error guardando borrador:", error);
        res.status(500).json({ mensaje: "Error al guardar el borrador.", error: error.message });
    }
});

// Eliminar un borrador (al finalizar la valoración)
router.delete('/limpiar/:pacienteId/:tipoFormulario', async (req, res) => {
    try {
        const usuarioId = req.usuario.id || req.usuario.usuario || req.usuario.username;
        const borrador = await BorradorFormulario.findOne({
            where: {
                pacienteId: req.params.pacienteId,
                tipoFormulario: req.params.tipoFormulario,
                usuarioId
            }
        });

        if (borrador) {
            await borrador.destroy();
        }
        res.json({ mensaje: "Borrador limpio." });
    } catch (error) {
        console.error("Error limpiando borrador:", error);
        res.status(500).json({ mensaje: "Error al limpiar el borrador.", error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const usuarioId = req.usuario.id || req.usuario.usuario || req.usuario.username;
        const borrador = await BorradorFormulario.findOne({
            where: {
                id: req.params.id,
                usuarioId
            }
        });

        if (!borrador) {
            return res.status(404).json({ mensaje: "Borrador no encontrado." });
        }

        await borrador.destroy();
        res.json({ mensaje: "Borrador eliminado correctamente." });
    } catch (error) {
        console.error("Error eliminando borrador:", error);
        res.status(500).json({ mensaje: "Error al eliminar el borrador.", error: error.message });
    }
});

module.exports = router;
