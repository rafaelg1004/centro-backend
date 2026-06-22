const { ValoracionFisioterapia } = require('./models-sequelize');

async function test() {
  try {
    const val = await ValoracionFisioterapia.findByPk("bada2d21-dcf3-46af-ac87-88c18bf9a8a5");
    if (!val) {
      console.log("NOT FOUND");
      return;
    }
    console.log(JSON.stringify(val.toJSON(), null, 2).substring(0, 1000));
    console.log("...");
    console.log("Has datos_legacy?", !!val.datos_legacy);
    console.log("Has modulo_pediatria?", !!val.modulo_pediatria);
  } catch (e) {
    console.error(e);
  }
}
test();
