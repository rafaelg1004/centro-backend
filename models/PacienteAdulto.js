const mongoose = require("mongoose");

const pacienteAdultoSchema = new mongoose.Schema({
  nombres: { type: String, required: true },
  cedula: { type: String, required: true, unique: true },
  genero: String,
  lugarNacimiento: String,
  fechaNacimiento: String,
  edad: String,
  estadoCivil: String,
  direccion: String,
  telefono: String,
  celular: String,
  ocupacion: String,
  nivelEducativo: String,
  medicoTratante: String,
  aseguradora: String,
  acompanante: String,
  telefonoAcompanante: String,
  nombreBebe: String,
  estadoEmbarazo: { 
    type: String, 
    enum: ['gestacion', 'posparto'],
    default: 'gestacion' // Para retrocompatibilidad
  },
  semanasGestacion: String,
  fum: String,
  fechaProbableParto: String,
});

module.exports = mongoose.models.PacienteAdulto || mongoose.model("PacienteAdulto", pacienteAdultoSchema);