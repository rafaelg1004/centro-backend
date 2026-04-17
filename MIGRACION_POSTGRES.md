# 🚀 Migración MongoDB → PostgreSQL

Este documento describe el proceso completo de migración de la base de datos desde MongoDB a PostgreSQL.

## 📋 Resumen de Cambios

Se ha creado una arquitectura completa para PostgreSQL usando Sequelize ORM con todas las tablas relacionales necesarias:

### Nuevos Archivos Creados

```
Backend/
├── database/
│   ├── config.js              # Configuración de Sequelize
│   └── schema.sql             # Esquema SQL completo
├── models-sequelize/
│   ├── index.js               # Exporta todos los modelos con relaciones
│   ├── Paciente.js            # Modelo de pacientes
│   ├── ValoracionFisioterapia.js
│   ├── EvolucionSesion.js
│   ├── Clase.js
│   ├── ClaseNino.js
│   ├── PagoPaquete.js
│   ├── SesionMensual.js
│   ├── SesionMensualAsistente.js
│   ├── CodigoCUPS.js
│   └── Log.js
└── scripts/
    ├── migrate-mongo-to-postgres.js  # Script de migración de datos
    └── sync-database.js              # Sincroniza estructura de BD
```

## 🗄️ Esquema de Base de Datos (PostgreSQL)

### Tablas Principales

| Tabla | Descripción | Relaciones |
|-------|-------------|------------|
| `pacientes` | Datos de pacientes (RIPS) | Principal |
| `codigos_cups` | Catálogo de códigos CUPS | Independiente |
| `valoraciones_fisioterapia` | Valoraciones médicas | paciente_id |
| `evoluciones_sesion` | Evoluciones de sesiones | valoracion_id, paciente_id |
| `clases` | Sesiones de clase/estimulación | - |
| `clase_ninos` | Relación N:M clases-pacientes | clase_id, paciente_id |
| `sesiones_mensuales` | Sesiones mensuales | - |
| `sesion_mensual_asistentes` | Asistentes a sesiones | sesion_mensual_id, paciente_id |
| `pago_paquetes` | Pagos de paquetes | paciente_id |
| `logs` | Logs de auditoría | paciente_id (opcional) |

## 🚀 Pasos para la Migración

### 1. Preparar el Servidor PostgreSQL

```bash
# Instalar PostgreSQL (ejemplo en Ubuntu)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Crear base de datos
sudo -u postgres createdb dmamitas
sudo -u postgres createuser --interactive  # Crear usuario

# Configurar contraseña
sudo -u postgres psql -c "ALTER USER tu_usuario WITH PASSWORD 'tu_password';"
```

### 2. Configurar Variables de Entorno

Editar el archivo `.env`:

```env
# PostgreSQL
PGHOST=localhost
PGPORT=5432
PGDATABASE=dmamitas
PGUSER=tu_usuario
PGPASSWORD=tu_password

# Modo de BD (durante migración puedes usar 'both')
DB_MODE=postgres
```

### 3. Instalar Dependencias

```bash
cd Backend
npm install
```

### 4. Crear Estructura de Base de Datos

```bash
# Crear las tablas según los modelos Sequelize
npm run sync-db
```

Para forzar recreación (⚠️ borra datos):
```bash
npm run sync-db -- --force
```

### 5. Migrar los Datos desde MongoDB

```bash
# Ejecutar script de migración
npm run migrate
```

Este script:
- Conecta a MongoDB
- Conecta a PostgreSQL
- Migra todos los datos manteniendo las relaciones
- Genera nuevos UUIDs para PostgreSQL
- Muestra resumen de la migración

**⚠️ Nota:** Asegúrate de que MongoDB esté accesible durante la migración.

## 🔄 Actualizar el Backend para usar PostgreSQL

### Opción A: Migración Completa (Recomendado)

Reemplazar todas las consultas de Mongoose por Sequelize en las rutas.

Ejemplo de conversión:

```javascript
// ANTES (MongoDB/Mongoose)
const paciente = await Paciente.findById(id);
const pacientes = await Paciente.find({ esAdulto: false });

// DESPUÉS (PostgreSQL/Sequelize)
const { Paciente } = require('../models-sequelize');
const paciente = await Paciente.findByPk(id);
const pacientes = await Paciente.findAll({ where: { es_adulto: false } });
```

### Opción B: Modo Dual (Transición)

Durante la transición, puedes usar ambas bases de datos:

```javascript
// En las rutas, verificar DB_MODE
if (process.env.DB_MODE === 'postgres') {
  // Usar Sequelize
} else {
  // Usar Mongoose
}
```

## 📊 Diferencias Clave MongoDB vs PostgreSQL

| MongoDB | PostgreSQL | Notas |
|---------|------------|-------|
| `_id` (ObjectId) | `id` (UUID) | Nuevos UUIDs generados |
| Campos camelCase | Campos snake_case | Ej: `tipoDocumentoIdentificacion` → `tipo_documento_identificacion` |
| Documentos embebidos | Tablas separadas o JSONB | Relaciones N:M en tablas pivote |
| Sin esquema fijo | Esquema rígido | Validación en nivel de BD |
| `find()` | `findAll()` | Sequelize usa nombres diferentes |
| `findById()` | `findByPk()` | Primary Key |

## 🛠️ Comandos Útiles

```bash
# Sincronizar estructura de BD
npm run sync-db

# Forzar recreación de tablas (⚠️ peligroso)
npm run sync-db -- --force

# Migrar datos desde MongoDB
npm run migrate

# Verificar conexión PostgreSQL
node -e "require('./database/config').testConnection().then(console.log)"
```

## ⚠️ Consideraciones Importantes

1. **Backup**: Siempre hacer backup de MongoDB antes de migrar
2. **UUIDs**: Los IDs cambian de ObjectId a UUID - esto es irreversible
3. **Índices**: El esquema SQL incluye índices optimizados para búsquedas comunes
4. **JSONB**: Campos complejos (antecedentes, módulos, etc.) se almacenan como JSONB
5. **Relaciones**: Las referencias (ObjectId) se convierten a foreign keys reales

## 🔧 Solución de Problemas

### Error de conexión a PostgreSQL
```bash
# Verificar que PostgreSQL esté corriendo
sudo service postgresql status

# Verificar configuración de pg_hba.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf
# Cambiar 'peer' o 'md5' según necesidad
```

### Error en migración
```bash
# Ejecutar con más detalle de errores
DEBUG=* node scripts/migrate-mongo-to-postgres.js
```

## 📈 Performance

- PostgreSQL tiene mejor rendimiento para consultas complejas con joins
- Índices GIN en campos JSONB permiten búsquedas rápidas dentro de JSON
- Foreign keys garantizan integridad referencial
- Transacciones ACID para operaciones críticas

## ✅ Checklist Post-Migración

- [ ] Todas las tablas creadas en PostgreSQL
- [ ] Datos migrados correctamente
- [ ] Índices creados
- [ ] Aplicación backend actualizada para usar Sequelize
- [ ] Pruebas de consultas básicas funcionando
- [ ] Backup de MongoDB guardado
- [ ] Variables de entorno actualizadas en producción

---

¿Necesitas ayuda con algún paso específico de la migración?
