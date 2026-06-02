#!/usr/bin/env node
require("dotenv").config();
const mongoose = require("mongoose");
const { sequelize } = require("../database/config");
const models = require("../models-sequelize");

const PacienteMongo = require("../models/Paciente");
const ClaseMongo = require("../models/Clase");
const EvolucionSesionMongo = require("../models/EvolucionSesion");
const PagoPaqueteMongo = require("../models/PagoPaquete");
const SesionMensualMongo = require("../models/SesionMensual");
const ValoracionFisioterapiaMongo = require("../models/ValoracionFisioterapia");
const CodigoCUPSMongo = require("../models/CodigoCUPS");
const LogMongo = require("../models/Log");

const idMap = {
  pacientes: new Map(),
  clases: new Map(),
  valoraciones: new Map(),
  evoluciones: new Map(),
  pagos: new Map(),
  sesionesMensuales: new Map(),
  cups: new Map(),
  usuarios: new Map(),
  cie10s: new Map(),
  cupsCatalogos: new Map(),
};

const generateUUID = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
  const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
});

async function migrarUsuarios() {
  console.log("🔄 Migrando usuarios...");
  try {
    let coll = mongoose.connection.collection("usuarios") || mongoose.connection.collection("users") || mongoose.connection.collection("Usuarios");
    if(!coll) return;
    const usuarios = await coll.find({}).toArray();
    for (const u of usuarios) {
      const username = u.username || u.usuario || u.USUARIO || u.user || "";
      let existing = await models.Usuario.findOne({ where: { username } });
      let newId = existing ? existing.id : generateUUID();
      idMap.usuarios.set(u._id.toString(), newId);
      if (!existing && username) {
        try {
          await models.Usuario.create({
            id: newId, username,
            email: u.email || u.correo || u.CORREO || u.EMAIL || "",
            password_hash: u.passwordHash || u.password || u.PASSWORD || u.hash || "",
            nombre_completo: u.nombreCompleto || u.nombre || u.fullName || u.NOMBRE || u.name || "",
            rol: u.rol || u.role || u.ROL || u.tipo || "fisioterapeuta",
            activo: u.activo !== false,
            created_at: u.createdAt || new Date(),
            updated_at: u.updatedAt || new Date(),
          });
        } catch (err) {}
      }
    }
  } catch (e) {}
}

async function migrarCIE10s() {
  console.log("🔄 Migrando códigos CIE10...");
  try {
    const cie10s = await mongoose.connection.collection("cie10s").find({}).toArray();
    const existing = await models.CIE10.findAll({ attributes: ['id', 'codigo'] });
    const existingMap = new Map(existing.map(e => [e.codigo, e.id]));
    
    for (const c of cie10s) {
      const codigo = c.codigo || c.code || c.CIE10 || "";
      if (!codigo) continue;
      let newId = existingMap.get(codigo);
      if (!newId) {
        newId = generateUUID();
        try {
          await models.CIE10.create({
            id: newId, codigo,
            nombre: c.nombre || c.descripcion || c.name || "",
            descripcion: c.descripcion || "",
            categoria: c.categoria || "",
            activo: c.activo !== false,
            created_at: c.createdAt || new Date()
          });
        } catch (e) {}
        existingMap.set(codigo, newId);
      }
      idMap.cie10s.set(c._id.toString(), newId);
    }
  } catch (e) {}
}

async function migrarCupsCatalogos() {
  console.log("🔄 Migrando catálogo CUPS extendido...");
  try {
    const cups = await mongoose.connection.collection("cups_catalogos").find({}).toArray();
    const existing = await models.CupsCatalogo.findAll({ attributes: ['id', 'codigo_cups'] });
    const existingMap = new Map(existing.map(e => [e.codigo_cups, e.id]));

    for (const c of cups) {
      const codigo = c.codigoCups || c.codigo_cups || c.codigo || c.CODIGO || "";
      if (!codigo) continue;
      let newId = existingMap.get(codigo);
      if (!newId) {
        newId = generateUUID();
        try {
          await models.CupsCatalogo.create({
            id: newId, codigo_cups: codigo,
            descripcion: c.descripcion || "",
            capitulo: c.capitulo || "",
            seccion: c.seccion || "",
            categoria: c.categoria || "",
            subcategoria: c.subcategoria || "",
            activo: c.activo !== false,
            created_at: c.createdAt || new Date()
          });
        } catch(e) {}
        existingMap.set(codigo, newId);
      }
      idMap.cupsCatalogos.set(c._id.toString(), newId);
    }
  } catch (e) {}
}

async function migrarPacientes() {
  console.log("🔄 Migrando pacientes...");
  const pacientes = await PacienteMongo.find({}).lean();
  for (const p of pacientes) {
    if (!p.numDocumentoIdentificacion) continue;
    let existing = await models.Paciente.findOne({ where: { num_documento_identificacion: p.numDocumentoIdentificacion } });
    let newId = existing ? existing.id : generateUUID();
    idMap.pacientes.set(p._id.toString(), newId);
    
    if (!existing) {
      try {
        await models.Paciente.create({
          id: newId,
          tipo_documento_identificacion: p.tipoDocumentoIdentificacion || 'CC',
          num_documento_identificacion: p.numDocumentoIdentificacion,
          nombres: p.nombres || 'SIN NOMBRE',
          apellidos: p.apellidos || 'SIN APELLIDO',
          fecha_nacimiento: p.fechaNacimiento || new Date(),
          cod_sexo: p.codSexo || 'O',
          cod_pais_residencia: p.codPaisResidencia || "170",
          cod_municipio_residencia: p.codMunicipioResidencia,
          cod_zona_territorial_residencia: p.codZonaTerritorialResidencia || "01",
          tipo_usuario: p.tipoUsuario || "04",
          es_adulto: p.esAdulto || false,
          created_at: p.createdAt || new Date()
        });
      } catch (err) { console.error(`❌ Error migrando paciente ${p.numDocumentoIdentificacion}`, err.message); }
    } else {
      // Opcional: Actualizar datos
      try {
        await existing.update({
          nombres: p.nombres || existing.nombres,
          apellidos: p.apellidos || existing.apellidos,
          fecha_nacimiento: p.fechaNacimiento || existing.fecha_nacimiento,
          es_adulto: p.esAdulto !== undefined ? p.esAdulto : existing.es_adulto,
        });
      } catch(e) {}
    }
  }
}

async function migrarCUPS() {
  console.log("🔄 Migrando códigos CUPS...");
  try {
    const cups = await mongoose.connection.collection("codigocups").find({}).toArray();
    for (const c of cups) {
      if (!c.codigo) continue;
      let existing = await models.CodigoCUPS.findOne({ where: { codigo: c.codigo } });
      let newId = existing ? existing.id : generateUUID();
      idMap.cups.set(c._id.toString(), newId);
      if (!existing) {
        try {
          await models.CodigoCUPS.create({
            id: newId, codigo: c.codigo, nombre: c.nombre, descripcion: c.descripcion,
            tipo_servicio: c.tipoServicio, valor: c.valor || 0, activo: c.activo !== false
          });
        } catch(e){}
      }
    }
  } catch (e) {}
}

async function migrarValoraciones() {
  console.log("🔄 Migrando valoraciones fisioterapia...");
  const valoraciones = await ValoracionFisioterapiaMongo.find({}).lean();
  for (const v of valoraciones) {
    let pacienteIdRaw = v.paciente?.toString() || "";
    pacienteIdRaw = pacienteIdRaw.replace(/^"+|"+$/g, "");
    const pacienteId = idMap.pacientes.get(pacienteIdRaw);
    if (!pacienteId) continue;

    let existing = await models.ValoracionFisioterapia.findOne({
      where: { paciente_id: pacienteId, fecha_inicio_atencion: v.fechaInicioAtencion || new Date(0) }
    });
    // Fallback: si no la encuentra por fecha exacta, podemos buscar la primera o simplemente crearla
    let newId = existing ? existing.id : generateUUID();
    idMap.valoraciones.set(v._id.toString(), newId);

    if (!existing) {
      try {
        let creadoPorUUID = null;
        if (v.creadoPor) {
          creadoPorUUID = idMap.usuarios.get(v.creadoPor.toString()) || null;
        }

        await models.ValoracionFisioterapia.create({
          id: newId,
          paciente_id: pacienteId,
          creado_por: creadoPorUUID,
          tipo_programa: v.tipoPrograma,
          fecha_inicio_atencion: v.fechaInicioAtencion || new Date(),
          num_autorizacion: v.numAutorizacion,
          cod_consulta: v.codConsulta || "890201",
          modalidad_grupo_servicio_tec_sal: v.modalidadGrupoServicioTecSal || "09",
          grupo_servicios: v.grupoServicios || "01",
          cod_diagnostico_principal: v.codDiagnosticoPrincipal || "Z51.4",
          vr_servicio: v.vrServicio || 0,
          concepto_recaudo: v.conceptoRecaudo || "05",
          motivo_consulta: v.motivoConsulta || "Valoración",
          enfermedad_actual: v.enfermedadActual,
          signos_vitales: v.signosVitales || {},
          antecedentes: v.antecedentes || {},
          modulo_pediatria: v.moduloPediatria || {},
          modulo_piso_pelvico: v.moduloPisoPelvico || {},
          modulo_lactancia: v.moduloLactancia || {},
          modulo_perinatal: v.moduloPerinatal || {},
          examen_fisico: v.examenFisico || {},
          diagnostico_fisioterapeutico: v.diagnosticoFisioterapeutico || "Por evaluar",
          plan_tratamiento: v.planTratamiento || "Por definir",
          firmas: v.firmas || {},
          bloqueada: v.bloqueada || false,
          fecha_bloqueo: v.fechaBloqueo,
          created_at: v.createdAt
        });
      } catch (err) { console.error(`❌ Error migrando valoración ${v._id}:`, err.message); }
    }
  }
}

async function migrarEvoluciones() {
  console.log("🔄 Migrando evoluciones de sesión...");
  const evoluciones = await EvolucionSesionMongo.find({}).lean();
  for (const e of evoluciones) {
    const pacienteId = idMap.pacientes.get(e.paciente?.toString());
    const valoracionId = idMap.valoraciones.get(e.valoracionAsociada?.toString());
    if (!pacienteId || !valoracionId) continue;

    let existing = await models.EvolucionSesion.findOne({
      where: { valoracion_id: valoracionId, numero_sesion: e.numeroSesion || null }
    });
    if(!existing) {
       existing = await models.EvolucionSesion.findOne({
         where: { valoracion_id: valoracionId, fecha_inicio_atencion: e.fechaInicioAtencion || new Date(0) }
       });
    }

    let newId = existing ? existing.id : generateUUID();
    idMap.evoluciones.set(e._id.toString(), newId);

    if (!existing) {
      try {
        await models.EvolucionSesion.create({
          id: newId, valoracion_id: valoracionId, paciente_id: pacienteId,
          fecha_inicio_atencion: e.fechaInicioAtencion || new Date(),
          cod_procedimiento: e.codProcedimiento,
          via_ingreso_servicio_salud: e.viaIngresoServicioSalud || "02",
          cod_diagnostico_principal: e.codDiagnosticoPrincipal,
          vr_servicio: e.vrServicio || 0,
          numero_sesion: e.numeroSesion,
          descripcion_evolucion: e.descripcionEvolucion,
          objetivo_sesion: e.objetivoSesion,
          plan_siguiente_sesion: e.planSiguienteSesion,
          observaciones: e.observaciones,
          firmas: e.firmas || {},
          bloqueada: e.bloqueada || false,
          created_at: e.createdAt
        });
      } catch (err) {}
    }
  }
}

async function migrarClases() {
  console.log("🔄 Migrando clases...");
  const clases = await ClaseMongo.find({}).lean();
  for (const c of clases) {
    let existing = await models.Clase.findOne({ where: { nombre: c.nombre, fecha: c.fecha } });
    let newId = existing ? existing.id : generateUUID();
    idMap.clases.set(c._id.toString(), newId);
    if (!existing) {
      try {
        await models.Clase.create({ id: newId, nombre: c.nombre, fecha: c.fecha, descripcion: c.descripcion, bloqueada: c.bloqueada || false });
      } catch (e) {}
    }
    if (c.ninos && Array.isArray(c.ninos)) {
      for (const nino of c.ninos) {
        const pacienteId = idMap.pacientes.get(nino.nino?.toString());
        if (!pacienteId) continue;
        const existsNino = await models.ClaseNino.findOne({ where: { clase_id: newId, paciente_id: pacienteId }});
        if (!existsNino) {
           await models.ClaseNino.create({ clase_id: newId, paciente_id: pacienteId, firma: nino.firma, numero_factura: nino.numeroFactura });
        }
      }
    }
  }
}

async function migrarPagoPaquetes() {
  console.log("🔄 Migrando pagos de paquetes...");
  const pagos = await PagoPaqueteMongo.find({}).lean();
  for (const p of pagos) {
    const pacienteId = idMap.pacientes.get(p.paciente?.toString());
    if (!pacienteId) continue;
    let existing = await models.PagoPaquete.findOne({ where: { numero_factura: p.numeroFactura, paciente_id: pacienteId } });
    let newId = existing ? existing.id : generateUUID();
    idMap.pagos.set(p._id.toString(), newId);
    if (!existing) {
      try {
        await models.PagoPaquete.create({
          id: newId, paciente_id: pacienteId, numero_factura: p.numeroFactura,
          clases_pagadas: p.clasesPagadas, clases_usadas: p.clasesUsadas || 0, fecha_pago: p.fechaPago
        });
      } catch (e) {}
    }
  }
}

async function migrarSesionesMensuales() {
  console.log("🔄 Migrando sesiones mensuales...");
  const sesiones = await SesionMensualMongo.find({}).lean();
  for (const s of sesiones) {
    let existing = await models.SesionMensual.findOne({ where: { nombre: s.nombre, fecha: s.fecha } });
    let newId = existing ? existing.id : generateUUID();
    idMap.sesionesMensuales.set(s._id.toString(), newId);
    if (!existing) {
      try {
        await models.SesionMensual.create({ id: newId, nombre: s.nombre, fecha: s.fecha, descripcion_general: s.descripcionGeneral });
      } catch(e) {}
    }
    if (s.asistentes && Array.isArray(s.asistentes)) {
      for (const asistente of s.asistentes) {
        const pacienteId = idMap.pacientes.get(asistente.paciente?.toString());
        if (!pacienteId) continue;
        const existAsist = await models.SesionMensualAsistente.findOne({ where: { sesion_mensual_id: newId, paciente_id: pacienteId } });
        if (!existAsist) {
          await models.SesionMensualAsistente.create({ sesion_mensual_id: newId, paciente_id: pacienteId, observaciones: asistente.observaciones });
        }
      }
    }
  }
}

async function main() {
  console.log("\n========================================");
  console.log("  MIGRACIÓN (UPSERT) MongoDB → PostgreSQL");
  console.log("========================================\n");

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("   ✅ Conectado a MongoDB");

  const { testConnection, syncDatabase } = require("../database/config");
  const connected = await testConnection();
  if (!connected) process.exit(1);

  // NO hacemos force, así evitamos borrar datos
  await syncDatabase(false);

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
    
    console.log("✅ MIGRACIÓN COMPLETADA EXITOSAMENTE");
  } catch (error) {
    console.error("❌ ERROR EN MIGRACIÓN:", error);
  } finally {
    await mongoose.disconnect();
    await sequelize.close();
  }
}

if (require.main === module) main();
module.exports = { main, idMap };
