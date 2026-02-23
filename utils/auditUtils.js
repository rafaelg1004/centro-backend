const crypto = require('crypto');

/**
 * Genera un hash SHA-256 de cualquier objeto o string.
 * Se utiliza para crear el "sello de integridad" del documento.
 */
function generarHash(data) {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Extrae metadatos de la petición para la pista de auditoría.
 */
function obtenerMetadatosPista(req) {
    return {
        ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        dispositivo: req.body.dispositivoInfo || 'Desconocido', // El frontend puede enviar info extra
        fechaHora: new Date().toISOString(),
        usuarioId: req.usuario ? req.usuario.id : null,
        nombreUsuario: req.usuario ? req.usuario.nombre : 'Anónimo',
        rolUsuario: req.usuario ? req.usuario.rol : 'Desconocido'
    };
}

module.exports = {
    generarHash,
    obtenerMetadatosPista
};
