-- SCRIPT PARA RECUPERAR ASISTENCIAS PERDIDAS DEL HISTÓRICO

-- Paciente: Mia Isabel Herrera Ponce | Factura: 2600 | Faltan: 5 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('d1011fe5-41a5-4b63-a523-cc69e6a0b452', 'Asistencia Histórica Recuperada 1', '2026-04-16', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), 'd1011fe5-41a5-4b63-a523-cc69e6a0b452', '5806fe7b-5c2f-4201-90af-72a586bd70f5', '2600', '{}'::jsonb, NOW());
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('4b060492-8847-46b5-ae0d-0fd6c810adbf', 'Asistencia Histórica Recuperada 2', '2026-04-17', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '4b060492-8847-46b5-ae0d-0fd6c810adbf', '5806fe7b-5c2f-4201-90af-72a586bd70f5', '2600', '{}'::jsonb, NOW());
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('46eba879-0618-46d7-a233-bf016d0cad05', 'Asistencia Histórica Recuperada 3', '2026-04-18', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '46eba879-0618-46d7-a233-bf016d0cad05', '5806fe7b-5c2f-4201-90af-72a586bd70f5', '2600', '{}'::jsonb, NOW());
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('6bd3d143-6fa0-4ccb-b9e6-e6ca3f47c524', 'Asistencia Histórica Recuperada 4', '2026-04-19', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '6bd3d143-6fa0-4ccb-b9e6-e6ca3f47c524', '5806fe7b-5c2f-4201-90af-72a586bd70f5', '2600', '{}'::jsonb, NOW());
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('5788c8a9-3abd-49a2-aa58-8bca6b167d11', 'Asistencia Histórica Recuperada 5', '2026-04-20', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '5788c8a9-3abd-49a2-aa58-8bca6b167d11', '5806fe7b-5c2f-4201-90af-72a586bd70f5', '2600', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2600';

-- Paciente: Luciana Sofía Caraballo Jimenez | Factura: 2596 | Faltan: 2 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('8423b749-66ea-428d-b960-6b4e5dc6a930', 'Asistencia Histórica Recuperada 1', '2026-04-09', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '8423b749-66ea-428d-b960-6b4e5dc6a930', '69797949-91d2-401e-8ddc-fa270ddaac1d', '2596', '{}'::jsonb, NOW());
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('f29fc9ae-90ef-45aa-a609-56b0d7e1903b', 'Asistencia Histórica Recuperada 2', '2026-04-10', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), 'f29fc9ae-90ef-45aa-a609-56b0d7e1903b', '69797949-91d2-401e-8ddc-fa270ddaac1d', '2596', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2596';

-- Paciente: Violeta Torrente Cogollo | Factura: 2491 | Faltan: 2 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('bf0a5929-1fcc-4cdb-98c2-7d1ceab0a164', 'Asistencia Histórica Recuperada 1', '2026-01-29', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), 'bf0a5929-1fcc-4cdb-98c2-7d1ceab0a164', '499e5092-a3a2-44cc-a92d-f87166361bba', '2491', '{}'::jsonb, NOW());
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('413dcd1b-5b70-4fec-b5e4-92f2f9cf8f2c', 'Asistencia Histórica Recuperada 2', '2026-01-30', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '413dcd1b-5b70-4fec-b5e4-92f2f9cf8f2c', '499e5092-a3a2-44cc-a92d-f87166361bba', '2491', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2491';

-- Paciente: Luciana Petro Jaramillo | Factura: 2541 | Faltan: 2 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('e7edf141-b9c7-4ce4-9817-9e88456d0281', 'Asistencia Histórica Recuperada 1', '2026-02-26', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), 'e7edf141-b9c7-4ce4-9817-9e88456d0281', 'f9dfcffd-2f7f-4857-a53a-253120deb312', '2541', '{}'::jsonb, NOW());
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('6a1cda2e-49aa-4246-a530-84f65ad48eaa', 'Asistencia Histórica Recuperada 2', '2026-02-27', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '6a1cda2e-49aa-4246-a530-84f65ad48eaa', 'f9dfcffd-2f7f-4857-a53a-253120deb312', '2541', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2541';

-- Paciente: Ana Victoria Lozano Bedoya | Factura: 2471 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('12ef227f-1339-4c07-8fec-93566dfec95e', 'Asistencia Histórica Recuperada 1', '2026-01-22', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '12ef227f-1339-4c07-8fec-93566dfec95e', '17d5937c-7528-453f-94a4-a97eb266f737', '2471', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 6, updated_at = NOW() WHERE numero_factura = '2471';

-- Paciente: Pedro Juan Dueñas Sánchez | Factura: 2469 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('5e101442-3f9b-4ecc-a482-0bba0b1af595', 'Asistencia Histórica Recuperada 1', '2026-01-22', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '5e101442-3f9b-4ecc-a482-0bba0b1af595', '610b9f27-5eb0-471f-ad86-405c2d1b5390', '2469', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2469';

-- Paciente: Valentino Mejia Perez | Factura: 2473 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('17fa2be7-4f70-43cb-bd18-a32e2e6c74d1', 'Asistencia Histórica Recuperada 1', '2026-01-22', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '17fa2be7-4f70-43cb-bd18-a32e2e6c74d1', 'e358080c-595b-4f61-bab6-d9151f6215aa', '2473', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2473';

-- Paciente: Juan Pablo Vázquez Díaz | Factura: 2470 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('d7e465fe-2b65-4862-b89b-947920e115e6', 'Asistencia Histórica Recuperada 1', '2026-01-24', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), 'd7e465fe-2b65-4862-b89b-947920e115e6', '718d4b54-8588-41e1-9836-e44379fa687b', '2470', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2470';

-- Paciente: Martin David Ruiz Arabia | Factura: 2477 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('c6f30366-8792-4a19-929e-306c0e77dc01', 'Asistencia Histórica Recuperada 1', '2026-01-27', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), 'c6f30366-8792-4a19-929e-306c0e77dc01', 'e707f6f0-75ed-4673-b353-d0400d8b8351', '2477', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2477';

-- Paciente: Aaron Samuel Montaña Conde | Factura: 2502 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('4ac48a47-9795-44f1-beef-db9ecff98a78', 'Asistencia Histórica Recuperada 1', '2026-02-04', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '4ac48a47-9795-44f1-beef-db9ecff98a78', '6c3f325b-2495-43b8-99bd-8a4e7e43d9c3', '2502', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2502';

-- Paciente: Antonella Guarín Muñoz | Factura: 2526 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('a5293e6b-596e-4601-acce-7f42f8d6599e', 'Asistencia Histórica Recuperada 1', '2026-02-21', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), 'a5293e6b-596e-4601-acce-7f42f8d6599e', '370f55fd-da0e-4f04-ac69-7237077ac646', '2526', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2526';

-- Paciente: Gabriela Muñoz Jiménez | Factura: 2535 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('68672906-4487-487f-8dcb-ba4c632e575a', 'Asistencia Histórica Recuperada 1', '2026-02-23', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '68672906-4487-487f-8dcb-ba4c632e575a', 'f61aa34e-4804-4b11-a8ac-af2a57a8e8d9', '2535', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2535';

-- Paciente: Sharon Díaz Martinez | Factura: 2538 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('a5e8ba45-185f-48b3-b50e-22a382316f53', 'Asistencia Histórica Recuperada 1', '2026-02-25', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), 'a5e8ba45-185f-48b3-b50e-22a382316f53', 'db18db83-d05c-4e60-90e1-641062752fa3', '2538', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2538';

-- Paciente: Olivia Garcés Salgado | Factura: 2539 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('2be22183-2bd7-42b8-a260-ae019ea6d673', 'Asistencia Histórica Recuperada 1', '2026-02-25', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '2be22183-2bd7-42b8-a260-ae019ea6d673', 'ffdfbc2a-154c-46d6-91a1-57843bd32f5a', '2539', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2539';

-- Paciente: Salomon David Berrío Rivas | Factura: 2540 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('982ca934-1e53-4679-a249-83087d1109ad', 'Asistencia Histórica Recuperada 1', '2026-02-25', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '982ca934-1e53-4679-a249-83087d1109ad', 'f68bf35f-2a1e-4b49-afcc-9cd4aebc7ea5', '2540', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2540';

-- Paciente: Maria del Mar Botero Marquez | Factura: 2527 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('cd69513f-7189-45b6-886f-0c1afda28c01', 'Asistencia Histórica Recuperada 1', '2026-02-19', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), 'cd69513f-7189-45b6-886f-0c1afda28c01', '96d82363-b077-42a7-a638-2d773a4fd7df', '2527', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2527';

-- Paciente: Benjamin Azael Doria Brunno | Factura: 2455 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('fffd252b-00b3-4e07-8afd-d6da00ed3656', 'Asistencia Histórica Recuperada 1', '2026-01-19', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), 'fffd252b-00b3-4e07-8afd-d6da00ed3656', '048e4b13-afa3-43db-b403-26039a2459da', '2455', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2455';

-- Paciente: Salvador Álvarez Villegas | Factura: 2464 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('703a5b3e-4b88-4788-b818-e73192129384', 'Asistencia Histórica Recuperada 1', '2026-01-21', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '703a5b3e-4b88-4788-b818-e73192129384', 'c1d6a927-2c75-4c46-a6b6-27e989732429', '2464', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2464';

-- Paciente: Sharon Díaz Martinez | Factura: 2599 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('9d4d7638-2550-46d8-857c-e7fe1a3c3e3d', 'Asistencia Histórica Recuperada 1', '2026-04-15', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '9d4d7638-2550-46d8-857c-e7fe1a3c3e3d', 'db18db83-d05c-4e60-90e1-641062752fa3', '2599', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2599';

-- Paciente: Andres Javier Ruendes Arroyo | Factura: 2204 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('97580da7-2a4f-4774-aae9-8aaa3ff79e74', 'Asistencia Histórica Recuperada 1', '2025-08-30', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '97580da7-2a4f-4774-aae9-8aaa3ff79e74', '2963784c-6db3-4d9f-a25b-6bc7ad24b5fc', '2204', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 2, updated_at = NOW() WHERE numero_factura = '2204';

-- Paciente: Johana Chica Meza | Factura: 2627 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('466bbb48-5ec2-4f62-9ffb-11976a95d764', 'Asistencia Histórica Recuperada 1', '2026-04-30', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '466bbb48-5ec2-4f62-9ffb-11976a95d764', 'bb6a3b32-5325-46b9-8803-3ca0812ef8a7', '2627', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2627';

-- Paciente: Gabriela Mejía Morales | Factura: 2278 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('0259eb85-7243-47f0-84b4-aa4bf91dcd89', 'Asistencia Histórica Recuperada 1', '2025-10-10', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '0259eb85-7243-47f0-84b4-aa4bf91dcd89', 'bee708fb-eb80-4ff9-b70a-310597b632b4', '2278', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2278';

-- Paciente: Luciana Sofía Caraballo Jimenez | Factura: 2508 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('fc953b50-f254-4455-b95d-e48a679cdab2', 'Asistencia Histórica Recuperada 1', '2026-02-05', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), 'fc953b50-f254-4455-b95d-e48a679cdab2', '69797949-91d2-401e-8ddc-fa270ddaac1d', '2508', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2508';

-- Paciente: Matias Garnica Santis | Factura: 2462 | Faltan: 1 clases
INSERT INTO clases (id, nombre, fecha, created_at, updated_at) VALUES ('9a943dfd-6d81-4e4f-bc97-d0a5512b8eb1', 'Asistencia Histórica Recuperada 1', '2026-01-21', NOW(), NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at) VALUES (gen_random_uuid(), '9a943dfd-6d81-4e4f-bc97-d0a5512b8eb1', '95e6f039-c76f-4c50-bffa-82219558ca58', '2462', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2462';

