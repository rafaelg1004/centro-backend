-- ============================================
-- ESQUEMA POSTGRESQL PARA DMAMITAS
-- Migración desde MongoDB a PostgreSQL relacional
-- ============================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. TABLA: PACIENTES
-- ============================================
CREATE TABLE pacientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Datos RIPS Obligatorios
    tipo_documento_identificacion VARCHAR(50) NOT NULL,
    num_documento_identificacion VARCHAR(50) NOT NULL UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    cod_sexo VARCHAR(20) NOT NULL,
    cod_pais_residencia VARCHAR(3) DEFAULT '170',
    cod_municipio_residencia VARCHAR(50),
    cod_zona_territorial_residencia VARCHAR(2) DEFAULT '01',
    tipo_usuario VARCHAR(2) DEFAULT '04',
    es_adulto BOOLEAN DEFAULT FALSE,
    
    -- Datos Asistenciales Adicionales
    estado_civil VARCHAR(50),
    ocupacion VARCHAR(100),
    nivel_educativo VARCHAR(100),
    aseguradora VARCHAR(100),
    medico_tratante VARCHAR(100),
    lugar_nacimiento VARCHAR(100),
    
    -- Datos Maternos
    estado_embarazo VARCHAR(50),
    nombre_bebe VARCHAR(100),
    fum VARCHAR(50),
    semanas_gestacion VARCHAR(50),
    fecha_probable_parto VARCHAR(50),
    
    -- Datos Pediátricos
    nombre_madre VARCHAR(100),
    edad_madre VARCHAR(50),
    ocupacion_madre VARCHAR(100),
    nombre_padre VARCHAR(100),
    edad_padre VARCHAR(50),
    ocupacion_padre VARCHAR(100),
    pediatra VARCHAR(100),
    peso VARCHAR(50),
    talla VARCHAR(50),
    
    -- Datos de Contacto (embebidos como JSONB por flexibilidad)
    datos_contacto JSONB DEFAULT '{}',
    
    -- Consentimiento de datos (JSONB)
    consentimiento_datos JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para pacientes
CREATE INDEX idx_pacientes_documento ON pacientes(num_documento_identificacion);
CREATE INDEX idx_pacientes_nombres ON pacientes(nombres);
CREATE INDEX idx_pacientes_apellidos ON pacientes(apellidos);
CREATE INDEX idx_pacientes_es_adulto ON pacientes(es_adulto);
CREATE INDEX idx_pacientes_busqueda ON pacientes USING gin(to_tsvector('spanish', nombres || ' ' || apellidos));

-- ============================================
-- 2. TABLA: CODIGOS_CUPS
-- ============================================
CREATE TABLE codigos_cups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    tipo_servicio VARCHAR(50) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    valor DECIMAL(12, 2) DEFAULT 0,
    finalidad VARCHAR(10) DEFAULT '11',
    diagnostico_cie VARCHAR(10) DEFAULT 'Z51.4',
    grupo_servicio VARCHAR(2) DEFAULT '04',
    modalidad VARCHAR(2) DEFAULT '01',
    activo BOOLEAN DEFAULT TRUE,
    clave_interna VARCHAR(50) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cups_categoria ON codigos_cups(categoria);
CREATE INDEX idx_cups_activo ON codigos_cups(activo);
CREATE INDEX idx_cups_clave_interna ON codigos_cups(clave_interna);

-- ============================================
-- 3. TABLA: VALORACIONES_FISIOTERAPIA
-- ============================================
CREATE TABLE valoraciones_fisioterapia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    creado_por UUID,
    
    -- Tipo de valoración
    tipo_programa VARCHAR(50),
    
    -- Datos RIPS
    fecha_inicio_atencion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    num_autorizacion VARCHAR(50),
    cod_consulta VARCHAR(50),
    modalidad_grupo_servicio_tec_sal VARCHAR(2) DEFAULT '09',
    grupo_servicios VARCHAR(2) DEFAULT '01',
    finalidad_tecnologia_salud VARCHAR(10),
    causa_motivo_atencion VARCHAR(10),
    cod_diagnostico_principal VARCHAR(20),
    tipo_diagnostico_principal VARCHAR(2) DEFAULT '01',
    vr_servicio DECIMAL(12, 2) DEFAULT 0,
    concepto_recaudo VARCHAR(2) DEFAULT '05',
    
    -- Datos clínicos
    motivo_consulta TEXT,
    enfermedad_actual TEXT,
    signos_vitales JSONB DEFAULT '{}',
    
    -- Antecedentes (JSONB para campos anidados)
    antecedentes JSONB DEFAULT '{}',
    
    -- Módulos específicos (cada uno en JSONB)
    modulo_pediatria JSONB DEFAULT '{}',
    modulo_piso_pelvico JSONB DEFAULT '{}',
    modulo_lactancia JSONB DEFAULT '{}',
    modulo_perinatal JSONB DEFAULT '{}',
    
    -- Examen físico
    examen_fisico JSONB DEFAULT '{}',
    diagnostico_fisioterapeutico TEXT,
    plan_tratamiento TEXT,
    
    -- Firmas (JSONB)
    firmas JSONB DEFAULT '{}',
    
    -- Seguridad
    bloqueada BOOLEAN DEFAULT FALSE,
    fecha_bloqueo TIMESTAMP WITH TIME ZONE,
    sello_integridad VARCHAR(256),
    audit_trail JSONB DEFAULT '{}',
    datos_legacy JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_valoraciones_paciente ON valoraciones_fisioterapia(paciente_id);
CREATE INDEX idx_valoraciones_tipo_programa ON valoraciones_fisioterapia(tipo_programa);
CREATE INDEX idx_valoraciones_fecha ON valoraciones_fisioterapia(fecha_inicio_atencion);

-- ============================================
-- 4. TABLA: CLASES
-- ============================================
CREATE TABLE clases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(200) NOT NULL,
    fecha DATE NOT NULL,
    descripcion TEXT,
    bloqueada BOOLEAN DEFAULT FALSE,
    fecha_bloqueo TIMESTAMP WITH TIME ZONE,
    sello_integridad VARCHAR(256),
    audit_trail JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_clases_fecha ON clases(fecha);

-- ============================================
-- 5. TABLA: CLASE_NINOS (relación muchos a muchos)
-- ============================================
CREATE TABLE clase_ninos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clase_id UUID NOT NULL REFERENCES clases(id) ON DELETE CASCADE,
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    firma TEXT,
    numero_factura VARCHAR(50),
    audit_trail JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(clase_id, paciente_id)
);

CREATE INDEX idx_clase_ninos_clase ON clase_ninos(clase_id);
CREATE INDEX idx_clase_ninos_paciente ON clase_ninos(paciente_id);

-- ============================================
-- 6. TABLA: EVOLUCIONES_SESION
-- ============================================
CREATE TABLE evoluciones_sesion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    valoracion_id UUID NOT NULL REFERENCES valoraciones_fisioterapia(id) ON DELETE CASCADE,
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    
    -- Datos RIPS
    fecha_inicio_atencion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    cod_procedimiento VARCHAR(20) NOT NULL,
    via_ingreso_servicio_salud VARCHAR(2) DEFAULT '02',
    finalidad_tecnologia_salud VARCHAR(2) NOT NULL,
    cod_diagnostico_principal VARCHAR(10) NOT NULL,
    vr_servicio DECIMAL(12, 2) DEFAULT 0,
    
    -- Datos asistenciales
    numero_sesion INTEGER NOT NULL,
    descripcion_evolucion TEXT NOT NULL,
    objetivo_sesion TEXT,
    plan_siguiente_sesion TEXT,
    observaciones TEXT,
    
    -- Firmas
    firmas JSONB DEFAULT '{}',
    
    -- Seguridad
    bloqueada BOOLEAN DEFAULT FALSE,
    fecha_bloqueo TIMESTAMP WITH TIME ZONE,
    sello_integridad VARCHAR(256),
    audit_trail JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_evoluciones_valoracion ON evoluciones_sesion(valoracion_id);
CREATE INDEX idx_evoluciones_paciente ON evoluciones_sesion(paciente_id);
CREATE INDEX idx_evoluciones_numero ON evoluciones_sesion(numero_sesion);

-- ============================================
-- 7. TABLA: PAGO_PAQUETES
-- ============================================
CREATE TABLE pago_paquetes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    numero_factura VARCHAR(50) NOT NULL,
    clases_pagadas INTEGER NOT NULL,
    clases_usadas INTEGER DEFAULT 0,
    fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(paciente_id, numero_factura)
);

CREATE INDEX idx_pago_paquetes_paciente ON pago_paquetes(paciente_id);
CREATE INDEX idx_pago_paquetes_factura ON pago_paquetes(numero_factura);

-- ============================================
-- 8. TABLA: SESIONES_MENSUALES
-- ============================================
CREATE TABLE sesiones_mensuales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(200) NOT NULL,
    fecha DATE NOT NULL,
    descripcion_general TEXT,
    firma_fisioterapeuta TEXT,
    bloqueada BOOLEAN DEFAULT FALSE,
    fecha_bloqueo TIMESTAMP WITH TIME ZONE,
    sello_integridad VARCHAR(256),
    audit_trail JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sesiones_mensuales_fecha ON sesiones_mensuales(fecha);

-- ============================================
-- 9. TABLA: SESION_MENSUAL_ASISTENTES
-- ============================================
CREATE TABLE sesion_mensual_asistentes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sesion_mensual_id UUID NOT NULL REFERENCES sesiones_mensuales(id) ON DELETE CASCADE,
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(sesion_mensual_id, paciente_id)
);

CREATE INDEX idx_sesion_asistentes_sesion ON sesion_mensual_asistentes(sesion_mensual_id);
CREATE INDEX idx_sesion_asistentes_paciente ON sesion_mensual_asistentes(paciente_id);

-- ============================================
-- 10. TABLA: LOGS (Auditoría)
-- ============================================
CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    level VARCHAR(10) NOT NULL DEFAULT 'INFO',
    category VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    username VARCHAR(100) DEFAULT 'desconocido',
    paciente_id UUID REFERENCES pacientes(id) ON DELETE SET NULL,
    valoracion_id VARCHAR(100),
    details JSONB DEFAULT '{}',
    ip VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX idx_logs_category ON logs(category);
CREATE INDEX idx_logs_level ON logs(level);
CREATE INDEX idx_logs_username ON logs(username);
CREATE INDEX idx_logs_paciente ON logs(paciente_id);

-- ============================================
-- 11. TABLA: USUARIOS (Autenticación)
-- ============================================
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(200),
    password_hash VARCHAR(256) NOT NULL,
    nombre VARCHAR(200),
    rol VARCHAR(50) NOT NULL DEFAULT 'usuario',
    activo BOOLEAN DEFAULT TRUE,
    ultimo_acceso TIMESTAMP WITH TIME ZONE,
    registro_medico VARCHAR(100),
    firma_url VARCHAR(500),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(200),
    intentos_fallidos INTEGER DEFAULT 0,
    bloqueado_hasta TIMESTAMP WITH TIME ZONE,
    datos_perfil JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_usuarios_username ON usuarios(username);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);

-- ============================================
-- 12. TABLA: CIE10S (Catálogo de diagnósticos)
-- ============================================
CREATE TABLE cie10s (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(500) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(100),
    sexo_restringido VARCHAR(1),
    edad_minima INTEGER,
    edad_maxima INTEGER,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cie10s_codigo ON cie10s(codigo);
CREATE INDEX idx_cie10s_activo ON cie10s(activo);
CREATE INDEX idx_cie10s_busqueda ON cie10s USING gin(to_tsvector('spanish', nombre));

-- ============================================
-- 13. TABLA: CUPS_CATALOGOS (Catálogo extendido CUPS)
-- ============================================
CREATE TABLE cups_catalogos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_cups VARCHAR(20) NOT NULL,
    descripcion TEXT NOT NULL,
    capitulo VARCHAR(200),
    seccion VARCHAR(200),
    categoria VARCHAR(200),
    subcategoria VARCHAR(200),
    procedimiento VARCHAR(500),
    lista VARCHAR(50),
    institucion VARCHAR(200),
    vigencia_desde DATE,
    vigencia_hasta DATE,
    costo DECIMAL(12, 2),
    uvrs DECIMAL(10, 2),
    activo BOOLEAN DEFAULT TRUE,
    datos_adicionales JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cups_catalogos_codigo ON cups_catalogos(codigo_cups);
CREATE INDEX idx_cups_catalogos_activo ON cups_catalogos(activo);
CREATE INDEX idx_cups_catalogos_busqueda ON cups_catalogos USING gin(to_tsvector('spanish', descripcion || ' ' || COALESCE(procedimiento, '')));

-- ============================================
-- TRIGGER: Actualizar updated_at automáticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger a todas las tablas que necesitan updated_at
CREATE TRIGGER update_pacientes_updated_at BEFORE UPDATE ON pacientes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cups_updated_at BEFORE UPDATE ON codigos_cups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_valoraciones_updated_at BEFORE UPDATE ON valoraciones_fisioterapia FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clases_updated_at BEFORE UPDATE ON clases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_evoluciones_updated_at BEFORE UPDATE ON evoluciones_sesion FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pago_paquetes_updated_at BEFORE UPDATE ON pago_paquetes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sesiones_mensuales_updated_at BEFORE UPDATE ON sesiones_mensuales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cie10s_updated_at BEFORE UPDATE ON cie10s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cups_catalogos_updated_at BEFORE UPDATE ON cups_catalogos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
