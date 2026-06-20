const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { sequelize } = require("../models-sequelize");

(async () => {
  try {
    await sequelize.authenticate();
    const rows = await sequelize.query(
      "SELECT id, paciente_id, cod_consulta, finalidad_tecnologia_salud, causa_motivo_atencion, cod_diagnostico_principal, fecha_inicio_atencion FROM valoraciones_fisioterapia WHERE cod_consulta LIKE '890204%'",
      { type: sequelize.QueryTypes.SELECT },
    );
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
})();
