#!/usr/bin/env node
/**
 * ============================================
 * SCRIPT: Re-migrar valoraciones con errores
 * ============================================
 * Migra solo las 4 valoraciones que fallaron por varchar(20)
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { sequelize } = require("../database/config");
const models = require("../models-sequelize");

// IDs de las valoraciones que fallaron por varchar(20)
const VALORACIONES_FALLIDAS_VARCHAR = [
  "69acd53dac463453d8fd4e17",
  "69b04528fd6b3a826c6bad86",
  "69b86cc270b7ad51840eb0e0",
  "69b99b7f70b7ad51840eb2a0",
];

// IDs de las valoraciones que fallaron por UUID con comillas
const VALORACIONES_FALLIDAS_UUID = [
  "69bed0e9ab53294e86a6910f",
  "69cadd9fab53294e86a69c22",
  "69d67b1cab53294e86a6a6e8",
  "69d96c2e4aacdcfce1e04351",
  "69dd4e1c4aacdcfce1e0481e",
  "69dfab074aacdcfce1e05212",
];

// Combinar todas
const VALORACIONES_FALLIDAS = [
  ...VALORACIONES_FALLIDAS_VARCHAR,
  ...VALORACIONES_FALLIDAS_UUID,
];

async function main() {
  console.log("\n========================================");
  console.log("  RE-MIGRACIÓN DE VALORACIONES FALLIDAS");
  console.log("========================================\n");

  // Conectar a MongoDB
  console.log("🔗 Conectando a MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("   ✅ Conectado a MongoDB\n");

  // Leer todos los pacientes de PostgreSQL para buscar por documento
  const pacientesPG = await models.Paciente.findAll({
    attributes: ["id", "num_documento_identificacion"],
  });
  const pacientesPorDoc = new Map();
  for (const p of pacientesPG) {
    pacientesPorDoc.set(p.num_documento_identificacion, p.id);
  }

  console.log(`📋 ${pacientesPorDoc.size} pacientes en PostgreSQL`);
  console.log(
    `🎯 Re-migrando ${VALORACIONES_FALLIDAS.length} valoraciones fallidas...\n`,
  );

  const valoracionCollection = mongoose.connection.collection(
    "valoracionfisioterapias",
  );
  let exitosos = 0;

  for (const mongoId of VALORACIONES_FALLIDAS) {
    try {
      // Buscar en MongoDB
      const v = await valoracionCollection.findOne({
        _id: new mongoose.Types.ObjectId(mongoId),
      });

      if (!v) {
        console.log(`   Valoración ${mongoId} no encontrada en MongoDB`);
        continue;
      }

      // Buscar paciente (limpiar comillas si las hay)
      let pacienteMongoId = v.paciente?.toString() || "";
      pacienteMongoId = pacienteMongoId.replace(/^"+|"+$/g, ""); // Quitar comillas extra

      // Validar que el ID es un ObjectId válido de MongoDB (24 hex chars)
      if (!pacienteMongoId.match(/^[0-9a-fA-F]{24}$/)) {
        console.log(
          `   ❌ Valoración ${mongoId}: ID de paciente inválido: ${pacienteMongoId}`,
        );
        continue;
      }

      // Buscar paciente en MongoDB para obtener su número de documento
      const pacienteCollection = mongoose.connection.collection("pacientes");
      const pacienteMongo = await pacienteCollection.findOne({
        _id: new mongoose.Types.ObjectId(pacienteMongoId),
      });

      if (!pacienteMongo) {
        console.log(
          `   Valoración ${mongoId}: paciente ${pacienteMongoId} no existe en MongoDB`,
        );
        continue;
      }

      // Buscar en PostgreSQL por número de documento
      const numDoc =
        pacienteMongo.numDocumentoIdentificacion ||
        pacienteMongo.num_documento_identificacion;
      let pacienteUUID = pacientesPorDoc.get(numDoc);

      if (!pacienteUUID) {
        console.log(
          `   Valoración ${mongoId}: paciente con documento ${numDoc} no encontrado en PostgreSQL`,
        );
        continue;
      }

      // Verificar si ya existe en PostgreSQL (por paciente y fecha)
      const existente = await models.ValoracionFisioterapia.findOne({
        where: {
          paciente_id: pacienteUUID,
          fecha_inicio_atencion: v.fechaInicioAtencion || new Date(),
        },
      });

      if (existente) {
        console.log(`   ℹ️ Valoración ${mongoId} ya existe, actualizando...`);
        await existente.destroy(); // Eliminar para recrear
      }

      // Limpiar creado_por - si es ObjectId de MongoDB (24 chars) o no es UUID válido, poner null
      let creadoPorLimpio = v.creadoPor;
      if (creadoPorLimpio && typeof creadoPorLimpio === "string") {
        creadoPorLimpio = creadoPorLimpio.replace(/^"+|"+$/g, "");
        // Verificar si es UUID válido (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
        const esUUID =
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
            creadoPorLimpio,
          );
        // Si es ObjectId de MongoDB (24 hex chars) o no es UUID, poner null
        const esObjectId = /^[0-9a-fA-F]{24}$/.test(creadoPorLimpio);
        if (!esUUID || esObjectId) {
          creadoPorLimpio = null;
        }
      } else {
        creadoPorLimpio = null;
      }

      // Crear con datos corregidos (truncar códigos largos)
      const codDiagnostico = (v.codDiagnosticoPrincipal || "Z51.4")
        .toString()
        .substring(0, 20);

      await models.ValoracionFisioterapia.create({
        paciente_id: pacienteUUID,
        creado_por: creadoPorLimpio,
        tipo_programa: v.tipoPrograma,
        fecha_inicio_atencion: v.fechaInicioAtencion || new Date(),
        num_autorizacion: v.numAutorizacion,
        cod_consulta: (v.codConsulta || "890201").toString().substring(0, 50),
        modalidad_grupo_servicio_tec_sal:
          v.modalidadGrupoServicioTecSal || "09",
        grupo_servicios: v.grupoServicios || "01",
        finalidad_tecnologia_salud: (v.finalidadTecnologiaSalud || "11")
          .toString()
          .substring(0, 10),
        causa_motivo_atencion: (v.causaMotivoAtencion || "13")
          .toString()
          .substring(0, 10),
        cod_diagnostico_principal: codDiagnostico, // Truncado a 20 chars
        tipo_diagnostico_principal: v.tipoDiagnosticoPrincipal || "01",
        vr_servicio: v.vrServicio || 0,
        concepto_recaudo: v.conceptoRecaudo || "05",
        motivo_consulta: v.motivoConsulta || "Valoración fisioterapéutica",
        enfermedad_actual: v.enfermedadActual,
        signos_vitales: v.signosVitales || {},
        antecedentes: v.antecedentes || {},
        modulo_pediatria: v.moduloPediatria || {},
        modulo_piso_pelvico: v.moduloPisoPelvico || {},
        modulo_lactancia: v.moduloLactancia || {},
        modulo_perinatal: v.moduloPerinatal || {},
        examen_fisico: v.examenFisico || {},
        diagnostico_fisioterapeutico:
          v.diagnosticoFisioterapeutico || "Por evaluar",
        plan_tratamiento: v.planTratamiento || "Por definir",
        firmas: v.firmas || {},
        bloqueada: v.bloqueada || false,
        fecha_bloqueo: v.fechaBloqueo,
        sello_integridad: v.selloIntegridad,
        audit_trail: v.auditTrail || {},
        created_at: v.createdAt,
        updated_at: v.updatedAt,
      });

      console.log(`   ✅ Valoración ${mongoId} migrada correctamente`);
      exitosos++;
    } catch (err) {
      console.log(`   ❌ Error migrando ${mongoId}: ${err.message}`);
    }
  }

  console.log(`\n========================================`);
  console.log(
    `  ✅ ${exitosos}/${VALORACIONES_FALLIDAS.length} valoraciones re-migradas`,
  );
  console.log(`========================================\n`);

  await mongoose.disconnect();
  await sequelize.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
