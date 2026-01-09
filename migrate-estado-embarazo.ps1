# Script de migración para Windows PowerShell
Write-Host "🚀 Iniciando migración de base de datos para campo estadoEmbarazo" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Yellow

# Cambiar al directorio del backend
Set-Location -Path $PSScriptRoot

# Ejecutar la migración
Write-Host "📦 Ejecutando migración..." -ForegroundColor Blue
node migrations/add-estado-embarazo.js

Write-Host "==================================================" -ForegroundColor Yellow
Write-Host "✅ Migración completada" -ForegroundColor Green

# Pausa para ver los resultados
Write-Host "Presione cualquier tecla para continuar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
