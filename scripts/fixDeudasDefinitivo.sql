-- SCRIPT DEFINITIVO PARA CUBRIR DEUDAS CON PAQUETES ACTIVOS

-- 1. Sincronizar todos los contadores de paquetes con la realidad actual
WITH conteo_real AS (
    SELECT numero_factura, COUNT(id) as real_usadas
    FROM clase_ninos
    WHERE numero_factura IS NOT NULL
    GROUP BY numero_factura
)
UPDATE pago_paquetes pp
SET clases_usadas = COALESCE(cr.real_usadas, 0), updated_at = NOW()
FROM conteo_real cr
WHERE pp.numero_factura = cr.numero_factura AND pp.clases_usadas != cr.real_usadas;

UPDATE pago_paquetes pp
SET clases_usadas = 0, updated_at = NOW()
WHERE clases_usadas > 0 AND NOT EXISTS (SELECT 1 FROM clase_ninos cn WHERE cn.numero_factura = pp.numero_factura);

-- Paciente: Valentino Mejia Perez
UPDATE clase_ninos SET numero_factura = '2473' WHERE id = '26648796-4958-4585-912f-6782f675f41f';
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2473';

-- Paciente: Emilia Vidal Restrepo
UPDATE clase_ninos SET numero_factura = '2675' WHERE id = '8f347ba6-c687-4df6-9fa4-30b1c54b3b97';
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2675';

-- Paciente: Pablo Cesar  Asias Romero
UPDATE clase_ninos SET numero_factura = '2639' WHERE id = '8ab98bd8-a5df-4fae-8c65-c20cf05fffd7';
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2639';

-- Paciente: Antonella Guarín Muñoz
UPDATE clase_ninos SET numero_factura = '2526' WHERE id = 'e84f0b1d-648a-449d-95c3-66e38fc62ea0';
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2526';

-- Paciente: Sharon Díaz Martinez
UPDATE clase_ninos SET numero_factura = '2538' WHERE id = '32d00f2b-28b1-4cbc-9273-dee2d1a1fe56';
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2538';

UPDATE pago_paquetes SET clases_usadas = 3, updated_at = NOW() WHERE numero_factura = '2599';

UPDATE pago_paquetes SET clases_usadas = 3, updated_at = NOW() WHERE numero_factura = '2650';

-- Paciente: Mia Isabel Herrera Ponce
UPDATE clase_ninos SET numero_factura = '2600' WHERE id = '008ced13-2002-4894-9dbf-18f2fcd55c98';
UPDATE clase_ninos SET numero_factura = '2600' WHERE id = '2506b8d6-51a9-4147-8a43-df2059502965';
UPDATE clase_ninos SET numero_factura = '2600' WHERE id = '43f02671-9d8b-4f19-9b01-7fe3f76eb698';
UPDATE clase_ninos SET numero_factura = '2600' WHERE id = '83fea376-87f8-4978-9633-e41431ccc2a6';
UPDATE clase_ninos SET numero_factura = '2600' WHERE id = '481b523a-2017-4f1b-91ed-ba1693d8c139';
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2600';

-- Paciente: Ernesto Negrete Valverde
UPDATE clase_ninos SET numero_factura = '2703' WHERE id = 'ed5b1dde-2f15-4b0e-8727-729d2c5c0b37';
UPDATE pago_paquetes SET clases_usadas = 3, updated_at = NOW() WHERE numero_factura = '2703';

-- Paciente: Johana Chica Meza
UPDATE clase_ninos SET numero_factura = '2627' WHERE id = 'b53f0cee-3759-4152-a2ff-4b6cb693ff60';
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2627';

-- Paciente: Matias Garnica Santis
UPDATE clase_ninos SET numero_factura = '2462' WHERE id = '5d27bf21-c10a-4d4f-a2eb-2fee8d5796c2';
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2462';

-- Paciente: Salvador Álvarez Villegas
UPDATE clase_ninos SET numero_factura = '2464' WHERE id = '88434725-586c-41fc-b2c5-47730b2ab8a6';
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE numero_factura = '2464';

-- Paciente: Aaron Samuel Montaña Conde
UPDATE clase_ninos SET numero_factura = '2502' WHERE id = '8f305547-4792-40e1-881e-5501223a46b7';
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2502';

-- Paciente: Luciana Sofía Caraballo Jimenez
UPDATE clase_ninos SET numero_factura = '2508' WHERE id = '70339c1e-eec4-4ac3-9bbd-868d5f1b427b';
UPDATE pago_paquetes SET clases_usadas = 8, updated_at = NOW() WHERE numero_factura = '2508';

UPDATE clase_ninos SET numero_factura = '2596' WHERE id = '467edf31-e31b-4318-934d-2f18d401019f';
UPDATE pago_paquetes SET clases_usadas = 7, updated_at = NOW() WHERE numero_factura = '2596';

UPDATE pago_paquetes SET clases_usadas = 5, updated_at = NOW() WHERE numero_factura = '2658';

