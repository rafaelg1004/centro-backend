const mongoose = require("mongoose");

const SesionPerinatalPacienteSchema = new mongoose.Schema({
  paciente: { type: mongoose.Schema.Types.ObjectId, ref: "PacienteAdulto", required: true },
  tipoPrograma: { type: String, enum: ["fisico", "educacion", "ambos", "intensivo"], required: true },
  nombreSesion: { type: String, required: true },
  fecha: { type: String },
  descripcion: { type: String },
  firmaPaciente: { type: String }, // URL de S3 o base64
  estado: { type: String, enum: ["activa", "completada", "cancelada"], default: "activa" },
  fechaRegistro: { type: Date, default: Date.now },
});

module.exports = mongoose.models.SesionPerinatalPaciente || mongoose.model("SesionPerinatalPaciente", SesionPerinatalPacienteSchema); 