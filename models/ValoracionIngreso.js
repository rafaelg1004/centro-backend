const mongoose = require('mongoose');

const ValoracionIngresoSchema = new mongoose.Schema({
  paciente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Paciente',
    required: true
  },
  fecha: {
    type: Date,
    required: true,
    validate: {
      validator: function(value) {
        // Validar que la fecha no sea futura (máximo 1 día en el futuro para casos excepcionales)
        const maxFecha = new Date();
        maxFecha.setDate(maxFecha.getDate() + 1);
        return value <= maxFecha;
      },
      message: 'La fecha de valoración no puede ser futura'
    }
  },
  motivoDeConsulta: {
    type: String,
    required: true,
    minlength: [10, 'El motivo de consulta debe tener al menos 10 caracteres'],
    maxlength: [1000, 'El motivo de consulta no puede exceder 1000 caracteres']
  },
  // ... resto del esquema existente
