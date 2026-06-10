-- ============================================================
-- TABLA: solicitudes_retiro
-- Para que el cliente solicite transferencias/depósitos
-- ============================================================

CREATE TABLE IF NOT EXISTS solicitudes_retiro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
  -- Datos del beneficiario
  nombre_beneficiario text NOT NULL,
  banco text NOT NULL,
  clabe_tarjeta text NOT NULL,
  telefono text,
  correo text,
  -- Datos del monto
  monto_solicitado numeric(12,2) NOT NULL CHECK (monto_solicitado > 0),
  con_iva boolean NOT NULL DEFAULT false,
  porcentaje_iva numeric(5,2) DEFAULT 0,
  monto_base numeric(12,2),
  monto_iva numeric(12,2) DEFAULT 0,
  monto_total numeric(12,2),
  -- Control
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','rechazado','pagado')),
  observaciones text,
  nota_admin text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE solicitudes_retiro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cliente ve sus solicitudes" ON solicitudes_retiro;
DROP POLICY IF EXISTS "Cliente crea solicitudes" ON solicitudes_retiro;
DROP POLICY IF EXISTS "Admin gestiona solicitudes" ON solicitudes_retiro;

CREATE POLICY "Cliente ve sus solicitudes" ON solicitudes_retiro
  FOR SELECT USING (
    get_my_rol() = 'cliente'
    AND cliente_id = (SELECT cliente_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Cliente crea solicitudes" ON solicitudes_retiro
  FOR INSERT WITH CHECK (
    get_my_rol() = 'cliente'
    AND cliente_id = (SELECT cliente_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admin gestiona solicitudes" ON solicitudes_retiro
  FOR ALL USING (get_my_rol() = 'admin');
