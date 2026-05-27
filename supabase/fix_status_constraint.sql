-- ============================================================
-- FIX DEFINITIVO del constraint de status
-- Ejecutar en: Supabase → SQL Editor → Run
-- ============================================================

-- Paso 1: Ver cuál es el nombre EXACTO del constraint actual
SELECT conname 
FROM pg_constraint 
WHERE conrelid = 'pedidos'::regclass 
AND contype = 'c';

-- Paso 2: Eliminar TODOS los check constraints de la tabla pedidos
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check;
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check1;

-- Paso 3: Cambiar la columna a text sin constraint (reset)
ALTER TABLE pedidos ALTER COLUMN status TYPE text;
ALTER TABLE pedidos ALTER COLUMN status SET DEFAULT 'pendiente';

-- Paso 4: Agregar el constraint nuevo con TODOS los valores
ALTER TABLE pedidos 
ADD CONSTRAINT pedidos_status_check 
CHECK (status IN (
  'pendiente',
  'en_espera_guia',
  'en_espera_prenda',
  'en_transito',
  'entregado',
  'con_retraso',
  'problema'
));

-- Paso 5: Verificar que quedó correcto (debes ver los 7 valores)
SELECT pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'pedidos_status_check';
