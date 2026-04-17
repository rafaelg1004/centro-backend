-- ============================================
-- ACTUALIZAR TABLA USUARIOS - AGREGAR COLUMNAS FALTANTES
-- Sin borrar datos existentes
-- ============================================

-- Agregar columnas faltantes a tabla usuarios
ALTER TABLE usuarios 
  ADD COLUMN IF NOT EXISTS nombre VARCHAR(200),
  ADD COLUMN IF NOT EXISTS registro_medico VARCHAR(100),
  ADD COLUMN IF NOT EXISTS firma_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(200),
  ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMP WITH TIME ZONE;

-- Verificar que las columnas existen
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'usuarios'
ORDER BY ordinal_position;
