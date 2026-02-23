const mongoose = require("mongoose");

const ClaseSchema = new mongoose.Schema({
  nombre: String,
  fecha: String,
  descripcion: String,
  ninos: [
    {
      paciente: { type: mongoose.Schema.Types.ObjectId, ref: "Paciente" },
      firma: String,
      numeroFactura: String,
      auditTrail: { type: Object, default: {} } // Pista de auditoría para la firma del asistente
    }
  ],
  bloqueada: { type: Boolean, default: false },
  fechaBloqueo: Date,
  selloIntegridad: String,
  auditTrail: { type: Object, default: {} } // Pista de auditoría para la firma general de la clase
}, { timestamps: true });

module.exports = mongoose.model("Clase", ClaseSchema);