// ============================================================
// SCRIPT: Reparar valoraciones perinatales con RIPS incompletos
// ============================================================
// Uso:
//   node scripts/reparar-valoraciones-perinatales.js
//     (modo dry-run: lista las afectadas sin tocar nada)
//
//   node scripts/reparar-valoraciones-perinatales.js --apply
//     (aplica correcciones por defecto: finalidad=10, causa=22, diagnostico=Z348)
//
//   node scripts/reparar-valoraciones-perinatales.js --apply --diagnostico Z349 --finalidad 10 --causa 22
//     (valores personalizados)
//
//   node scripts/reparar-valoraciones-perinatales.js --id <UUID> --apply --diagnostico Z349
//     (reparar solo una valoracion especifica)
//
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Sequelize, Op } = require("sequelize");

const args = process.argv.slice(2);
const applyMode = args.includes("--apply");
const targetId = getArgValue("--id");
const diagnosticoDefault = getArgValue("--diagnostico") || "Z348";
const finalidadDefault = getArgValue("--finalidad") || "10";
const causaDefault = getArgValue("--causa") || "22";

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
}

const sequelize = new Sequelize(
  process.env.PGDATABASE || "dmamitas",
  process.env.PGUSER || "postgres",
  process.env.PGPASSWORD || "",
  {
    host: process.env.PGHOST || "localhost",
    port: process.env.PGPORT || 5432,
    dialect: "postgres",
    logging: false,
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true,
    },
  },
);

const ValoracionFisioterapia = sequelize.define(
  "ValoracionFisioterapia",
  {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    paciente_id: { type: Sequelize.UUID, allowNull: false },
    tipo_programa: Sequelize.STRING(50),
    fecha_inicio_atencion: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    num_autorizacion: Sequelize.STRING(50),
    cod_consulta: Sequelize.STRING(255),
    modalidad_grupo_servicio_tec_sal: Sequelize.STRING(2),
    grupo_servicios: Sequelize.STRING(2),
    finalidad_tecnologia_salud: Sequelize.STRING(10),
    causa_motivo_atencion: Sequelize.STRING(10),
    cod_diagnostico_principal: Sequelize.STRING(255),
    tipo_diagnostico_principal: Sequelize.STRING(2),
    vr_servicio: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
    concepto_recaudo: Sequelize.STRING(2),
    motivo_consulta: Sequelize.TEXT,
    enfermedad_actual: Sequelize.TEXT,
    signos_vitales: { type: Sequelize.JSONB, defaultValue: {} },
    antecedentes: { type: Sequelize.JSONB, defaultValue: {} },
    modulo_pediatria: { type: Sequelize.JSONB, defaultValue: {} },
    modulo_piso_pelvico: { type: Sequelize.JSONB, defaultValue: {} },
    modulo_lactancia: { type: Sequelize.JSONB, defaultValue: {} },
    modulo_perinatal: { type: Sequelize.JSONB, defaultValue: {} },
    examen_fisico: { type: Sequelize.JSONB, defaultValue: {} },
    diagnostico_fisioterapeutico: Sequelize.TEXT,
    plan_tratamiento: Sequelize.TEXT,
    firmas: { type: Sequelize.JSONB, defaultValue: {} },
    bloqueada: { type: Sequelize.BOOLEAN, defaultValue: false },
    fecha_bloqueo: Sequelize.DATE,
    sello_integridad: Sequelize.STRING(256),
    audit_trail: { type: Sequelize.JSONB, defaultValue: {} },
    datos_legacy: { type: Sequelize.JSONB, allowNull: true },
  },
  { tableName: "valoraciones_fisioterapia", timestamps: true, underscored: true },
);

const EvolucionSesion = sequelize.define(
  "EvolucionSesion",
  {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    valoracion_id: { type: Sequelize.UUID, allowNull: false },
    paciente_id: { type: Sequelize.UUID, allowNull: false },
    fecha_inicio_atencion: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    cod_procedimiento: { type: Sequelize.STRING(20), allowNull: false },
    via_ingreso_servicio_salud: { type: Sequelize.STRING(2), defaultValue: "02" },
    finalidad_tecnologia_salud: { type: Sequelize.STRING(2), allowNull: false },
    cod_diagnostico_principal: { type: Sequelize.STRING(10), allowNull: false },
    vr_servicio: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
    numero_sesion: { type: Sequelize.INTEGER, allowNull: false },
    descripcion_evolucion: { type: Sequelize.TEXT, allowNull: false },
    objetivo_sesion: Sequelize.TEXT,
    plan_siguiente_sesion: Sequelize.TEXT,
    observaciones: Sequelize.TEXT,
    firmas: { type: Sequelize.JSONB, defaultValue: {} },
    bloqueada: { type: Sequelize.BOOLEAN, defaultValue: false },
    fecha_bloqueo: Sequelize.DATE,
    sello_integridad: Sequelize.STRING(256),
    audit_trail: { type: Sequelize.JSONB, defaultValue: {} },
  },
  { tableName: "evoluciones_sesion", timestamps: true, underscored: true },
);

const CIE10 = sequelize.define(
  "CIE10",
  {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    codigo: { type: Sequelize.STRING(20), allowNull: false, unique: true },
    nombre: { type: Sequelize.STRING(500), allowNull: false },
    descripcion: Sequelize.TEXT,
    categoria: Sequelize.STRING(100),
    sexo_restringido: Sequelize.STRING(1),
    edad_minima: Sequelize.INTEGER,
    edad_maxima: Sequelize.INTEGER,
    activo: { type: Sequelize.BOOLEAN, defaultValue: true },
  },
  { tableName: "cie10s", timestamps: true, underscored: true },
);

async function obtenerDescripcionCIE10(codigo) {
  const codigoLimpio = String(codigo || "").split(" ")[0].trim().toUpperCase();
  if (!codigoLimpio) return null;
  const row = await CIE10.findOne({
    where: { codigo: codigoLimpio },
    attributes: ["nombre", "descripcion"],
  });
  return row ? (row.nombre || row.descripcion) : null;
}

function formatearDiagnostico(codigo, descripcion) {
  const codigoLimpio = String(codigo || "").split(" ")[0].trim().toUpperCase();
  const descLimpia = String(descripcion || "").trim();
  if (!descLimpia) return codigoLimpio;
  return `${codigoLimpio} - ${descLimpia}`;
}

async function main() {
  try {
    await sequelize.authenticate();
    console.log("✅ Conectado a PostgreSQL");

    let whereClause = {
      cod_consulta: { [Op.iLike]: "890211%" },
    };

    if (targetId) {
      whereClause.id = targetId;
    }

    const valoraciones = await ValoracionFisioterapia.findAll({ where: whereClause });

    console.log(`\n🔍 Valoraciones perinatales encontradas: ${valoraciones.length}`);

    const aReparar = valoraciones.filter((v) => {
      const codDiagnostico = v.cod_diagnostico_principal || "";
      const finalidad = v.finalidad_tecnologia_salud || "";
      const causa = v.causa_motivo_atencion || "";
      // Si se especifica un ID, forzar la corrección
      if (targetId) return true;
      return !codDiagnostico || !finalidad || !causa || finalidad !== finalidadDefault || causa !== causaDefault;
    });

    if (aReparar.length === 0) {
      console.log("✅ No se encontraron valoraciones perinatales con RIPS incompletos.");
      await sequelize.close();
      return;
    }

    console.log(`⚠️  Valoraciones que requieren reparación: ${aReparar.length}\n`);

    for (const v of aReparar) {
      const codConsulta = String(v.cod_consulta || "").split(" ")[0].trim();
      console.log(`- ID: ${v.id}`);
      console.log(`  paciente_id: ${v.paciente_id}`);
      console.log(`  cod_consulta: ${v.cod_consulta || "(vacío)"}`);
      console.log(`  finalidad_tecnologia_salud: ${v.finalidad_tecnologia_salud || "(vacío)"}  → ${finalidadDefault}`);
      console.log(`  causa_motivo_atencion: ${v.causa_motivo_atencion || "(vacío)"}  → ${causaDefault}`);
      console.log(`  cod_diagnostico_principal: ${v.cod_diagnostico_principal || "(vacío)"}  → ${diagnosticoDefault}`);
      console.log(`  fecha_inicio_atencion: ${v.fecha_inicio_atencion || "(vacío)"}`);
      console.log("");
    }

    if (!applyMode) {
      console.log("\n🛑 Modo DRY-RUN. No se realizaron cambios.");
      console.log(`   Ejecuta con --apply para aplicar las correcciones.`);
      console.log(`   Ejemplo: node scripts/reparar-valoraciones-perinatales.js --apply --diagnostico ${diagnosticoDefault}`);
      await sequelize.close();
      return;
    }

    console.log("\n🛠️ Aplicando correcciones...\n");

    for (const v of aReparar) {
      const codConsulta = v.cod_consulta || `890211 - CONSULTA DE PRIMERA VEZ POR ESPECIALISTA EN MEDICINA FISICA Y REHABILITACION`;
      const codDiagnosticoLimpio = String(diagnosticoDefault || "").split(" ")[0].trim().toUpperCase();
      const descripcionCIE10 = await obtenerDescripcionCIE10(codDiagnosticoLimpio);
      const diagnosticoConDescripcion = formatearDiagnostico(codDiagnosticoLimpio, descripcionCIE10);

      await v.update({
        cod_consulta: codConsulta,
        finalidad_tecnologia_salud: finalidadDefault,
        causa_motivo_atencion: causaDefault,
        cod_diagnostico_principal: diagnosticoConDescripcion,
      });

      console.log(`✅ Valoración ${v.id} reparada.`);
      console.log(`   Diagnóstico: ${diagnosticoConDescripcion}`);

      // Propagar corrección a las sesiones/evoluciones asociadas
      const sesiones = await EvolucionSesion.findAll({ where: { valoracion_id: v.id } });
      if (sesiones.length > 0) {
        for (const s of sesiones) {
          await s.update({
            cod_procedimiento: "890204",
            finalidad_tecnologia_salud: finalidadDefault,
            cod_diagnostico_principal: diagnosticoConDescripcion,
          });
        }
        console.log(`   └─ ${sesiones.length} sesión(es) asociada(s) actualizada(s).`);
      }
    }

    console.log("\n🎉 Reparación completada.");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
