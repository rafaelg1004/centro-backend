const express = require("express");
const router = express.Router();
const {
  sequelize,
  PlantillaHC,
  SeccionHC,
  CampoHC,
  OpcionCampoHC,
  TipoCampoHC,
} = require("../models-sequelize");
const { sembrarPlantillaPediatria } = require("../scripts/seed-plantilla-pediatria");

// Helper para asegurar la tabla de bloques de seguimiento configurados por programa
async function asegurarTablaSeguimientoBloques() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS plantillas_seguimiento_bloques (
      programa VARCHAR(80) PRIMARY KEY,
      bloques JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// Limpia respuestas de pacientes dejando solo la estructura configurable (preguntas y columnas/filas vacías)
function limpiarEstructuraBloques(bloques) {
  if (!Array.isArray(bloques)) return [];
  return bloques.map((b) => {
    if (b.tipoBloque === "pregunta") {
      return {
        id: b.id,
        tipoBloque: "pregunta",
        pregunta: b.pregunta || "",
        respuesta: "",
      };
    }
    const cols = Array.isArray(b.columnas) && b.columnas.length > 0
      ? b.columnas
      : ["Fecha / Parámetro", "Medición / Avance", "Observaciones"];
    return {
      id: b.id,
      tipoBloque: "tabla",
      titulo: b.titulo || "Tabla de Progreso",
      columnas: cols,
      filas: [new Array(cols.length).fill("")],
    };
  });
}

/**
 * @route   GET /api/plantillas
 * @desc    Obtener todas las plantillas activas
 */
router.get("/", async (req, res) => {
  try {
    const plantillas = await PlantillaHC.findAll({
      where: { activa: true },
      order: [["orden", "ASC"]],
    });
    res.json(plantillas);
  } catch (error) {
    // Si las tablas aún no han sido creadas/sembradas, devolver lista vacía en vez de 500
    if (error?.original?.code === "42P01" || String(error?.message || "").includes("does not exist")) {
      return res.json([]);
    }
    console.error("Error obteniendo plantillas:", error);
    res.status(500).json({ error: "Error al obtener plantillas" });
  }
});

/**
 * @route   GET /api/plantillas/seguimiento-bloques/:programa
 * @desc    Obtener preguntas y tablas configuradas por defecto para seguimientos de un programa
 */
router.get("/seguimiento-bloques/:programa", async (req, res) => {
  try {
    const programa = String(req.params.programa || "").toUpperCase();
    await asegurarTablaSeguimientoBloques();
    const [rows] = await sequelize.query(
      `SELECT programa, bloques FROM plantillas_seguimiento_bloques WHERE programa = $1`,
      { bind: [programa] }
    );
    const bloques = rows && rows[0] && Array.isArray(rows[0].bloques) ? rows[0].bloques : [];
    res.json({ programa, bloques });
  } catch (error) {
    console.error("Error obteniendo bloques de seguimiento:", error);
    res.json({ programa: req.params.programa, bloques: [] });
  }
});

/**
 * @route   PUT /api/plantillas/seguimiento-bloques/:programa
 * @desc    Guardar la estructura de preguntas y tablas de seguimiento para reutilizarla en futuros controles
 */
router.put("/seguimiento-bloques/:programa", async (req, res) => {
  try {
    const programa = String(req.params.programa || "").toUpperCase();
    const bloquesLimpios = limpiarEstructuraBloques(req.body?.bloques);
    await asegurarTablaSeguimientoBloques();

    await sequelize.query(
      `INSERT INTO plantillas_seguimiento_bloques (programa, bloques, updated_at)
       VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (programa)
       DO UPDATE SET bloques = EXCLUDED.bloques, updated_at = CURRENT_TIMESTAMP`,
      { bind: [programa, JSON.stringify(bloquesLimpios)] }
    );

    res.json({ programa, bloques: bloquesLimpios });
  } catch (error) {
    console.error("Error guardando bloques de seguimiento:", error);
    res.status(500).json({ error: "No se pudieron guardar los bloques de seguimiento" });
  }
});

const TIPOS_CAMPO_ESTANDAR = [
  { codigo: "text", nombre: "Texto corto", descripcion: "Entrada de una línea" },
  { codigo: "textarea", nombre: "Texto largo", descripcion: "Párrafo o descripción extensa" },
  { codigo: "number", nombre: "Número", descripcion: "Valor numérico" },
  { codigo: "select", nombre: "Lista desplegable", descripcion: "Selección única entre opciones" },
  { codigo: "checkbox", nombre: "Casilla Sí/No", descripcion: "Interruptor booleano" },
  { codigo: "checkbox_group", nombre: "Selección múltiple", descripcion: "Varias casillas de selección" },
  { codigo: "date", nombre: "Fecha", descripcion: "Selector de fecha" },
  { codigo: "datetime-local", nombre: "Fecha y hora", descripcion: "Selector de fecha y hora" },
  { codigo: "cie10", nombre: "Diagnóstico CIE-10", descripcion: "Buscador de códigos CIE-10" },
  { codigo: "cups", nombre: "Procedimiento CUPS", descripcion: "Buscador de procedimientos CUPS" },
  { codigo: "firma", nombre: "Firma digital", descripcion: "Panel de firma manuscrita" },
  { codigo: "bloques_dinamicos", nombre: "Preguntas y tablas libres", descripcion: "Bloques dinámicos de seguimiento" },
  { codigo: "hidden", nombre: "Campo oculto", descripcion: "Metadato interno del formulario" },
];

async function asegurarTablasRelacionales() {
  await TipoCampoHC.sync();
  await PlantillaHC.sync();
  await SeccionHC.sync();
  await CampoHC.sync();
  await OpcionCampoHC.sync();
  for (const t of TIPOS_CAMPO_ESTANDAR) {
    await TipoCampoHC.findOrCreate({
      where: { codigo: t.codigo },
      defaults: t,
    });
  }
}

async function guardarEstructuraPlantilla(plantillaId, secciones, transaction) {
  const seccionesPrevias = await SeccionHC.findAll({
    where: { plantilla_id: plantillaId },
    attributes: ["id"],
    transaction,
  });
  const seccionIds = seccionesPrevias.map((s) => s.id);
  if (seccionIds.length > 0) {
    const camposPrevios = await CampoHC.findAll({
      where: { seccion_id: seccionIds },
      attributes: ["id"],
      transaction,
    });
    const campoIds = camposPrevios.map((c) => c.id);
    if (campoIds.length > 0) {
      await OpcionCampoHC.destroy({ where: { campo_id: campoIds }, transaction });
      await CampoHC.destroy({ where: { id: campoIds }, transaction });
    }
    await SeccionHC.destroy({ where: { id: seccionIds }, transaction });
  }

  for (let sIdx = 0; sIdx < (secciones || []).length; sIdx++) {
    const sec = secciones[sIdx];
    const seccionCreada = await SeccionHC.create(
      {
        plantilla_id: plantillaId,
        titulo: sec.titulo || `Sección ${sIdx + 1}`,
        siempre_visible: !!sec.siempreVisible,
        orden: sIdx + 1,
      },
      { transaction }
    );

    const campos = Array.isArray(sec.campos) ? sec.campos : [];
    for (let cIdx = 0; cIdx < campos.length; cIdx++) {
      const c = campos[cIdx];
      const tipoCodigo = c.tipo || "text";
      const {
        nombre,
        etiqueta,
        tipo,
        requerido,
        lecsolo,
        autoNow,
        placeholder,
        valorPorDefecto,
        opciones,
        ...restoConfig
      } = c;

      const configExtra = { ...restoConfig };
      let valorDefectoStr = null;
      if (valorPorDefecto !== undefined && valorPorDefecto !== "") {
        if (typeof valorPorDefecto === "string") {
          valorDefectoStr = valorPorDefecto;
        } else {
          configExtra.valorPorDefectoTipado = valorPorDefecto;
        }
      }

      const campoCreado = await CampoHC.create(
        {
          seccion_id: seccionCreada.id,
          codigo_path: nombre || `campo_${sIdx + 1}_${cIdx + 1}`,
          etiqueta: etiqueta || nombre || `Pregunta ${cIdx + 1}`,
          tipo_campo_codigo: tipoCodigo,
          requerido: !!requerido,
          solo_lectura: !!lecsolo,
          auto_now: !!autoNow,
          placeholder: placeholder || null,
          valor_defecto: valorDefectoStr,
          configuracion_extra: configExtra,
          orden: cIdx + 1,
          activo: true,
        },
        { transaction }
      );

      if (Array.isArray(opciones) && opciones.length > 0) {
        for (let oIdx = 0; oIdx < opciones.length; oIdx++) {
          const op = opciones[oIdx];
          const valor = typeof op === "object" ? op.valor ?? op.etiqueta : String(op);
          const etiq = typeof op === "object" ? op.etiqueta ?? op.valor : String(op);
          await OpcionCampoHC.create(
            {
              campo_id: campoCreado.id,
              valor: String(valor ?? ""),
              etiqueta: String(etiq ?? ""),
              orden: oIdx + 1,
            },
            { transaction }
          );
        }
      }
    }
  }
}

/**
 * @route   GET /api/plantillas/tipos-campo
 * @desc    Listar los tipos de campo disponibles para el constructor de plantillas
 */
router.get("/tipos-campo", async (req, res) => {
  try {
    await asegurarTablasRelacionales();
    const tipos = await TipoCampoHC.findAll({ order: [["codigo", "ASC"]] });
    res.json(tipos);
  } catch (error) {
    console.error("Error obteniendo tipos de campo:", error);
    res.json(TIPOS_CAMPO_ESTANDAR);
  }
});

/**
 * @route   POST /api/plantillas
 * @desc    Crear una nueva plantilla dinámica con secciones, campos y opciones
 */
router.post("/", async (req, res) => {
  try {
    await asegurarTablasRelacionales();
    const { codigo, nombre, titulo, tipo_programa, descripcion, secciones } = req.body || {};
    const codigoLimpio = String(codigo || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]+/g, "_");
    const nombreFinal = String(nombre || titulo || "").trim();

    if (!codigoLimpio || !nombreFinal) {
      return res.status(400).json({ error: "El código y el nombre de la plantilla son obligatorios." });
    }

    const existente = await PlantillaHC.findOne({ where: { codigo: codigoLimpio } });
    if (existente) {
      return res.status(409).json({ error: `Ya existe una plantilla con el código "${codigoLimpio}".` });
    }

    const creada = await sequelize.transaction(async (t) => {
      const plantilla = await PlantillaHC.create(
        {
          codigo: codigoLimpio,
          nombre: nombreFinal,
          tipo_programa: tipo_programa || "General",
          descripcion: descripcion || "",
          activa: true,
          orden: 10,
        },
        { transaction: t }
      );
      await guardarEstructuraPlantilla(plantilla.id, secciones || [], t);
      return plantilla;
    });

    res.status(201).json(creada);
  } catch (error) {
    console.error("Error creando plantilla:", error);
    res.status(500).json({ error: error.message || "Error al crear plantilla" });
  }
});

/**
 * @route   PUT /api/plantillas/:id
 * @desc    Actualizar una plantilla existente y toda su estructura de secciones/campos
 */
router.put("/:id", async (req, res) => {
  try {
    await asegurarTablasRelacionales();
    const { id } = req.params;
    const where = id.includes("-") ? { id } : { codigo: id };
    const plantilla = await PlantillaHC.findOne({ where });
    if (!plantilla) {
      return res.status(404).json({ error: "Plantilla no encontrada" });
    }

    const { nombre, titulo, tipo_programa, descripcion, secciones, activa } = req.body || {};
    await sequelize.transaction(async (t) => {
      await plantilla.update(
        {
          nombre: String(nombre || titulo || plantilla.nombre).trim(),
          tipo_programa: tipo_programa !== undefined ? tipo_programa : plantilla.tipo_programa,
          descripcion: descripcion !== undefined ? descripcion : plantilla.descripcion,
          activa: activa !== undefined ? !!activa : plantilla.activa,
        },
        { transaction: t }
      );
      if (Array.isArray(secciones)) {
        await guardarEstructuraPlantilla(plantilla.id, secciones, t);
      }
    });

    res.json({ mensaje: "Plantilla actualizada correctamente", plantilla });
  } catch (error) {
    console.error("Error actualizando plantilla:", error);
    res.status(500).json({ error: error.message || "Error al actualizar plantilla" });
  }
});

/**
 * @route   DELETE /api/plantillas/:id
 * @desc    Desactivar una plantilla existente
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const where = id.includes("-") ? { id } : { codigo: id };
    const plantilla = await PlantillaHC.findOne({ where });
    if (!plantilla) {
      return res.status(404).json({ error: "Plantilla no encontrada" });
    }
    await plantilla.update({ activa: false });
    res.json({ mensaje: "Plantilla desactivada correctamente" });
  } catch (error) {
    console.error("Error desactivando plantilla:", error);
    res.status(500).json({ error: "Error al desactivar plantilla" });
  }
});

/**
 * @route   GET /api/plantillas/:id/esquema
 * @desc    Obtener el esquema completo relacional (Plantilla -> Secciones -> Campos -> Opciones)
 *          formateado para DynamicFormBuilder y DynamicDetailBuilder
 */
router.get("/:id/esquema", async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar por ID o por código (ej: PEDIATRIA_INICIAL)
    const where = id.includes("-") ? { id } : { codigo: id };
    const plantilla = await PlantillaHC.findOne({
      where,
      include: [
        {
          model: SeccionHC,
          as: "secciones",
          include: [
            {
              model: CampoHC,
              as: "campos",
              where: { activo: true },
              required: false,
              include: [
                {
                  model: OpcionCampoHC,
                  as: "opciones",
                  required: false,
                },
                {
                  model: TipoCampoHC,
                  as: "tipo_info",
                  required: false,
                },
              ],
            },
          ],
        },
      ],
      order: [
        [{ model: SeccionHC, as: "secciones" }, "orden", "ASC"],
        [{ model: SeccionHC, as: "secciones" }, { model: CampoHC, as: "campos" }, "orden", "ASC"],
        [{ model: SeccionHC, as: "secciones" }, { model: CampoHC, as: "campos" }, { model: OpcionCampoHC, as: "opciones" }, "orden", "ASC"],
      ],
    });

    if (!plantilla) {
      return res.status(404).json({ error: "Plantilla no encontrada" });
    }

    // Transformar a formato esperado por DynamicFormBuilder
    const esquemaFormulario = {
      id: plantilla.id,
      codigo: plantilla.codigo,
      titulo: plantilla.nombre,
      tipo_programa: plantilla.tipo_programa,
      endpoint: "/valoraciones",
      redireccion: "/valoraciones",
      secciones: (plantilla.secciones || []).map((sec) => ({
        titulo: sec.titulo,
        siempreVisible: !!sec.siempre_visible,
        campos: (sec.campos || []).map((c) => {
          const { valorPorDefectoTipado, ...cfg } = c.configuracion_extra || {};
          const opciones = (c.opciones || []).map((o) => ({
            valor: o.valor,
            etiqueta: o.etiqueta,
          }));

          const campo = {
            ...cfg, // presets, autoCalc, condicion, dependeDe, oculto, descripcion...
            nombre: c.codigo_path,
            etiqueta: c.etiqueta,
            tipo: c.tipo_campo_codigo,
          };
          if (c.requerido) campo.requerido = true;
          if (c.solo_lectura) campo.lecsolo = true;
          if (c.auto_now) campo.autoNow = true;
          if (c.placeholder) campo.placeholder = c.placeholder;
          if (valorPorDefectoTipado !== undefined) campo.valorPorDefecto = valorPorDefectoTipado;
          else if (c.valor_defecto !== null) campo.valorPorDefecto = c.valor_defecto;
          if (opciones.length > 0) campo.opciones = opciones;
          return campo;
        }),
      })),
    };

    res.json(esquemaFormulario);
  } catch (error) {
    console.error("Error obteniendo esquema de plantilla:", error);
    res.status(500).json({ error: "Error al construir esquema dinámico" });
  }
});

/**
 * @route   POST /api/plantillas/sincronizar-pediatria
 * @desc    Ruta administrativa para ejecutar el sembrado inicial en producción
 */
router.post("/sincronizar-pediatria", async (req, res) => {
  try {
    await sembrarPlantillaPediatria();
    res.json({ mensaje: "Plantilla de Pediatría sincronizada correctamente en base de datos." });
  } catch (error) {
    console.error("Error sincronizando plantilla de pediatría:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

