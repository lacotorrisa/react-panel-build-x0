-- ============================================================
-- COLIVERY ADMIN - LIMPIEZA DE PERFILES Y CORREOS
-- Corrección de Administrador y Cliente La Cotorrisa
-- ============================================================

-- 1. Restaurar al administrador maestro a su rol correcto
-- y desvincularlo de cualquier ID de cliente o bodega
UPDATE profiles 
SET rol = 'admin', 
    cliente_id = null,
    paqueteria_id = null,
    logistica_id = null
WHERE email = 'admin@colivery.mx';

-- 2. Asegurar que exista el cliente "La Cotorrisa" en la tabla clientes
-- (Inserta si no existe de forma segura)
INSERT INTO clientes (nombre, activo)
SELECT 'La Cotorrisa', true
WHERE NOT EXISTS (SELECT 1 FROM clientes WHERE nombre = 'La Cotorrisa');

-- 3. Vincular al usuario 'lacotorrisa@colivery.mx' en la tabla profiles
-- Busca al usuario recién creado en auth.users y le asigna el rol 'cliente'
-- y la vinculación con el cliente 'La Cotorrisa'
INSERT INTO profiles (id, email, nombre, rol, cliente_id)
SELECT 
  id, 
  email, 
  'La Cotorrisa Admin', 
  'cliente', 
  (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1)
FROM auth.users
WHERE email = 'lacotorrisa@colivery.mx'
ON CONFLICT (id) DO UPDATE SET 
  rol = 'cliente', 
  cliente_id = (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1),
  nombre = 'La Cotorrisa Admin';

-- ============================================================
-- ✅ ¡Listo!
-- El administrador (admin@colivery.mx) ahora es 100% Admin de nuevo.
-- El cliente (lacotorrisa@colivery.mx) ahora es un Cliente exclusivo de La Cotorrisa.
-- ============================================================
