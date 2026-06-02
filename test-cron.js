require("dotenv").config();
const { testConnection } = require("./database/config");
const { cerrarHistoriasAntiguas } = require("./services/cronJobs");

async function run() {
  await testConnection();
  await cerrarHistoriasAntiguas();
  process.exit(0);
}

run();
