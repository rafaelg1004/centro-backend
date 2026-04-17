// ============================================
// MODELOS SEQUELIZE - DMAMITAS
// Exporta todos los modelos configurados
// ============================================

const { sequelize } = require("../database/config");
const { DataTypes } = require("sequelize");

// Importar definiciones de modelos
const definePaciente = require("./Paciente");
const defineCodigoCUPS = require("./CodigoCUPS");
const defineValoracionFisioterapia = require("./ValoracionFisioterapia");
const defineClase = require("./Clase");
const defineClaseNino = require("./ClaseNino");
const defineEvolucionSesion = require("./EvolucionSesion");
const definePagoPaquete = require("./PagoPaquete");
const defineSesionMensual = require("./SesionMensual");
const defineSesionMensualAsistente = require("./SesionMensualAsistente");
const defineLog = require("./Log");
const defineUsuario = require("./Usuario");
const defineCIE10 = require("./CIE10");
const defineCupsCatalogo = require("./CupsCatalogo");

// Definir modelos
const Paciente = definePaciente(sequelize, DataTypes);
const CodigoCUPS = defineCodigoCUPS(sequelize, DataTypes);
const ValoracionFisioterapia = defineValoracionFisioterapia(
  sequelize,
  DataTypes,
);
const Clase = defineClase(sequelize, DataTypes);
const ClaseNino = defineClaseNino(sequelize, DataTypes);
const EvolucionSesion = defineEvolucionSesion(sequelize, DataTypes);
const PagoPaquete = definePagoPaquete(sequelize, DataTypes);
const SesionMensual = defineSesionMensual(sequelize, DataTypes);
const SesionMensualAsistente = defineSesionMensualAsistente(
  sequelize,
  DataTypes,
);
const Log = defineLog(sequelize, DataTypes);
const Usuario = defineUsuario(sequelize, DataTypes);
const CIE10 = defineCIE10(sequelize, DataTypes);
const CupsCatalogo = defineCupsCatalogo(sequelize, DataTypes);

// ============================================
// DEFINIR RELACIONES
// ============================================

// Paciente -> Valoraciones (1:N)
Paciente.hasMany(ValoracionFisioterapia, {
  foreignKey: "paciente_id",
  as: "valoraciones",
});
ValoracionFisioterapia.belongsTo(Paciente, {
  foreignKey: "paciente_id",
  as: "paciente",
});

// Paciente -> Evoluciones (1:N)
Paciente.hasMany(EvolucionSesion, {
  foreignKey: "paciente_id",
  as: "evoluciones",
});
EvolucionSesion.belongsTo(Paciente, {
  foreignKey: "paciente_id",
  as: "paciente",
});

// Paciente -> PagoPaquetes (1:N)
Paciente.hasMany(PagoPaquete, {
  foreignKey: "paciente_id",
  as: "pagos_paquete",
});
PagoPaquete.belongsTo(Paciente, {
  foreignKey: "paciente_id",
  as: "paciente",
});

// Clase <-> Paciente (N:M) a través de ClaseNino
Clase.belongsToMany(Paciente, {
  through: ClaseNino,
  foreignKey: "clase_id",
  otherKey: "paciente_id",
  as: "ninos",
});
Paciente.belongsToMany(Clase, {
  through: ClaseNino,
  foreignKey: "paciente_id",
  otherKey: "clase_id",
  as: "clases",
});

// Relaciones directas para includes
Clase.hasMany(ClaseNino, {
  foreignKey: "clase_id",
  as: "clase_ninos",
});
ClaseNino.belongsTo(Clase, {
  foreignKey: "clase_id",
  as: "clase",
});
ClaseNino.belongsTo(Paciente, {
  foreignKey: "paciente_id",
  as: "paciente",
});

// SesionMensual <-> Paciente (N:M) a través de SesionMensualAsistente
SesionMensual.belongsToMany(Paciente, {
  through: SesionMensualAsistente,
  foreignKey: "sesion_mensual_id",
  otherKey: "paciente_id",
  as: "asistentes",
});
Paciente.belongsToMany(SesionMensual, {
  through: SesionMensualAsistente,
  foreignKey: "paciente_id",
  otherKey: "sesion_mensual_id",
  as: "sesiones_mensuales",
});

// Relaciones directas
SesionMensual.hasMany(SesionMensualAsistente, {
  foreignKey: "sesion_mensual_id",
  as: "sesion_asistentes",
});
SesionMensualAsistente.belongsTo(SesionMensual, {
  foreignKey: "sesion_mensual_id",
  as: "sesion_mensual",
});
SesionMensualAsistente.belongsTo(Paciente, {
  foreignKey: "paciente_id",
  as: "paciente",
});

// Valoracion -> Evoluciones (1:N)
ValoracionFisioterapia.hasMany(EvolucionSesion, {
  foreignKey: "valoracion_id",
  as: "evoluciones",
});
EvolucionSesion.belongsTo(ValoracionFisioterapia, {
  foreignKey: "valoracion_id",
  as: "valoracion",
});

// Log -> Paciente (N:1 opcional)
Log.belongsTo(Paciente, {
  foreignKey: "paciente_id",
  as: "paciente_obj",
});

module.exports = {
  sequelize,
  Paciente,
  CodigoCUPS,
  ValoracionFisioterapia,
  Clase,
  ClaseNino,
  EvolucionSesion,
  PagoPaquete,
  SesionMensual,
  SesionMensualAsistente,
  Log,
  Usuario,
  CIE10,
  CupsCatalogo,
};
