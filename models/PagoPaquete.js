const mongoose = require("mongoose");

const PagoPaqueteSchema = new mongoose.Schema({
  nino: { type: mongoose.Schema.Types.ObjectId, ref: "Paciente", required: true },
  numeroFactura: { type: String, required: true },
  clasesPagadas: { type: Number, required: true },
  clasesUsadas: { type: Number, default: 0 },
  fechaPago: { type: Date, default: Date.now }
});

module.exports = mongoose.model("PagoPaquete", PagoPaqueteSchema);