-- ============================================================
-- MIGRACIÓN: MAYO 2026 - PAYOUTS + EVENTOS + COMPROBANTES
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Agregar columna "tienda" a cliente_transferencias
ALTER TABLE cliente_transferencias 
  ADD COLUMN IF NOT EXISTS tienda text DEFAULT 'general';

-- 2. Agregar columna "destinatario" a cliente_transferencias  
ALTER TABLE cliente_transferencias 
  ADD COLUMN IF NOT EXISTS destinatario text;

-- 3. Agregar columna "comprobante_nombre" a cliente_transferencias
ALTER TABLE cliente_transferencias 
  ADD COLUMN IF NOT EXISTS comprobante_nombre text;

-- 4. Agregar columna "hora" a cliente_transferencias (para horario exacto del payout)
ALTER TABLE cliente_transferencias 
  ADD COLUMN IF NOT EXISTS hora text;

-- 5. Agregar ventas y comisión de Eventos a cortes
ALTER TABLE cliente_cortes_balance 
  ADD COLUMN IF NOT EXISTS ventas_eventos numeric(12,2) DEFAULT 0.00;

ALTER TABLE cliente_cortes_balance 
  ADD COLUMN IF NOT EXISTS comision_eventos numeric(12,2) DEFAULT 0.00;

-- 6. Crear bucket de almacenamiento para comprobantes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprobantes',
  'comprobantes', 
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 7. Políticas de Storage: Admin puede subir, todos pueden ver
DROP POLICY IF EXISTS "Admin sube comprobantes" ON storage.objects;
DROP POLICY IF EXISTS "Todos ven comprobantes" ON storage.objects;
DROP POLICY IF EXISTS "Admin borra comprobantes" ON storage.objects;

CREATE POLICY "Admin sube comprobantes" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'comprobantes'
  );

CREATE POLICY "Todos ven comprobantes" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'comprobantes'
  );

CREATE POLICY "Admin borra comprobantes" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'comprobantes'
  );

-- ============================================================
-- DATOS: CORTE MAYO 2026
-- ============================================================

-- Insertar corte Mayo 2026 (comisiones pendientes = 0 por ahora)
INSERT INTO cliente_cortes_balance (
  cliente_id, fecha_inicio, fecha_fin,
  ventas_general, ventas_exclusivos, ventas_eventos,
  comision_colivery, pasarela_pagos, costo_administracion,
  costo_software, gastos_adicionales, comision_eventos,
  neto_favor, referencia, observaciones
) VALUES (
  '1882e9a0-4dc0-4a03-96e4-ffa5712cda09',
  '2026-05-01', '2026-05-31',
  170742.00,  -- $139,587.80 ventas + $31,154.20 saldo apertura Abril 1
  102343.59,  -- Ventas exclusivos lacotorrisa.shop
  0.00,       -- Eventos (pendiente)
  0.00,       -- Comisión Colivery (pendiente - el cliente dará desglose)
  0.00,       -- Pasarela pagos (pendiente)
  0.00,       -- Costo administración (pendiente)
  0.00,       -- Costo software (pendiente)
  0.00,       -- Gastos adicionales (pendiente)
  0.00,       -- Comisión eventos (pendiente)
  272085.59,  -- Neto provisional (sin descontar comisiones) = 170742 + 102343.59 - 0
  'Reporte Ejecutivo Mayo 2026',
  'Ventas General incluyen $31,154.20 de saldo apertura Abril 1 + $139,587.80 ventas Mayo. Comisiones pendientes de actualizar.'
);

-- ============================================================
-- DATOS: PAYOUTS TIENDA GENERAL
-- ============================================================

INSERT INTO cliente_transferencias (cliente_id, fecha, hora, monto, tienda, destinatario, referencia)
VALUES 
  ('1882e9a0-4dc0-4a03-96e4-ffa5712cda09', '2026-04-06', NULL,    4500.00,   'general', 'La Cotorrisa', 'Payout plataforma General - Abr 6'),
  ('1882e9a0-4dc0-4a03-96e4-ffa5712cda09', '2026-04-26', NULL,    18530.00,  'general', 'La Cotorrisa', 'Payout plataforma General - Abr 26'),
  ('1882e9a0-4dc0-4a03-96e4-ffa5712cda09', '2026-04-29', NULL,    5610.00,   'general', 'La Cotorrisa', 'Payout plataforma General - Abr 29'),
  ('1882e9a0-4dc0-4a03-96e4-ffa5712cda09', '2026-05-05', NULL,    15000.00,  'general', 'La Cotorrisa', 'Payout plataforma General - May 5'),
  ('1882e9a0-4dc0-4a03-96e4-ffa5712cda09', '2026-05-06', NULL,    10000.00,  'general', 'La Cotorrisa', 'Payout plataforma General - May 6'),
  ('1882e9a0-4dc0-4a03-96e4-ffa5712cda09', '2026-05-13', NULL,    120000.00, 'general', 'La Cotorrisa', 'Payout plataforma General - May 13');

-- ============================================================
-- DATOS: PAYOUTS TIENDA EXCLUSIVOS
-- ============================================================

INSERT INTO cliente_transferencias (cliente_id, fecha, hora, monto, tienda, destinatario, referencia)
VALUES 
  ('1882e9a0-4dc0-4a03-96e4-ffa5712cda09', '2026-05-06', NULL,    15000.00,  'exclusivos', 'Jesus Chavez',       'Payout Exclusivos - May 6'),
  ('1882e9a0-4dc0-4a03-96e4-ffa5712cda09', '2026-05-07', '12:30', 10000.00,  'exclusivos', 'Jesus Chavez',       'Payout Exclusivos - May 7 12:30pm'),
  ('1882e9a0-4dc0-4a03-96e4-ffa5712cda09', '2026-05-11', '17:55', 62700.00,  'exclusivos', 'Cleto (Influencer)', 'Payout Exclusivos - May 11 17:55');
