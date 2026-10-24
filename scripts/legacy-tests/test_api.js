const { ValoracionFisioterapia } = require('./models-sequelize');
async function run() {
  const v = await ValoracionFisioterapia.findOne({ where: { paciente_id: '68481474-6fab-4ab2-b46e-e39d4a8933dc' } });
  console.log("v.tipo_programa:", v.tipo_programa);
  console.log("v.toJSON():", Object.keys(v.toJSON()));
}
run();
