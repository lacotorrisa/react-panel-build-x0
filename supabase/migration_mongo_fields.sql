-- ══════════════════════════════════════════════════════════════
-- COLIVERY ADMIN — SETUP COMPLETO EN SUPABASE
-- Ejecuta todo esto en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- PASO 1: Agregar columnas de MongoDB a tabla pedidos
-- ─────────────────────────────────────────────────────────────
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS mongo_order_id    TEXT,
  ADD COLUMN IF NOT EXISTS mongo_order_number TEXT,
  ADD COLUMN IF NOT EXISTS monto_bruto        NUMERIC(12,2);

-- Índice único para evitar duplicados (solo para filas con mongo_order_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_mongo_order_id
  ON pedidos(mongo_order_id)
  WHERE mongo_order_id IS NOT NULL;

-- PASO 2: Insertar cliente La Cotorrisa Merch
-- ─────────────────────────────────────────────────────────────
INSERT INTO clientes (nombre, email_remitente, nombre_remitente, activo, saldo)
VALUES ('La Cotorrisa Merch', 'tienda@lacotorrisa.com', 'La Cotorrisa', true, 0)
ON CONFLICT DO NOTHING;

-- PASO 3: Verificar que quedó bien
-- ─────────────────────────────────────────────────────────────
SELECT id, nombre, activo FROM clientes ORDER BY created_at DESC LIMIT 5;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pedidos' 
  AND column_name IN ('mongo_order_id', 'mongo_order_number', 'monto_bruto');
