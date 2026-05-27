-- ============================================================
-- SCRIPT PARA HABILITAR SUBIDA DE ARCHIVOS EN OBSERVACIONES
-- Ejecutar en Supabase -> SQL Editor -> Run
-- ============================================================

-- 1. Agregar la columna archivo_url a pedido_eventos
ALTER TABLE pedido_eventos ADD COLUMN IF NOT EXISTS archivo_url text;

-- 2. Crear el bucket "evidencias" si no existe
INSERT INTO storage.buckets (id, name, public) 
SELECT 'evidencias', 'evidencias', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'evidencias'
);

-- 3. Crear políticas para permitir subir y ver archivos
DROP POLICY IF EXISTS "Public access to evidencias" ON storage.objects;
CREATE POLICY "Public access to evidencias" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'evidencias');

DROP POLICY IF EXISTS "Authenticated users can upload to evidencias" ON storage.objects;
CREATE POLICY "Authenticated users can upload to evidencias" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'evidencias' AND auth.role() = 'authenticated');
