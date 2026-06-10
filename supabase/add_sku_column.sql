-- Agregar columna sku a la tabla inventario si no existe
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS sku text;
