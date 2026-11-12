const {
  sequelize,
  TipoCampoHC,
  PlantillaHC,
  SeccionHC,
  CampoHC,
  OpcionCampoHC,
} = require("../models-sequelize");

// Esquema COMPLETO de Pediatría (copia exacta del frontend, 15 secciones / 122 campos)
const ESQUEMA_BASE = require("./plantillas/pediatria-inicial");
const ESQUEMA_PEDIATRIA = {
  ...ESQUEMA_BASE,
  codigo: "PEDIATRIA_INICIAL",
  tipo_programa: "Pediatría",
  es_seguimiento: false,
};

const TIPOS_CAMPO_DEFAULT = [
  { codigo: "text", nombre: "Texto Corto", componente_ui: "input", descripcion: "Campo de texto de una sola línea" },
  { codigo: "number", nombre: "Número", componente_ui: "input", descripcion: "Campo numérico con validación" },
  { codigo: "textarea", nombre: "Texto Largo / Párrafo", componente_ui: "textarea", descripcion: "Área de texto multilinea con soporte para presets" },
  { codigo: "checkbox", nombre: "Casilla Sí/No", componente_ui: "checkbox", descripcion: "Interruptor booleano verdadero/falso" },
  { codigo: "select", nombre: "Lista Desplegable", componente_ui: "select", descripcion: "Selección única desde lista de opciones" },
  { codigo: "checkbox_group", nombre: "Selección Múltiple", componente_ui: "checkbox_group", descripcion: "Múltiples opciones seleccionables" },
  { codigo: "date", nombre: "Fecha", componente_ui: "CustomDatePicker", descripcion: "Selector visual de fecha calendario" },
  { codigo: "datetime-local", nombre: "Fecha y Hora", componente_ui: "CustomDatePicker", descripcion: "Selector visual de fecha y hora" },
  { codigo: "cups", nombre: "Procedimiento CUPS", componente_ui: "cups", descripcion: "Buscador inteligente de catálogo CUPS" },
  { codigo: "cie10", nombre: "Diagnóstico CIE-10", componente_ui: "cie10", descripcion: "Buscador inteligente de catálogo CIE-10" },
  { codigo: "firma", nombre: "Firma Electrónica", componente_ui: "firma", descripcion: "Lienzo de captura de firma manuscrita digital" },
  { codigo: "bloques_dinamicos", nombre: "Constructor de Preguntas y Tablas", componente_ui: "bloques_dinamicos", descripcion: "Permite agregar tablas y preguntas libres en la historia" },
  { codigo: "hidden", nombre: "Oculto / Técnico", componente_ui: "hidden", descripcion: "Campo oculto que guarda metadatos o IDs" },
];

async function sembrarPlantillaPediatria() {
  console.log("🌱 Iniciando sincronización de tablas y sembrado de Pediatría...");

  // 1. Sincronizar tablas si no existen (alter: true para no borrar nada existente)
  await TipoCampoHC.sync({ alter: true });
  await PlantillaHC.sync({ alter: true });
  await SeccionHC.sync({ alter: true });
  await CampoHC.sync({ alter: true });
  await OpcionCampoHC.sync({ alter: true });

  // 2. Sembrar tipos de campo
  for (const t of TIPOS_CAMPO_DEFAULT) {
    await TipoCampoHC.upsert(t);
  }
  console.log("✓ Catálogo de tipos de campo sincronizado.");

  // 3. Crear o actualizar Plantilla de Pediatría
  let plantilla = await PlantillaHC.findOne({ where: { codigo: ESQUEMA_PEDIATRIA.codigo } });
  if (!plantilla) {
    plantilla = await PlantillaHC.create({
      codigo: ESQUEMA_PEDIATRIA.codigo,
      nombre: ESQUEMA_PEDIATRIA.titulo,
      tipo_programa: ESQUEMA_PEDIATRIA.tipo_programa,
      es_seguimiento: ESQUEMA_PEDIATRIA.es_seguimiento,
      orden: 1,
      descripcion: "Historia clínica inicial y de desarrollo neuromotor para niños.",
    });
  } else {
    await plantilla.update({
      nombre: ESQUEMA_PEDIATRIA.titulo,
      tipo_programa: ESQUEMA_PEDIATRIA.tipo_programa,
    });
  }

  // 4. Sembrar secciones y campos
  for (let sIdx = 0; sIdx < ESQUEMA_PEDIATRIA.secciones.length; sIdx++) {
    const secData = ESQUEMA_PEDIATRIA.secciones[sIdx];
    let [seccion] = await SeccionHC.findOrCreate({
      where: {
        plantilla_id: plantilla.id,
        titulo: secData.titulo,
      },
      defaults: {
        orden: sIdx + 1,
        siempre_visible: !!secData.siempreVisible,
      },
    });

    await seccion.update({
      orden: sIdx + 1,
      siempre_visible: !!secData.siempreVisible,
    });

    // Campos de la sección
    for (let cIdx = 0; cIdx < (secData.campos || []).length; cIdx++) {
      const campoData = secData.campos[cIdx];

      // Propiedades con columna propia; el resto (presets, autoCalc, condicion,
      // dependeDe, oculto, etc.) se conserva íntegro en configuracion_extra
      // para no perder ninguna regla del formulario original.
      const {
        nombre, etiqueta, tipo, requerido, lecsolo, autoNow,
        placeholder, valorPorDefecto, opciones, ...resto
      } = campoData;

      const atributos = {
        etiqueta: etiqueta || nombre,
        tipo_campo_codigo: tipo || "text",
        requerido: !!requerido,
        solo_lectura: !!lecsolo,
        auto_now: !!autoNow,
        placeholder: placeholder || null,
        valor_defecto: valorPorDefecto !== undefined ? String(valorPorDefecto) : null,
        configuracion_extra: {
          ...resto,
          // Valor por defecto con su tipo original (boolean/number/string)
          ...(valorPorDefecto !== undefined ? { valorPorDefectoTipado: valorPorDefecto } : {}),
        },
        orden: cIdx + 1,
      };

      let [campo] = await CampoHC.findOrCreate({
        where: {
          seccion_id: seccion.id,
          codigo_path: nombre,
        },
        defaults: atributos,
      });

      await campo.update(atributos);

      // Opciones si es select o checkbox_group
      if (Array.isArray(campoData.opciones) && campoData.opciones.length > 0) {
        await OpcionCampoHC.destroy({ where: { campo_id: campo.id } });
        for (let oIdx = 0; oIdx < campoData.opciones.length; oIdx++) {
          const opt = campoData.opciones[oIdx];
          const val = typeof opt === "object" ? opt.valor : opt;
          const lbl = typeof opt === "object" ? opt.etiqueta : opt;
          await OpcionCampoHC.create({
            campo_id: campo.id,
            valor: String(val),
            etiqueta: String(lbl),
            orden: oIdx + 1,
          });
        }
      }
    }
  }

  console.log("🎉 Plantilla de Pediatría sembrada con éxito en PostgreSQL.");
}

module.exports = { sembrarPlantillaPediatria };

if (require.main === module) {
  sembrarPlantillaPediatria()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Error sembrando plantilla:", err);
      process.exit(1);
    });
}

