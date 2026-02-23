const express = require('express');
const router = express.Router();
const ripsConfig = require('../ripsConfig');

/**
 * Res. 256 de 2016 - Indicadores de Calidad
 */

// Registro Tipo 1: Registro de Control
router.get('/type1', (req, res) => {
    try {
        const prestador = ripsConfig.prestador;
        const ahora = new Date();

        const registroTipo1 = {
            tipoRegistro: '1',
            codPrestador: prestador.codPrestador,
            fechaInicio: `${ahora.getFullYear()}-01-01`,
            fechaFinal: `${ahora.getFullYear()}-12-31`,
            totalRegistros: 0 // Debería calcularse según los datos enviados
        };

        res.json(registroTipo1);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Registro Tipo 3: Satisfacción Global del Paciente
// Este endpoint debería consolidar resultados de encuestas de satisfacción
router.get('/satisfaction', async (req, res) => {
    try {
        // En una implementación real, esto consultaría una colección de encuestas
        // Por ahora, devolvemos la estructura requerida por la norma
        const satisfaccion = [
            {
                codPrestador: ripsConfig.prestador.codPrestador,
                anio: new Date().getFullYear(),
                mes: new Date().getMonth() + 1,
                totalEncuestados: 0,
                muySatisfechos: 0,
                satisfechos: 0,
                neutrales: 0,
                insatisfechos: 0,
                muyInsatisfechos: 0,
                porcentajeSatisfaccion: 0
            }
        ];

        res.json(satisfaccion);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
