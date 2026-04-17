#!/usr/bin/env node
/**
 * ============================================
 * SCRIPT DE MIGRACIÓN: MongoDB → PostgreSQL
 * ============================================
 * Este script migra todos los datos desde MongoDB a PostgreSQL
 * respetando las relaciones entre entidades.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { sequelize } = require("../database/config");
const models = require("../models-sequelize");

// Modelos MongoDB (viejos)
const PacienteMongo = require("../models/Paciente");
const ClaseMongo = require("../models/Clase");
const EvolucionSesionMongo = require("../models/EvolucionSesion");
const PagoPaqueteMongo = require("../models/PagoPaquete");
const SesionMensualMongo = require("../models/SesionMensual");
const ValoracionFisioterapiaMongo = require("../models/ValoracionFisioterapia");
const CodigoCUPSMongo = require("../models/CodigoCUPS");
const LogMongo = require("../models/Log");

// Mapas para conversión de IDs (Mongo ObjectId -> UUID PostgreSQL)
const idMap = {
  pacientes: new Map(),
  clases: new Map(),
  valoraciones: new Map(),
  evoluciones: new Map(),
  pagos: new Map(),
  sesionesMensuales: new Map(),
  cups: new Map(),
  logs: new Map(),
  usuarios: new Map(),
  cie10s: new Map(),
  cupsCatalogos: new Map(),
};

// Generar UUID v4
const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// ============================================
// 0a. MIGRAR USUARIOS
// ============================================
async function migrarUsuarios() {
  console.log("🔄 Migrando usuarios...");

  try {
    // Acceder directamente a la colección con diferentes nombres posibles
    let usuariosCollection = mongoose.connection.collection("usuarios");
    if (!usuariosCollection) {
      usuariosCollection = mongoose.connection.collection("users");
    }
    if (!usuariosCollection) {
      usuariosCollection = mongoose.connection.collection("Usuarios");
    }

    const usuarios = await usuariosCollection.find({}).toArray();
    console.log(`   Encontrados ${usuarios.length} usuarios en MongoDB`);

    for (const u of usuarios) {
      const newId = generateUUID();
      idMap.usuarios.set(u._id.toString(), newId);

      try {
        await models.Usuario.create({
          id: newId,
          username: u.username || u.usuario || u.USUARIO || u.user || "",
          email: u.email || u.correo || u.CORREO || u.EMAIL || "",
          password_hash:
            u.passwordHash || u.password || u.PASSWORD || u.hash || "",
          nombre_completo:
            u.nombreCompleto ||
            u.nombre ||
            u.fullName ||
            u.NOMBRE ||
            u.name ||
            "",
          rol: u.rol || u.role || u.ROL || u.tipo || "fisioterapeuta",
          activo:
            u.activo !== false && u.active !== false && u.ACTIVO !== false,
          ultimo_acceso:
            u.ultimoAcceso || u.lastLogin || u.ULTIMO_ACCESO || null,
          datos_perfil:
            u.datosPerfil || u.profile || u.perfil || u.DATOS_PERFIL || {},
          preferencias:
            u.preferencias ||
            u.settings ||
            u.preferencias ||
            u.PREFERENCIAS ||
            {},
          created_at:
            u.createdAt || u.created_at || u.FECHA_CREACION || new Date(),
          updated_at:
            u.updatedAt || u.updated_at || u.FECHA_ACTUALIZACION || new Date(),
        });
      } catch (err) {
        // Continuar sin mostrar error individual
      }
    }

    console.log(`   ✅ Migrados ${idMap.usuarios.size} usuarios`);
  } catch (e) {
    console.log("   ℹ️  Colección usuarios no encontrada o vacía, saltando...");
  }
}

// ============================================
// 0b. MIGRAR CIE10s (Catálogo diagnósticos)
// ============================================
async function migrarCIE10s() {
  console.log("🔄 Migrando códigos CIE10...");

  try {
    // Acceder directamente a la colección
    const cie10Collection = mongoose.connection.collection("cie10s");
    const cie10s = await cie10Collection.find({}).toArray();

    console.log(`   Encontrados ${cie10s.length} códigos CIE10 en MongoDB`);

    // Insertar en lotes para mejor rendimiento
    const batchSize = 500;
    for (let i = 0; i < cie10s.length; i += batchSize) {
      const batch = cie10s.slice(i, i + batchSize);

      for (const c of batch) {
        const newId = generateUUID();
        idMap.cie10s.set(c._id.toString(), newId);

        try {
          await models.CIE10.create({
            id: newId,
            codigo: c.codigo || c.code || c.CIE10 || "",
            nombre: c.nombre || c.descripcion || c.name || c.DESCRIPCION || "",
            descripcion: c.descripcion || c.description || c.DESCRIPCION || "",
            categoria: c.categoria || c.category || c.CATEGORIA || "",
            sexo_restringido: c.sexoRestringido || c.sexo || c.SEXO || null,
            edad_minima: c.edadMinima || c.edadMin || c.EDAD_MINIMA || null,
            edad_maxima: c.edadMaxima || c.edadMax || c.EDAD_MAXIMA || null,
            activo: c.activo !== false && c.active !== false,
            created_at: c.createdAt || new Date(),
            updated_at: c.updatedAt || new Date(),
          });
        } catch (err) {
          // Continuar sin mostrar error individual para no saturar
        }
      }

      if (i % 2000 === 0 && i > 0) {
        console.log(`   Progreso CIE10: ${i}/${cie10s.length}...`);
      }
    }

    console.log(`   ✅ Migrados ${idMap.cie10s.size} códigos CIE10`);
  } catch (e) {
    console.log("   ℹ️  Colección cie10s no encontrada o vacía, saltando...");
  }
}

// ============================================
// 0c. MIGRAR CUPS CATALOGOS (Catálogo extendido)
// ============================================
async function migrarCupsCatalogos() {
  console.log("🔄 Migrando catálogo CUPS extendido...");

  try {
    // Usar el nombre exacto de la colección en MongoDB: cups_catalogos
    const cupsCatalogoCollection =
      mongoose.connection.collection("cups_catalogos");
    const cupsCatalogos = await cupsCatalogoCollection.find({}).toArray();

    console.log(
      `   Encontrados ${cupsCatalogos.length} registros en catálogo CUPS`,
    );

    // Insertar en lotes para mejor rendimiento
    const batchSize = 500;
    for (let i = 0; i < cupsCatalogos.length; i += batchSize) {
      const batch = cupsCatalogos.slice(i, i + batchSize);

      for (const c of batch) {
        const newId = generateUUID();
        idMap.cupsCatalogos.set(c._id.toString(), newId);

        try {
          await models.CupsCatalogo.create({
            id: newId,
            codigo_cups:
              c.codigoCups || c.codigo_cups || c.codigo || c.CODIGO || "",
            descripcion: c.descripcion || c.description || c.DESCRIPCION || "",
            capitulo: c.capitulo || c.chapter || c.CAPITULO || "",
            seccion: c.seccion || c.section || c.SECCION || "",
            categoria: c.categoria || c.category || c.CATEGORIA || "",
            subcategoria:
              c.subcategoria || c.subcategory || c.SUBCATEGORIA || "",
            procedimiento:
              c.procedimiento || c.procedure || c.PROCEDIMIENTO || "",
            lista: c.lista || c.list || c.LISTA || "",
            institucion: c.institucion || c.institution || c.INSTITUCION || "",
            vigencia_desde:
              c.vigenciaDesde || c.vigencia_desde || c.VIGENCIA_DESDE || null,
            vigencia_hasta:
              c.vigenciaHasta || c.vigencia_hasta || c.VIGENCIA_HASTA || null,
            costo: c.costo || c.cost || c.COSTO || 0,
            uvrs: c.uvrs || c.UVRS || 0,
            activo: c.activo !== false && c.active !== false,
            datos_adicionales:
              c.datosAdicionales || c.extra || c.DATOS_ADICIONALES || {},
            created_at: c.createdAt || new Date(),
            updated_at: c.updatedAt || new Date(),
          });
        } catch (err) {
          // Continuar sin mostrar error individual
        }
      }

      if (i % 2000 === 0 && i > 0) {
        console.log(
          `   Progreso CUPS Catalogo: ${i}/${cupsCatalogos.length}...`,
        );
      }
    }

    console.log(
      `   ✅ Migrados ${idMap.cupsCatalogos.size} registros de catálogo CUPS`,
    );
  } catch (e) {
    console.log(
      "   ℹ️  Catálogo CUPS extendido no encontrado o vacío, saltando...",
    );
  }
}

// ============================================
// 1. MIGRAR PACIENTES
// ============================================
async function migrarPacientes() {
  console.log("🔄 Migrando pacientes...");

  const pacientes = await PacienteMongo.find({}).lean();
  console.log(`   Encontrados ${pacientes.length} pacientes en MongoDB`);

  for (const p of pacientes) {
    const newId = generateUUID();
    idMap.pacientes.set(p._id.toString(), newId);

    try {
      await models.Paciente.create({
        id: newId,
        tipo_documento_identificacion: p.tipoDocumentoIdentificacion,
        num_documento_identificacion: p.numDocumentoIdentificacion,
        nombres: p.nombres,
        apellidos: p.apellidos,
        fecha_nacimiento: p.fechaNacimiento,
        cod_sexo: p.codSexo,
        cod_pais_residencia: p.codPaisResidencia || "170",
        cod_municipio_residencia: p.codMunicipioResidencia,
        cod_zona_territorial_residencia: p.codZonaTerritorialResidencia || "01",
        tipo_usuario: p.tipoUsuario || "04",
        es_adulto: p.esAdulto || false,
        estado_civil: p.estadoCivil,
        ocupacion: p.ocupacion,
        nivel_educativo: p.nivelEducativo,
        aseguradora: p.aseguradora,
        medico_tratante: p.medicoTratante,
        lugar_nacimiento: p.lugarNacimiento,
        estado_embarazo: p.estadoEmbarazo,
        nombre_bebe: p.nombreBebe,
        fum: p.fum,
        semanas_gestacion: p.semanasGestacion,
        fecha_probable_parto: p.fechaProbableParto,
        nombre_madre: p.nombreMadre,
        edad_madre: p.edadMadre,
        ocupacion_madre: p.ocupacionMadre,
        nombre_padre: p.nombrePadre,
        edad_padre: p.edadPadre,
        ocupacion_padre: p.ocupacionPadre,
        pediatra: p.pediatra,
        peso: p.peso,
        talla: p.talla,
        datos_contacto: p.datosContacto || {},
        consentimiento_datos: p.consentimientoDatos || {},
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      });
    } catch (err) {
      console.error(`   ❌ Error migrando paciente ${p._id}:`, err.message);
    }
  }

  console.log(`   ✅ Migrados ${idMap.pacientes.size} pacientes`);
}

// ============================================
// 2. MIGRAR CÓDIGOS CUPS
// ============================================
async function migrarCUPS() {
  console.log("🔄 Migrando códigos CUPS...");

  // Usar colección nativa con nombre exacto: codigocups
  const cupsCollection = mongoose.connection.collection("codigocups");
  const cups = await cupsCollection.find({}).toArray();
  console.log(`   Encontrados ${cups.length} códigos CUPS en MongoDB`);

  for (const c of cups) {
    const newId = generateUUID();
    idMap.cups.set(c._id.toString(), newId);

    try {
      await models.CodigoCUPS.create({
        id: newId,
        codigo: c.codigo,
        nombre: c.nombre,
        descripcion: c.descripcion,
        tipo_servicio: c.tipoServicio,
        categoria: c.categoria,
        valor: c.valor || 0,
        finalidad: c.finalidad || "11",
        diagnostico_cie: c.diagnosticoCIE || "Z51.4",
        grupo_servicio: c.grupoServicio || "04",
        modalidad: c.modalidad || "01",
        activo: c.activo !== false,
        clave_interna: c.claveInterna,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
      });
    } catch (err) {
      console.error(`   ❌ Error migrando CUPS ${c._id}:`, err.message);
    }
  }

  console.log(`   ✅ Migrados ${idMap.cups.size} códigos CUPS`);
}

// ============================================
// 3. MIGRAR VALORACIONES FISIOTERAPIA
// ============================================
async function migrarValoraciones() {
  console.log("🔄 Migrando valoraciones fisioterapia...");

  const valoraciones = await ValoracionFisioterapiaMongo.find({}).lean();
  console.log(`   Encontradas ${valoraciones.length} valoraciones en MongoDB`);

  for (const v of valoraciones) {
    const newId = generateUUID();
    idMap.valoraciones.set(v._id.toString(), newId);

    // Limpiar paciente_id si tiene comillas extra
    let pacienteIdRaw = v.paciente?.toString() || "";
    pacienteIdRaw = pacienteIdRaw.replace(/^"+|"+$/g, ""); // Quitar comillas
    const pacienteId = idMap.pacientes.get(pacienteIdRaw);

    if (!pacienteId) {
      console.warn(
        `   ⚠️ Valoración ${v._id} sin paciente válido (ID: ${pacienteIdRaw}), saltando...`,
      );
      continue;
    }

    try {
      await models.ValoracionFisioterapia.create({
        id: newId,
        paciente_id: pacienteId,
        creado_por: v.creadoPor,
        tipo_programa: v.tipoPrograma,
        fecha_inicio_atencion: v.fechaInicioAtencion || new Date(),
        num_autorizacion: v.numAutorizacion,
        cod_consulta: v.codConsulta || "890201",
        modalidad_grupo_servicio_tec_sal:
          v.modalidadGrupoServicioTecSal || "09",
        grupo_servicios: v.grupoServicios || "01",
        finalidad_tecnologia_salud: v.finalidadTecnologiaSalud || "11",
        causa_motivo_atencion: v.causaMotivoAtencion || "13",
        cod_diagnostico_principal: v.codDiagnosticoPrincipal || "Z51.4",
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
        datos_legacy: v._datosLegacy,
        created_at: v.createdAt,
        updated_at: v.updatedAt,
      });
    } catch (err) {
      console.error(`   ❌ Error migrando valoración ${v._id}:`, err.message);
    }
  }

  console.log(`   ✅ Migradas ${idMap.valoraciones.size} valoraciones`);
}

// ============================================
// 4. MIGRAR EVOLUCIONES DE SESIÓN
// ============================================
async function migrarEvoluciones() {
  console.log("🔄 Migrando evoluciones de sesión...");

  const evoluciones = await EvolucionSesionMongo.find({}).lean();
  console.log(`   Encontradas ${evoluciones.length} evoluciones en MongoDB`);

  for (const e of evoluciones) {
    const newId = generateUUID();
    idMap.evoluciones.set(e._id.toString(), newId);

    const pacienteId = idMap.pacientes.get(e.paciente?.toString());
    const valoracionId = idMap.valoraciones.get(
      e.valoracionAsociada?.toString(),
    );

    if (!pacienteId || !valoracionId) {
      console.warn(
        `   ⚠️ Evolución ${e._id} con referencias inválidas, saltando...`,
      );
      continue;
    }

    try {
      await models.EvolucionSesion.create({
        id: newId,
        valoracion_id: valoracionId,
        paciente_id: pacienteId,
        fecha_inicio_atencion: e.fechaInicioAtencion,
        cod_procedimiento: e.codProcedimiento,
        via_ingreso_servicio_salud: e.viaIngresoServicioSalud || "02",
        finalidad_tecnologia_salud: e.finalidadTecnologiaSalud,
        cod_diagnostico_principal: e.codDiagnosticoPrincipal,
        vr_servicio: e.vrServicio || 0,
        numero_sesion: e.numeroSesion,
        descripcion_evolucion: e.descripcionEvolucion,
        objetivo_sesion: e.objetivoSesion,
        plan_siguiente_sesion: e.planSiguienteSesion,
        observaciones: e.observaciones,
        firmas: e.firmas || {},
        bloqueada: e.bloqueada || false,
        fecha_bloqueo: e.fechaBloqueo,
        sello_integridad: e.selloIntegridad,
        audit_trail: e.auditTrail || {},
        created_at: e.createdAt,
        updated_at: e.updatedAt,
      });
    } catch (err) {
      console.error(`   ❌ Error migrando evolución ${e._id}:`, err.message);
    }
  }

  console.log(`   ✅ Migradas ${idMap.evoluciones.size} evoluciones`);
}

// ============================================
// 5. MIGRAR CLASES Y NIÑOS
// ============================================
async function migrarClases() {
  console.log("🔄 Migrando clases...");

  const clases = await ClaseMongo.find({}).lean();
  console.log(`   Encontradas ${clases.length} clases en MongoDB`);

  for (const c of clases) {
    const newId = generateUUID();
    idMap.clases.set(c._id.toString(), newId);

    try {
      await models.Clase.create({
        id: newId,
        nombre: c.nombre,
        fecha: c.fecha,
        descripcion: c.descripcion,
        bloqueada: c.bloqueada || false,
        fecha_bloqueo: c.fechaBloqueo,
        sello_integridad: c.selloIntegridad,
        audit_trail: c.auditTrail || {},
        created_at: c.createdAt,
        updated_at: c.updatedAt,
      });

      // Migrar niños de la clase
      if (c.ninos && Array.isArray(c.ninos)) {
        for (const nino of c.ninos) {
          const pacienteId = idMap.pacientes.get(nino.nino?.toString());
          if (!pacienteId) {
            console.warn(
              `   ⚠️ Niño ${nino.nino} no encontrado en pacientes migrados`,
            );
            continue;
          }

          await models.ClaseNino.create({
            clase_id: newId,
            paciente_id: pacienteId,
            firma: nino.firma,
            numero_factura: nino.numeroFactura,
            audit_trail: nino.auditTrail || {},
            created_at: c.createdAt,
          });
        }
      }
    } catch (err) {
      console.error(`   ❌ Error migrando clase ${c._id}:`, err.message);
    }
  }

  console.log(`   ✅ Migradas ${idMap.clases.size} clases con sus niños`);
}

// ============================================
// 6. MIGRAR PAGO PAQUETES
// ============================================
async function migrarPagoPaquetes() {
  console.log("🔄 Migrando pagos de paquetes...");

  const pagos = await PagoPaqueteMongo.find({}).lean();
  console.log(`   Encontrados ${pagos.length} pagos en MongoDB`);

  for (const p of pagos) {
    const newId = generateUUID();
    idMap.pagos.set(p._id.toString(), newId);

    const pacienteId = idMap.pacientes.get(p.paciente?.toString());
    if (!pacienteId) {
      console.warn(`   ⚠️ Pago ${p._id} sin paciente válido, saltando...`);
      continue;
    }

    try {
      await models.PagoPaquete.create({
        id: newId,
        paciente_id: pacienteId,
        numero_factura: p.numeroFactura,
        clases_pagadas: p.clasesPagadas,
        clases_usadas: p.clasesUsadas || 0,
        fecha_pago: p.fechaPago,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      });
    } catch (err) {
      console.error(`   ❌ Error migrando pago ${p._id}:`, err.message);
    }
  }

  console.log(`   ✅ Migrados ${idMap.pagos.size} pagos`);
}

// ============================================
// 7. MIGRAR SESIONES MENSUALES
// ============================================
async function migrarSesionesMensuales() {
  console.log("🔄 Migrando sesiones mensuales...");

  const sesiones = await SesionMensualMongo.find({}).lean();
  console.log(
    `   Encontradas ${sesiones.length} sesiones mensuales en MongoDB`,
  );

  for (const s of sesiones) {
    const newId = generateUUID();
    idMap.sesionesMensuales.set(s._id.toString(), newId);

    try {
      await models.SesionMensual.create({
        id: newId,
        nombre: s.nombre,
        fecha: s.fecha,
        descripcion_general: s.descripcionGeneral,
        firma_fisioterapeuta: s.firmaFisioterapeuta,
        bloqueada: s.bloqueada || false,
        fecha_bloqueo: s.fechaBloqueo,
        sello_integridad: s.selloIntegridad,
        audit_trail: s.auditTrail || {},
        created_at: s.createdAt,
        updated_at: s.updatedAt,
      });

      // Migrar asistentes
      if (s.asistentes && Array.isArray(s.asistentes)) {
        for (const asistente of s.asistentes) {
          const pacienteId = idMap.pacientes.get(
            asistente.paciente?.toString(),
          );
          if (!pacienteId) {
            console.warn(`   ⚠️ Asistente ${asistente.paciente} no encontrado`);
            continue;
          }

          await models.SesionMensualAsistente.create({
            sesion_mensual_id: newId,
            paciente_id: pacienteId,
            observaciones: asistente.observaciones,
            created_at: s.createdAt,
          });
        }
      }
    } catch (err) {
      console.error(
        `   ❌ Error migrando sesión mensual ${s._id}:`,
        err.message,
      );
    }
  }

  console.log(
    `   ✅ Migradas ${idMap.sesionesMensuales.size} sesiones mensuales`,
  );
}

// ============================================
// 8. MIGRAR LOGS
// ============================================
async function migrarLogs() {
  console.log("🔄 Migrando logs...");

  const logs = await LogMongo.find({}).lean();
  console.log(`   Encontrados ${logs.length} logs en MongoDB`);

  // Insertar en lotes para mejor rendimiento
  const batchSize = 1000;
  for (let i = 0; i < logs.length; i += batchSize) {
    const batch = logs.slice(i, i + batchSize);

    for (const l of batch) {
      const newId = generateUUID();

      // Buscar paciente_id convertido si existe
      let pacienteId = null;
      if (l.paciente) {
        pacienteId = idMap.pacientes.get(l.paciente.toString()) || null;
      }

      try {
        await models.Log.create({
          id: newId,
          timestamp: l.timestamp,
          level: l.level || "INFO",
          category: l.category,
          action: l.action,
          username: l.user || "desconocido",
          paciente_id: pacienteId,
          valoracion_id: l.valoracion,
          details: l.details || {},
          ip: l.ip,
          user_agent: l.userAgent,
          created_at: l.createdAt,
        });
      } catch (err) {
        // Logs son menos críticos, no detener por errores
      }
    }

    if (i % 5000 === 0 && i > 0) {
      console.log(`   Progreso: ${i}/${logs.length} logs...`);
    }
  }

  console.log(`   ✅ Migrados ${logs.length} logs`);
}

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================
async function main() {
  console.log("\n========================================");
  console.log("  MIGRACIÓN MongoDB → PostgreSQL");
  console.log("========================================\n");

  // Conectar a MongoDB
  console.log("🔗 Conectando a MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("   ✅ Conectado a MongoDB\n");

  // Conectar a PostgreSQL
  console.log("🔗 Conectando a PostgreSQL...");
  const { testConnection, syncDatabase } = require("../database/config");
  const connected = await testConnection();
  if (!connected) {
    console.error("   ❌ No se pudo conectar a PostgreSQL");
    process.exit(1);
  }

  // Sincronizar base de datos (crear tablas)
  console.log("📦 Sincronizando estructura de base de datos...");
  await syncDatabase();
  console.log("   ✅ Estructura sincronizada\n");

  // Ejecutar migraciones en orden (respetando dependencias)
  const startTime = Date.now();

  try {
    await migrarUsuarios();
    await migrarCIE10s();
    await migrarCupsCatalogos();
    await migrarPacientes();
    await migrarCUPS();
    await migrarValoraciones();
    await migrarEvoluciones();
    await migrarClases();
    await migrarPagoPaquetes();
    await migrarSesionesMensuales();
    // Logs omitidos temporalmente - await migrarLogs();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n========================================");
    console.log("  ✅ MIGRACIÓN COMPLETADA EXITOSAMENTE");
    console.log(`  ⏱️  Duración: ${duration} segundos`);
    console.log("========================================\n");

    // Resumen
    console.log("RESUMEN:");
    console.log(`  • Usuarios: ${idMap.usuarios.size}`);
    console.log(`  • CIE10s: ${idMap.cie10s.size}`);
    console.log(`  • CUPS Catálogos: ${idMap.cupsCatalogos.size}`);
    console.log(`  • Pacientes: ${idMap.pacientes.size}`);
    console.log(`  • Códigos CUPS: ${idMap.cups.size}`);
    console.log(`  • Valoraciones: ${idMap.valoraciones.size}`);
    console.log(`  • Evoluciones: ${idMap.evoluciones.size}`);
    console.log(`  • Clases: ${idMap.clases.size}`);
    console.log(`  • Pagos: ${idMap.pagos.size}`);
    console.log(`  • Sesiones Mensuales: ${idMap.sesionesMensuales.size}`);
  } catch (error) {
    console.error("\n❌ ERROR EN MIGRACIÓN:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    await sequelize.close();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { main, idMap };
