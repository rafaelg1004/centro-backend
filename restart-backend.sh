#!/bin/bash
# Script para reiniciar el backend Node.js

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Función para manejar errores
handle_error() {
    log_error "Error en línea $1"
    log_error "El script falló. Revisa el error anterior."
    exit 1
}

trap 'handle_error $LINENO' ERR

echo "========================================"
echo "   Reiniciando Backend Node.js"
echo "========================================"

# Navegar al directorio del backend
BACKEND_DIR="/home/ubuntu/centro-backend"
if [ ! -d "$BACKEND_DIR" ]; then
    log_error "Directorio $BACKEND_DIR no existe"
    exit 1
fi
cd "$BACKEND_DIR"
log_info "Directorio: $(pwd)"

# ============================================
# ACTUALIZAR CÓDIGO DESDE GIT
# ============================================
log_info "Actualizando código desde Git..."

# Fetch primero para ver el estado
git fetch origin

# Verificar si hay ramas divergentes
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
BASE=$(git merge-base HEAD origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    log_info "El código ya está actualizado"
elif [ "$LOCAL" = "$BASE" ]; then
    log_info "Actualizando con pull..."
    git pull origin main
elif [ "$REMOTE" = "$BASE" ]; then
    log_warn "Hay commits locales no pusheados"
    log_warn "Reseteando a origin/main..."
    git reset --hard origin/main
else
    log_warn "Ramas divergentes detectadas"
    log_warn "Reseteando a origin/main..."
    git reset --hard origin/main
fi

log_info "Commit actual: $(git log --oneline -1)"

# ============================================
# DETENER PROCESOS PM2
# ============================================
log_info "Deteniendo procesos PM2..."

if pm2 list 2>/dev/null | grep -q "online\|stopped"; then
    pm2 stop all 2>/dev/null || true
    pm2 delete all 2>/dev/null || true
    log_info "Procesos PM2 detenidos"
else
    log_info "No hay procesos PM2 ejecutándose"
fi

# Verificar que no queden procesos
sleep 1
if pm2 list 2>/dev/null | grep -q "online"; then
    log_warn "Aún hay procesos corriendo, forzando eliminación..."
    pm2 kill
    sleep 2
fi

# ============================================
# INSTALAR DEPENDENCIAS
# ============================================
if [ -f "package.json" ]; then
    log_info "Instalando dependencias..."

    # Solo reinstalar si package.json cambió o no existe node_modules
    if [ ! -d "node_modules" ]; then
        log_info "node_modules no existe, instalando..."
        npm install --production
    else
        log_info "Actualizando dependencias..."
        npm install --production
    fi

    if [ $? -eq 0 ]; then
        log_info "Dependencias instaladas correctamente"
    else
        log_error "Error instalando dependencias"
        exit 1
    fi
else
    log_error "package.json no encontrado"
    exit 1
fi

# ============================================
# VERIFICAR ARCHIVO .env
# ============================================
if [ ! -f ".env" ]; then
    log_error "Archivo .env no encontrado"
    exit 1
fi
log_info "Archivo .env encontrado"

# ============================================
# INICIAR BACKEND
# ============================================
log_info "Iniciando backend con PM2..."

pm2 start index.js --name "centro-backend" --max-memory-restart 500M

# Esperar a que inicie
sleep 3

# Verificar que esté corriendo
if pm2 list | grep -q "centro-backend.*online"; then
    log_info "Backend iniciado correctamente"
else
    log_error "El backend no inició correctamente"
    log_error "Logs de PM2:"
    pm2 logs centro-backend --lines 20 --nostream
    exit 1
fi

# ============================================
# VERIFICAR HEALTH CHECK
# ============================================
log_info "Verificando health check..."
sleep 2

HEALTH_URL="http://localhost:5000/api/health"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    log_info "Health check OK (HTTP $HTTP_CODE)"
else
    log_warn "Health check falló (HTTP $HTTP_CODE)"
    log_warn "El servidor puede estar iniciando aún. Verifica manualmente."
fi

# ============================================
# RESUMEN
# ============================================
echo ""
echo "========================================"
log_info "Backend reiniciado exitosamente"
echo "========================================"
pm2 list
echo ""
log_info "Para ver logs: pm2 logs centro-backend"
