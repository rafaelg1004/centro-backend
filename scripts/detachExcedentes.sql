-- SCRIPT PARA DESVINCULAR CLASES EXCEDENTES Y DEJARLAS COMO DEUDA

-- Paciente: Ernesto Negrete Valverde (Factura 2305) - 1 clases excedentes
UPDATE clase_ninos SET numero_factura = NULL WHERE id = 'ed5b1dde-2f15-4b0e-8727-729d2c5c0b37';
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2305' AND paciente_id = '1d29d31c-d84c-4a50-9aa8-d3bf3fef18c9';

-- Paciente: Matias Garnica Santis (Factura 2562) - 1 clases excedentes
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '1f4d64dc-5678-48e6-92d6-be27c9a5a7cb';
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2562' AND paciente_id = '95e6f039-c76f-4c50-bffa-82219558ca58';

-- Paciente: Isaac Durango Monrroy (Factura 2570) - 2 clases excedentes
UPDATE clase_ninos SET numero_factura = NULL WHERE id = 'dcae30cc-78df-41e8-9493-7fc2fb37fb05';
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '8ced883e-91bd-4161-9841-b33ee82cf15c';
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2570' AND paciente_id = 'af8f309e-ba02-4e96-8ad9-c00b82570d7d';

-- Paciente: Emilia Vidal Restrepo (Factura 2569) - 1 clases excedentes
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '8f347ba6-c687-4df6-9fa4-30b1c54b3b97';
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2569' AND paciente_id = '27f3d703-5f16-4d10-bdfe-05dc931bc46b';

-- Paciente: Antonella Guarín Muñoz (Factura 2572) - 2 clases excedentes
UPDATE clase_ninos SET numero_factura = NULL WHERE id = 'e84f0b1d-648a-449d-95c3-66e38fc62ea0';
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '67c2bd47-d7ad-4349-a9c1-9a021064634e';
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2572' AND paciente_id = '370f55fd-da0e-4f04-ac69-7237077ac646';

-- Paciente: Pablo Cesar  Asias Romero (Factura 2568) - 2 clases excedentes
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '8ab98bd8-a5df-4fae-8c65-c20cf05fffd7';
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '20ab1a89-784d-45dd-8a51-f2d70f422335';
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2568' AND paciente_id = '924a7b35-1aaa-43cd-af09-13969f62446d';

-- Paciente: Alma Peñata Polo (Factura 2362) - 2 clases excedentes
UPDATE clase_ninos SET numero_factura = NULL WHERE id = 'c66f04b6-6c7c-4b6d-b23f-3c77a1e4993e';
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '3c420d0d-e61e-40a4-9e52-9c2c231e0e11';
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2362' AND paciente_id = '42bcfa83-82c4-4cb9-a030-d6b2bee07a60';

-- Paciente: JERONIMO ALDANA GARNICA  (Factura 2661) - 1 clases excedentes
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '2410020c-b4dd-4946-8d5f-0748e5427693';
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2661' AND paciente_id = 'c53a8d65-bbe9-47dc-8664-5f7ed0798582';

