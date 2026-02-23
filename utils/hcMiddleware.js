const logger = require('./logger');

/**
 * Middleware para asegurar la inmutabilidad de la Historia Clínica
 * Verifica si un registro médico está bloqueado antes de permitir modificaciones
 */
const verificarBloqueo = (Model, resourceType) => {
    return async (req, res, next) => {
        try {
            const { id } = req.params;

            if (!id) return next();

            const resource = await Model.findById(id);

            if (!resource) {
                return res.status(404).json({
                    error: 'RECURSO_NO_ENCONTRADO',
                    mensaje: `No se encontró el registro de ${resourceType}`
                });
            }

            if (resource.bloqueada) {
                // Log del intento de modificación de un registro bloqueado (Auditoría de Seguridad)
                logger.warn('HC_SEGURIDAD', 'INTENTO_MODIFICACION_BLOQUEADO', {
                    user: req.usuario?.usuario || 'desconocido',
                    paciente: resource.paciente?.toString() || 'desconocido',
                    valoracion: id,
                    ip: req.ip,
                    details: {
                        resourceType,
                        metodo: req.method,
                        path: req.originalUrl
                    }
                });

                return res.status(403).json({
                    error: 'HC_BLOQUEADA',
                    mensaje: 'Este registro de historia clínica está bloqueado y es inmutable según la normativa de salud. No se permiten modificaciones ni eliminaciones.',
                    fechaBloqueo: resource.fechaBloqueo
                });
            }

            // Si no está bloqueada, adjuntar el recurso al request para evitar doble consulta en el controller
            req.hcResource = resource;
            next();
        } catch (error) {
            console.error(`Error en middleware verificarBloqueo (${resourceType}):`, error);
            res.status(500).json({ error: 'Error interno del servidor al verificar estado del registro' });
        }
    };
};

/**
 * Función para bloquear un registro (hacerlo inmutable) con sellado de tiempo
 */
const bloquearRegistro = async (id, Model, resourceType, usuario = 'sistema') => {
    try {
        const backup = await Model.findById(id);
        if (!backup) return null;
        if (backup.bloqueada) return backup;

        const locked = await Model.findByIdAndUpdate(id, {
            bloqueada: true,
            fechaBloqueo: new Date()
        }, { new: true });

        logger.info('HC_SEGURIDAD', 'CIERRE_REGISTRO_HC', {
            user: usuario,
            paciente: locked.paciente?.toString() || 'desconocido',
            valoracion: id,
            details: {
                resourceType,
                timestamp: locked.fechaBloqueo
            }
        });

        return locked;
    } catch (error) {
        console.error(`Error bloqueando registro ${id}:`, error);
        throw error;
    }
};

module.exports = {
    verificarBloqueo,
    bloquearRegistro
};
