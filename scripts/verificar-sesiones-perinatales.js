const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { sequelize } = require("../models-sequelize");

const ids = process.argv.slice(2);

(async () => {
  try {
    await sequelize.authenticate();
    for (const id of ids) {
      const rows = await sequelize.query(
        "SELECT id, valoracion_id, numero_sesion, cod_procedimiento, finalidad_tecnologia_salud, cod_diagnostico_principal FROM evoluciones_sesion WHERE valoracion_id = :id",
        {
          replacements: { id },
          type: sequelize.QueryTypes.SELECT,
        },
      );
      console.log(`\nValoración ${id} - ${rows.length} sesión(es):`);
      for (const r of rows) {
        console.log(`  Sesión #${r.numero_sesion}: procedimiento=${r.cod_procedimiento}, finalidad=${r.finalidad_tecnologia_salud}, diagnostico=${r.cod_diagnostico_principal}`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
})();
