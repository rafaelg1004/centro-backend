const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const EvolucionSesionSchema = new Schema({
    valoracionAsociada: { type: Schema.Types.ObjectId, ref: 'ValoracionFisioterapia', required: true },
    paciente: { type: Schema.Types.ObjectId, ref: 'Paciente', required: true },

    // Datos RIPS de Procedimientos (Res. 2275)
    fechaInicioAtencion: { type: Date, required: true, default: Date.now },
    codProcedimiento: { type: String, required: true }, // CUPS (Ej. 931000 - Terapia Física)
    viaIngresoServicioSalud: { type: String, default: "02" }, // 02 = Derivado de consulta externa
    finalidadTecnologiaSalud: { type: String, required: true }, // Ej. '44' Rehabilitación
    codDiagnosticoPrincipal: { type: String, required: true }, // CIE-10/11 Heredado de la valoración
    vrServicio: { type: Number, default: 0 },

    // Datos Asistenciales
    numeroSesion: { type: Number, required: true },
    descripcionEvolucion: { type: String, required: true }, // Notas SOAP o descripción del avance
    objetivoSesion: { type: String },
    planSiguienteSesion: { type: String },
    observaciones: { type: String },

    // Cumplimiento Legal (Asistencia y evolución firmada)
    firmas: {
        paciente: {
            firmaUrl: String, timestamp: Date, ip: String
        },
        profesional: {
            nombre: String, registroMedico: String, timestamp: Date
        }
    },
    bloqueada: { type: Boolean, default: false },
    fechaBloqueo: Date,
    selloIntegridad: String,
    auditTrail: { type: Object, default: {} }
}, { timestamps: true });

module.exports = mongoose.models.EvolucionSesion || mongoose.model('EvolucionSesion', EvolucionSesionSchema);
