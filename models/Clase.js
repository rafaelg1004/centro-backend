const mongoose = require("mongoose");

const ClaseSchema = new mongoose.Schema({
  nombre: String,
  fecha: String,
  descripcion: String,
  ninos: [
  {
    nino: { type: mongoose.Schema.Types.ObjectId, ref: "Paciente" },
    firma: String,
    numeroFactura: String // Nuevo campo
  }
]
});

module.exports = mongoose.model("Clase", ClaseSchema);