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

