const mongoose = require('mongoose');
require('dotenv').config();

async function listUsers() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const users = await db.collection('usuarios').find().toArray();
    console.log('--- USUARIOS SISTEMA ---');
    users.forEach(u => console.log(`Usuario: ${u.usuario} | Rol: ${u.rol}`));
    await mongoose.disconnect();
}

listUsers();
