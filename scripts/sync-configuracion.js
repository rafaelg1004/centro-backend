const { sequelize, ConfiguracionClinica } = require("../models-sequelize");

async function syncConfiguracion() {
  try {
    console.log("Conectando a la base de datos...");
    await sequelize.authenticate();
    console.log("Sincronizando modelo ConfiguracionClinica...");
    
    // Crear tabla si no existe
    await ConfiguracionClinica.sync({ alter: true });
    
    // Verificar si ya existe configuración
    const count = await ConfiguracionClinica.count();
    
    if (count === 0) {
      console.log("Creando configuración por defecto...");
      await ConfiguracionClinica.create({
        nombre_clinica: "D'Mamitas & Babies",
        slogan: "Centro de Estimulación, Fisioterapia y Programas Perinatales",
        nit: "901XXXXXX-X",
        direccion: "Cra 1 W 28-47, Tunja",
        telefono: "+57 317 2774885",
        email: "contacto@dmamitas.com",
        codigo_habilitacion: "1500100XXXX-X",
        representante_legal: "Ft. Dayan Ivonne Villegas Gamboa",
        registro_profesional_representante: "52862625 - Reg. Salud Departamental"
      });
      console.log("Configuración por defecto creada exitosamente.");
    } else {
      console.log("La tabla de configuración ya contiene datos.");
    }
    
    console.log("Proceso completado con éxito.");
    process.exit(0);
  } catch (error) {
    console.error("Error sincronizando configuración:", error);
    process.exit(1);
  }
}

syncConfiguracion();
