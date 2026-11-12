const express = require("express");
const router = express.Router();
const {
  PlantillaHC,
  SeccionHC,
  CampoHC,
  OpcionCampoHC,
  TipoCampoHC,
} = require("../models-sequelize");
const { sembrarPlantillaPediatria } = require("../scripts/seed-plantilla-pediatria");

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

