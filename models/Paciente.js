const mongoose = require("mongoose");

const pacienteSchema = new mongoose.Schema({
  nombres: { type: String, required: true },
  registroCivil: String,
  genero: String,
  lugarNacimiento: String,
  fechaNacimiento: String,
  edad: String,
  peso: String,
  talla: String,
  direccion: String,
  telefono: String,
  celular: String,
  pediatra: String,
  aseguradora: String,
  nombreMadre: String,
  edadMadre: String,
  ocupacionMadre: String,
  nombrePadre: String,
  edadPadre: String,
  ocupacionPadre: String,
});

// Esta línea evita el OverwriteModelError:
module.exports = mongoose.models.Paciente || mongoose.model("Paciente", pacienteSchema);
