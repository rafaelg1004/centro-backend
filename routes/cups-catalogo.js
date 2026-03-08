const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Modelo On-the-fly para el Catálogo Oficial CUPS (Extraído del Excel)
const CUPS_Schema = new mongoose.Schema({
    codigo: { type: String, required: true, unique: true },
    nombre: { type: String },
    descripcion: { type: String }
}, { timestamps: true });

const CUPS_Catalogo = mongoose.models.CUPS_Catalogo || mongoose.model('CUPS_Catalogo', CUPS_Schema);

/**
 * GET /api/cups-catalogo
 * Busca códigos CUPS oficiales por código o nombre
 * Uso típico: Autocompletado en el frontend
 */
router.get('/', async (req, res) => {
    try {
        const { q, limit = 15 } = req.query;

        if (!q || q.length < 2) {
            return res.json([]);
        }

        const queryRegex = new RegExp(q, 'i'); // Búsqueda case-insensitive
        const resultados = await CUPS_Catalogo.find({
            $or: [
                { codigo: queryRegex },
                { nombre: queryRegex }
            ]
        })
            .limit(parseInt(limit))
            .select('-__v')
            .lean();

        res.json(resultados);
    } catch (error) {
        console.error('Error buscando CUPS en catálogo oficial:', error);
        res.status(500).json({ error: 'Error del servidor buscando CUPS' });
    }
});

module.exports = router;
