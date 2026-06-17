-- SCRIPT PARA LLENAR CLASES FALTANTES Y CERRAR FACTURAS (FEB-ABR 2026)

-- Niño: Aaron Samuel Montaña Conde (Factura 2597) - Faltan 3 clases
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '8f12ae23-673f-4a59-8919-211991bc8d0c', '6c3f325b-2495-43b8-99bd-8a4e7e43d9c3', '2597', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '44069637-d4c6-4342-b192-0e584d1dfacb', '6c3f325b-2495-43b8-99bd-8a4e7e43d9c3', '2597', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '65e978e6-fc76-4d82-8d95-577c515f790c', '6c3f325b-2495-43b8-99bd-8a4e7e43d9c3', '2597', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = clases_pagadas, updated_at = NOW() WHERE numero_factura = '2597' AND paciente_id = '6c3f325b-2495-43b8-99bd-8a4e7e43d9c3';

-- Niño: Elias David Morelo Hernandez (Factura 2531) - Faltan 2 clases
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '02c99f7c-4f56-489f-a472-b13f0ac8369f', '073ba7a5-9e64-4119-b13b-53ed433ba9fd', '2531', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '7e4decba-a1e9-4c7c-826a-b1b0b06631a8', '073ba7a5-9e64-4119-b13b-53ed433ba9fd', '2531', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = clases_pagadas, updated_at = NOW() WHERE numero_factura = '2531' AND paciente_id = '073ba7a5-9e64-4119-b13b-53ed433ba9fd';

-- Niño: Cesar Assis Campo (Factura 2524) - Faltan 4 clases
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '969aa2c6-d213-4916-a697-58ee1c660355', 'd9f927e8-3307-4f96-aaba-72d5513145e7', '2524', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '66b7b3ab-22c3-4e0a-b602-d38e265c4111', 'd9f927e8-3307-4f96-aaba-72d5513145e7', '2524', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '6dc1cbac-1bd3-4cb4-88ea-238c6533067e', 'd9f927e8-3307-4f96-aaba-72d5513145e7', '2524', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '2d46b902-9210-4304-ab06-4df95f21d74a', 'd9f927e8-3307-4f96-aaba-72d5513145e7', '2524', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = clases_pagadas, updated_at = NOW() WHERE numero_factura = '2524' AND paciente_id = 'd9f927e8-3307-4f96-aaba-72d5513145e7';

-- Niño: Aurora Berrio Narváez (Factura 2525) - Faltan 1 clases
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '373f405b-edd4-466e-bd24-cc601386909e', '05703ff6-2abd-4eaf-ac2f-5a2e67638676', '2525', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = clases_pagadas, updated_at = NOW() WHERE numero_factura = '2525' AND paciente_id = '05703ff6-2abd-4eaf-ac2f-5a2e67638676';

-- Niño: Violeta Torrente Cogollo (Factura 2615) - Faltan 5 clases
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), 'a42dfee8-b5a1-4c17-bef3-c1bf0cf0273f', '499e5092-a3a2-44cc-a92d-f87166361bba', '2615', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), 'e79d4227-ab5a-4afd-aaf8-4b1e72e3346b', '499e5092-a3a2-44cc-a92d-f87166361bba', '2615', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '7ee04d53-e69c-4052-8541-0c733c97257e', '499e5092-a3a2-44cc-a92d-f87166361bba', '2615', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), 'c0eed9dc-2d0c-4eac-a7a7-cee006e936b7', '499e5092-a3a2-44cc-a92d-f87166361bba', '2615', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), 'd666db53-52b4-41c2-aeda-0929c942af3a', '499e5092-a3a2-44cc-a92d-f87166361bba', '2615', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = clases_pagadas, updated_at = NOW() WHERE numero_factura = '2615' AND paciente_id = '499e5092-a3a2-44cc-a92d-f87166361bba';

-- Niño: Maria del Mar Botero Marquez (Factura 2527) - Faltan 2 clases
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '2d46b902-9210-4304-ab06-4df95f21d74a', '96d82363-b077-42a7-a638-2d773a4fd7df', '2527', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), 'e9d407ef-21fc-4e88-9a48-997f1016f6ea', '96d82363-b077-42a7-a638-2d773a4fd7df', '2527', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = clases_pagadas, updated_at = NOW() WHERE numero_factura = '2527' AND paciente_id = '96d82363-b077-42a7-a638-2d773a4fd7df';

-- Niño: Fuad Rashid Barrios (Factura 2624) - Faltan 1 clases
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), 'e79d4227-ab5a-4afd-aaf8-4b1e72e3346b', 'd0afbe42-2ac2-4fc0-af15-696b87400987', '2624', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = clases_pagadas, updated_at = NOW() WHERE numero_factura = '2624' AND paciente_id = 'd0afbe42-2ac2-4fc0-af15-696b87400987';

-- Niño: Mia Isabel Herrera Ponce (Factura 2600) - Faltan 1 clases
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '8f12ae23-673f-4a59-8919-211991bc8d0c', '5806fe7b-5c2f-4201-90af-72a586bd70f5', '2600', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = clases_pagadas, updated_at = NOW() WHERE numero_factura = '2600' AND paciente_id = '5806fe7b-5c2f-4201-90af-72a586bd70f5';

-- Niño: Martin David Ruiz Arabia (Factura 2584) - Faltan 4 clases
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), 'b92344bb-5fd8-41f8-a6c4-94795ab7e0ab', 'e707f6f0-75ed-4673-b353-d0400d8b8351', '2584', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '638f0c52-76f3-42a9-8030-e2858a6bf75a', 'e707f6f0-75ed-4673-b353-d0400d8b8351', '2584', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), 'f2f5d198-7510-480f-9216-3e6f026566b1', 'e707f6f0-75ed-4673-b353-d0400d8b8351', '2584', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '3607e267-cf91-4f1a-b6f0-9f4bb1c5c9ee', 'e707f6f0-75ed-4673-b353-d0400d8b8351', '2584', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = clases_pagadas, updated_at = NOW() WHERE numero_factura = '2584' AND paciente_id = 'e707f6f0-75ed-4673-b353-d0400d8b8351';

-- Niño: Selena Grueso Alvarez (Factura 2513) - Faltan 4 clases
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '9f9555a2-e6fc-448b-bb14-3f8684c3c55e', '665c5de9-767a-4676-8660-2e89569f2a97', '2513', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), 'a7766e4d-0b1e-4794-98df-859683b4830e', '665c5de9-767a-4676-8660-2e89569f2a97', '2513', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '96619e8c-243e-40aa-8028-7d5dad5e6313', '665c5de9-767a-4676-8660-2e89569f2a97', '2513', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '66101674-e3b4-48c2-ab57-74ef64b48626', '665c5de9-767a-4676-8660-2e89569f2a97', '2513', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = clases_pagadas, updated_at = NOW() WHERE numero_factura = '2513' AND paciente_id = '665c5de9-767a-4676-8660-2e89569f2a97';

-- Niño: Isabella Gonzalez Fernández (Factura 2537) - Faltan 5 clases
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '232478e8-bbe9-40c4-b67f-b4a737d37543', '05d3b8b1-efba-438f-97f0-0bec288dec30', '2537', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '7e4decba-a1e9-4c7c-826a-b1b0b06631a8', '05d3b8b1-efba-438f-97f0-0bec288dec30', '2537', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '43487ea9-0cdc-4f25-ae65-6a6b5a45e3c9', '05d3b8b1-efba-438f-97f0-0bec288dec30', '2537', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '09448906-c4a9-4255-bc95-22b7abaf6339', '05d3b8b1-efba-438f-97f0-0bec288dec30', '2537', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '2e5c64ca-e627-4082-ba6a-49033b17ce4e', '05d3b8b1-efba-438f-97f0-0bec288dec30', '2537', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = clases_pagadas, updated_at = NOW() WHERE numero_factura = '2537' AND paciente_id = '05d3b8b1-efba-438f-97f0-0bec288dec30';

-- Niño: Maximiliano Carcamo López (Factura 2560) - Faltan 2 clases
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '232478e8-bbe9-40c4-b67f-b4a737d37543', '6339093d-28a0-4597-b5fe-af3f97ab3ce5', '2560', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '7e4decba-a1e9-4c7c-826a-b1b0b06631a8', '6339093d-28a0-4597-b5fe-af3f97ab3ce5', '2560', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = clases_pagadas, updated_at = NOW() WHERE numero_factura = '2560' AND paciente_id = '6339093d-28a0-4597-b5fe-af3f97ab3ce5';

-- Niño: Pablo Cesar  Asias Romero (Factura 2568) - Faltan 1 clases
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), 'e3f22084-f3cf-4d1e-bc14-eb718fd372b1', '924a7b35-1aaa-43cd-af09-13969f62446d', '2568', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = clases_pagadas, updated_at = NOW() WHERE numero_factura = '2568' AND paciente_id = '924a7b35-1aaa-43cd-af09-13969f62446d';

-- Niño: Lucia  Bedoya Ibañez (Factura 2589) - Faltan 4 clases
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '638f0c52-76f3-42a9-8030-e2858a6bf75a', 'e0d1ed4d-82b8-42de-aecb-43640ee1d320', '2589', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '862427a0-7d6f-4ec8-bfd4-4e3961b19f70', 'e0d1ed4d-82b8-42de-aecb-43640ee1d320', '2589', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), 'f2f5d198-7510-480f-9216-3e6f026566b1', 'e0d1ed4d-82b8-42de-aecb-43640ee1d320', '2589', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '3607e267-cf91-4f1a-b6f0-9f4bb1c5c9ee', 'e0d1ed4d-82b8-42de-aecb-43640ee1d320', '2589', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = clases_pagadas, updated_at = NOW() WHERE numero_factura = '2589' AND paciente_id = 'e0d1ed4d-82b8-42de-aecb-43640ee1d320';

-- Niño: Fatima Silgado Gomez (Factura 2095) - Faltan 2 clases
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '638f0c52-76f3-42a9-8030-e2858a6bf75a', '81b01bd8-27dd-408c-a396-070bd61ed0cd', '2095', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '862427a0-7d6f-4ec8-bfd4-4e3961b19f70', '81b01bd8-27dd-408c-a396-070bd61ed0cd', '2095', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = clases_pagadas, updated_at = NOW() WHERE numero_factura = '2095' AND paciente_id = '81b01bd8-27dd-408c-a396-070bd61ed0cd';

-- Niño: THIAGO VILORIA GARCES (Factura 2605) - Faltan 4 clases
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '3c135421-46de-4acb-b760-66780887f053', 'd94ad22e-142a-45d0-8116-c2f3253c0404', '2605', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), 'c3fc33f0-37f5-43eb-8a8f-0417deaab1f0', 'd94ad22e-142a-45d0-8116-c2f3253c0404', '2605', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), 'a42dfee8-b5a1-4c17-bef3-c1bf0cf0273f', 'd94ad22e-142a-45d0-8116-c2f3253c0404', '2605', '{}'::jsonb, NOW());
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), '4ae46d8a-6fc5-4ce7-9d63-16bf4f22be32', 'd94ad22e-142a-45d0-8116-c2f3253c0404', '2605', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = clases_pagadas, updated_at = NOW() WHERE numero_factura = '2605' AND paciente_id = 'd94ad22e-142a-45d0-8116-c2f3253c0404';

-- Niño: IVANNA  ROA HERRERA (Factura 2626) - Faltan 1 clases
INSERT INTO clase_ninos (id, clase_id, paciente_id, numero_factura, audit_trail, created_at)
VALUES (gen_random_uuid(), 'd666db53-52b4-41c2-aeda-0929c942af3a', '09e14e91-48be-4d60-99af-6864f4ccebaa', '2626', '{}'::jsonb, NOW());
UPDATE pago_paquetes SET clases_usadas = clases_pagadas, updated_at = NOW() WHERE numero_factura = '2626' AND paciente_id = '09e14e91-48be-4d60-99af-6864f4ccebaa';


