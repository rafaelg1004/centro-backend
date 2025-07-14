#!/bin/bash

echo "🚀 Iniciando migración de base de datos para campo estadoEmbarazo"
echo "=================================================="

# Cambiar al directorio del backend
cd "$(dirname "$0")"

# Ejecutar la migración
node migrations/add-estado-embarazo.js

echo "=================================================="
echo "✅ Migración completada"
