require('dotenv').config();

console.log('=== VERIFICACIÓN DE VARIABLES DE ENTORNO ===');
console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('AWS_BUCKET_NAME:', process.env.AWS_BUCKET_NAME);
console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'Configurado' : 'NO configurado');
console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'Configurado' : 'NO configurado');
console.log('AWS_REGION:', process.env.AWS_REGION);
console.log('PORT:', process.env.PORT);

if (!process.env.AWS_BUCKET_NAME) {
  console.log('❌ ERROR: AWS_BUCKET_NAME no está configurado');
} else {
  console.log('✅ AWS_BUCKET_NAME está configurado');
}

if (!process.env.MONGODB_URI) {
  console.log('❌ ERROR: MONGODB_URI no está configurado');
} else {
  console.log('✅ MONGODB_URI está configurado');
}
