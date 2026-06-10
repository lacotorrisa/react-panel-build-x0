-- ============================================================
-- COLIVERY — TABLA TRAZABILIDAD DE GUÍAS
-- ============================================================
-- Ejecuta este script en Supabase Dashboard → SQL Editor
-- Permite al admin registrar el costo real de cada guía (vía CSV)
-- y da transparencia al cliente del margen real de Colivery.
-- ============================================================

-- 1. Crear tabla principal
CREATE TABLE IF NOT EXISTS trazabilidad_guias (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
  numero_pedido    TEXT NOT NULL,
  nombre           TEXT,
  telefono         TEXT,
  fecha_compra     DATE,
  producto         TEXT,

  -- Financiero
  precio_tienda    NUMERIC(10,2) NOT NULL DEFAULT 0,  -- Venta bruta del producto
  precio_envio     NUMERIC(10,2) NOT NULL DEFAULT 99, -- Lo que cobra Colivery al cliente (fijo $99)
  comision_pct     NUMERIC(5,2)  NOT NULL DEFAULT 20, -- % comisión Colivery sobre precio_tienda
  costo_guia       NUMERIC(10,2)          DEFAULT 0,  -- Costo real de la guía (viene del CSV)

  -- Columnas calculadas (en la app, no en BD):
  --   comision_colivery = precio_tienda * comision_pct / 100
  --   utilidad_cliente  = precio_tienda - comision_colivery
  --   margen_guia       = precio_envio - costo_guia

  notas            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_trazabilidad_cliente   ON trazabilidad_guias(cliente_id);
CREATE INDEX IF NOT EXISTS idx_trazabilidad_fecha     ON trazabilidad_guias(fecha_compra);
CREATE INDEX IF NOT EXISTS idx_trazabilidad_pedido    ON trazabilidad_guias(numero_pedido);

-- 3. Trigger para updated_at automático
CREATE OR REPLACE FUNCTION set_updated_at_trazabilidad()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_updated_at_trazabilidad ON trazabilidad_guias;
CREATE TRIGGER trg_updated_at_trazabilidad
BEFORE UPDATE ON trazabilidad_guias
FOR EACH ROW EXECUTE FUNCTION set_updated_at_trazabilidad();

-- 4. Row Level Security
ALTER TABLE trazabilidad_guias ENABLE ROW LEVEL SECURITY;

-- Admin: acceso total
DROP POLICY IF EXISTS "Admin gestiona trazabilidad" ON trazabilidad_guias;
CREATE POLICY "Admin gestiona trazabilidad" ON trazabilidad_guias
  FOR ALL USING (get_my_rol() = 'admin');

-- Cliente: solo lectura de sus propios registros
DROP POLICY IF EXISTS "Cliente ve su trazabilidad" ON trazabilidad_guias;
CREATE POLICY "Cliente ve su trazabilidad" ON trazabilidad_guias
  FOR SELECT USING (
    get_my_rol() = 'cliente'
    AND cliente_id = (SELECT cliente_id FROM profiles WHERE id = auth.uid())
  );

-- ============================================================
-- ✅ Tabla trazabilidad_guias creada correctamente.
-- Ahora el admin puede subir CSVs con costos de guías
-- y el cliente verá la transparencia financiera completa.
-- ============================================================
