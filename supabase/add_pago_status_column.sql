-- Agregar columna pago_status a la tabla pedidos si no existe
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pago_status text DEFAULT 'pagado';
