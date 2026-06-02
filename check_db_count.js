require("dotenv").config();
const models = require("./models-sequelize");
async function run() {
  const v = await models.ValoracionFisioterapia.findOne();
  console.log(v ? v.toJSON() : "null");
  process.exit(0);
}
run();
