const mongoose = require('mongoose');
const Paciente = require('./models/Paciente');
const ValoracionFisioterapia = require('./models/ValoracionFisioterapia');
const Clase = require('./models/Clase');
const EvolucionSesion = require('./models/EvolucionSesion');
const Log = require('./models/Log');
const SesionMensual = require('./models/SesionMensual');
require('dotenv').config();

async function mergeDuplicates() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Conectado a la BD.");

        // Solo procesamos niños
        const ninos = await Paciente.find({ esAdulto: false }).lean();
        console.log(`Total niños encontrados: ${ninos.length}`);

        const nameMap = {};
        const idMap = {};

        for (const nino of ninos) {
            // Agrupar por ID
            if (nino.numDocumentoIdentificacion) {
                const id = nino.numDocumentoIdentificacion.trim();
                if (!idMap[id]) idMap[id] = [];
                idMap[id].push(nino);
            }
        }

        let mergedCount = 0;

        // Recorrer duplicados por ID
        for (const id in idMap) {
            if (idMap[id].length > 1) {
                const registros = idMap[id];
                console.log(`Encontrados duplicados para ID ${id}:`);

                // Encontrar el registro principal (el que tiene nombres y apellidos separados, o el más completo)
                // Preferimos el que tiene "apellidos" no vacío.
                const principal = registros.find(r => r.apellidos && r.apellidos.trim() !== '') || registros[0];
                const principalId = principal._id;

                console.log(`  Registro principal a mantener: ${principal._id} (${principal.nombres} ${principal.apellidos})`);

                // Recorrer los otros registros para fusionar
                for (const registro of registros) {
                    if (registro._id.toString() !== principalId.toString()) {
                        const duplicateId = registro._id;
                        console.log(`  Fusionando desde registro secundario: ${duplicateId} (${registro.nombres} ${registro.apellidos})`);

                        // 1. Actualizar referencias en otras colecciones
                        // Update Valoraciones Fisioterapia? Asumo que hay y pueden apuntar a 'pacienteId' o 'paciente'
                        if (mongoose.models.ValoracionFisioterapia) {
                            await ValoracionFisioterapia.updateMany({ pacienteId: duplicateId }, { $set: { pacienteId: principalId } });
                        }

                        if (mongoose.models.Clase) {
                            await Clase.updateMany({ pacienteId: duplicateId }, { $set: { pacienteId: principalId } });
                            await Clase.updateMany({ "asistentes.pacienteId": duplicateId }, { $set: { "asistentes.$.pacienteId": principalId } });
                        }

                        if (mongoose.models.EvolucionSesion) {
                            await EvolucionSesion.updateMany({ pacienteId: duplicateId }, { $set: { pacienteId: principalId } });
                        }

                        if (mongoose.models.Log) {
                            await Log.updateMany({ pacienteId: duplicateId }, { $set: { pacienteId: principalId } });
                            await Log.updateMany({ entidadId: duplicateId }, { $set: { entidadId: principalId } });
                        }

                        if (mongoose.models.SesionMensual) {
                            await SesionMensual.updateMany({ pacienteId: duplicateId }, { $set: { pacienteId: principalId } });
                        }

                        // Si hay otras colecciones como ValoracionPerinatal
                        try {
                            const db = mongoose.connection.db;
                            await db.collection('valoracionperinatals').updateMany({ pacienteId: duplicateId }, { $set: { pacienteId: principalId } });
                            await db.collection('valoraciones').updateMany({ pacienteId: duplicateId }, { $set: { pacienteId: principalId } });
                        } catch (e) {
                            console.log("No pude actualizar valoraciones perinatales/generales bypass:", e.message);
                        }

                        // 2. Eliminar el registro duplicado
                        await Paciente.deleteOne({ _id: duplicateId });
                        console.log(`  -- Eliminado registro duplicado: ${duplicateId}`);
                        mergedCount++;
                    }
                }
            }
        }

        console.log(`\nFusión completa. Se fusionaron/eliminaron ${mergedCount} registros duplicados.`);

    } catch (error) {
        console.error("Error conectando o consultando:", error);
    } finally {
        await mongoose.disconnect();
        console.log("Desconectado de la BD.");
    }
}

mergeDuplicates();
