const { ValoracionFisioterapia } = require('./models-sequelize');

async function test() {
  try {
    const val = await ValoracionFisioterapia.findByPk("bada2d21-dcf3-46af-ac87-88c18bf9a8a5");
    if (!val) {
      console.log("NOT FOUND");
      return;
    }
    console.log("--- modulo_pediatria ---");
    console.log(JSON.stringify(val.modulo_pediatria, null, 2));
    console.log("--- datos_legacy ---");
    console.log(JSON.stringify(val.datos_legacy, null, 2));
  } catch (e) {
    console.error(e);
  }
}
test();
