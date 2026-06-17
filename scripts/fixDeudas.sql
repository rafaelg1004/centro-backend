-- SCRIPT PARA CUBRIR DEUDAS CON PAQUETES ACTIVOS

UPDATE clase_ninos SET numero_factura = '2703' WHERE id = 'ed5b1dde-2f15-4b0e-8727-729d2c5c0b37';
UPDATE pago_paquetes SET clases_usadas = 3, updated_at = NOW() WHERE id = '929317bf-8c84-487e-849a-13675eab2b9f';

UPDATE clase_ninos SET numero_factura = '2675' WHERE id = '8f347ba6-c687-4df6-9fa4-30b1c54b3b97';
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE id = 'af4c1c0a-647a-479b-8b08-56aa05a0417a';

UPDATE clase_ninos SET numero_factura = '2639' WHERE id = '8ab98bd8-a5df-4fae-8c65-c20cf05fffd7';
UPDATE pago_paquetes SET clases_usadas = 4, updated_at = NOW() WHERE id = '582ec614-9209-4481-a696-6523c38f03c0';

