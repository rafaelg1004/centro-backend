-- SCRIPT PARA DESVINCULAR CLASES EXCEDENTES Y DEJARLAS COMO DEUDA

-- Paciente: Helena Pérez Hernández | Factura: 2472 | Excedentes: 6
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '5e10aa4e-c766-4fad-a787-7d7cb6c6981a';
UPDATE clase_ninos SET numero_factura = NULL WHERE id = 'b068cda6-daf3-4c60-b8d7-1674e10faf9e';
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '958f157e-6416-4c65-83a5-b07a8758bdf2';
UPDATE clase_ninos SET numero_factura = NULL WHERE id = 'ba6e80f7-0269-4a58-b01d-5a7d85ca250a';
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '7e894c6f-3412-447c-b397-c24ff7fc13b7';
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '6d034eb9-eec5-4fc4-88bd-4b9d6f5ec0aa';
UPDATE pago_paquetes SET clases_usadas = 1, updated_at = NOW() WHERE numero_factura = '2472';

-- Paciente: Martin David Ruiz Arabia | Factura: 2584 | Excedentes: 4
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '9b1522ff-3348-41f3-aa1f-3b1365fab424';
UPDATE clase_ninos SET numero_factura = NULL WHERE id = 'f5fe7732-c6ed-4ce6-82ba-32210483f377';
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '350392ff-176f-4909-afec-ff8beb3e5608';
UPDATE clase_ninos SET numero_factura = NULL WHERE id = 'aac667a7-313c-4268-9fbd-7d0548dc486d';
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2584';

-- Paciente: Aaron Samuel Montaña Conde | Factura: 2597 | Excedentes: 3
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '52c4d105-f90a-408c-ab09-af777deff6a0';
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '5cfedfd1-2582-42ea-8071-269561b78b2e';
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '6cd01463-14c5-425b-bbd5-211690b9aa95';
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2597';

-- Paciente: Isabella Gonzalez Fernández | Factura: 2537 | Excedentes: 2
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '80e57a06-8109-4ff7-934c-fb776081f223';
UPDATE clase_ninos SET numero_factura = NULL WHERE id = 'd58e4b1f-f776-4649-99d7-ab2317500a91';
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2537';

-- Paciente: Maximiliano Carcamo López | Factura: 2560 | Excedentes: 2
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '4056d021-1339-40aa-86ac-1fa906a70a45';
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '8eef7b7b-65f5-42ed-a3cd-a9ab3222f34e';
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2560';

-- Paciente: Fatima Silgado Gomez | Factura: 2095 | Excedentes: 2
UPDATE clase_ninos SET numero_factura = NULL WHERE id = 'fa8d7bab-74da-4e0f-a416-295e18b67f23';
UPDATE clase_ninos SET numero_factura = NULL WHERE id = 'e649867c-cadb-4032-9091-b668b21e85a1';
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2095';

-- Paciente: Cesar Assis Campo | Factura: 2524 | Excedentes: 1
UPDATE clase_ninos SET numero_factura = NULL WHERE id = '55102ef8-d034-4a52-8b40-63cd9f73785d';
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2524';

