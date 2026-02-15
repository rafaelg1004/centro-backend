const mongoose = require("mongoose");

const SesionMensualSchema = new mongoose.Schema({
  nombre: { type: String, required: true }, // Nombre de la sesión/clase (ej: Estimulación Temprana)
  fecha: { type: String, required: true },
  descripcionGeneral: String, // Lo que se hizo de forma general
  asistentes: [
    {
      nino: { type: mongoose.Schema.Types.ObjectId, ref: "Paciente" },
      observaciones: String, // Qué hizo/cómo le fue a cada niño específicamente
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model("SesionMensual", SesionMensualSchema);
