const cron = require('node-cron');
const { Op } = require('sequelize');
const { ValoracionFisioterapia, EvolucionSesion } = require('../models-sequelize');
const { generarHash } = require('../utils/auditUtils');

/**
 * Función que busca todas las historias clínicas y evoluciones que han
 * estado abiertas por más de 24 horas y las sella criptográficamente
 * para evitar modificaciones posteriores, cumpliendo con la normativa.
 */
const cerrarHistoriasAntiguas = async () => {
  try {
    const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000);
    console.log(`[Cron] Verificando historias abiertas antes de ${hace24Horas.toISOString()}`);

    // 1. Cerrar Valoraciones
    const valoracionesAfectadas = await ValoracionFisioterapia.findAll({
      where: {
        bloqueada: false,
        [Op.or]: [
          { created_at: { [Op.lt]: hace24Horas } },
          { fecha_inicio_atencion: { [Op.lt]: hace24Horas } }
        ]
      }
    });

    for (const val of valoracionesAfectadas) {
      const auditTrail = val.audit_trail || {};
      auditTrail.cierreAutomatico = {
        mensaje: "Cerrado automáticamente por el sistema tras 24 horas",
        fechaHora: new Date().toISOString()
      };

      const fechaBloqueo = new Date();
      
      const selloIntegridad = generarHash({
        contenido: val.toJSON(),
        auditTrail: auditTrail,
        fechaBloqueo: fechaBloqueo
      });

      await val.update({
        bloqueada: true,
        fecha_bloqueo: fechaBloqueo,
        audit_trail: auditTrail,
        sello_integridad: selloIntegridad
      });
    }

    // 2. Cerrar Evoluciones
    const evolucionesAfectadas = await EvolucionSesion.findAll({
      where: {
        bloqueada: false,
        [Op.or]: [
          { created_at: { [Op.lt]: hace24Horas } },
          { fecha_inicio_atencion: { [Op.lt]: hace24Horas } }
        ]
      }
    });

    for (const evo of evolucionesAfectadas) {
      const auditTrail = evo.audit_trail || {};
      auditTrail.cierreAutomatico = {
        mensaje: "Cerrado automáticamente por el sistema tras 24 horas",
        fechaHora: new Date().toISOString()
      };

      const fechaBloqueo = new Date();

      const selloIntegridad = generarHash({
        contenido: evo.toJSON(),
        auditTrail: auditTrail,
        fechaBloqueo: fechaBloqueo
      });

      await evo.update({
        bloqueada: true,
        fecha_bloqueo: fechaBloqueo,
        audit_trail: auditTrail,
        sello_integridad: selloIntegridad
      });
    }

    if (valoracionesAfectadas.length > 0 || evolucionesAfectadas.length > 0) {
      console.log(`[Cron] Historias cerradas. Valoraciones: ${valoracionesAfectadas.length}, Evoluciones: ${evolucionesAfectadas.length}`);
    } else {
      console.log(`[Cron] No se encontraron historias antiguas para cerrar.`);
    }

  } catch (error) {
    console.error("[Cron] Error cerrando historias antiguas:", error);
  }
};

const limpiarBorradoresAbandonados = async () => {
  try {
    // Definimos qué es "mucho tiempo" (por ejemplo: 2 días)
    const limiteDias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const cantidadBorrados = await require('../models-sequelize').BorradorFormulario.destroy({
      where: {
        updatedAt: {
          [Op.lt]: limiteDias
        }
      }
    });
    
    if (cantidadBorrados > 0) {
      console.log(`[Cron] Limpieza automática: Se borraron ${cantidadBorrados} borradores abandonados (más de 2 días).`);
    }
  } catch (error) {
    console.error("[Cron] Error limpiando borradores abandonados:", error);
  }
};

const initCronJobs = () => {
  // Ejecutar todos los días a la medianoche
  cron.schedule('0 0 * * *', () => {
    cerrarHistoriasAntiguas();
    limpiarBorradoresAbandonados();
  });
  console.log('✅ Cron Jobs inicializados (Cierre automático y limpieza de borradores activados)');
};

module.exports = {
  initCronJobs,
  cerrarHistoriasAntiguas
};
