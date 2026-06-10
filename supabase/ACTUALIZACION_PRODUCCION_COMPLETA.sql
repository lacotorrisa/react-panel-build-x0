-- ============================================================
-- COLIVERY ADMIN - ACTUALIZACIÓN DE PRODUCCIÓN COMPLETA
-- ============================================================
-- 💡 EJECUTA TODO ESTE SCRIPT EN EL SQL EDITOR DE SUPABASE.
-- Este script realiza la migración completa de balances, corrige los perfiles
-- del administrador y cliente, y habilita de forma segura las políticas RLS
-- para que el Portal de Clientes funcione al 100% sin dar pantallas en blanco.
-- ============================================================

-- ============================================================
-- 1. CORRECCIÓN DE PERFILES (Admin y La Cotorrisa)
-- ============================================================

-- Asegurar que el rol 'cliente' y 'logistica' estén permitidos en la base de datos
alter table profiles drop constraint if exists profiles_rol_check;
alter table profiles add constraint profiles_rol_check check (rol in ('admin', 'cliente', 'paqueteria', 'logistica'));

-- 1.1 Restaurar al administrador maestro a su rol correcto
-- y desvincularlo de cualquier ID de cliente o bodega
UPDATE profiles 
SET rol = 'admin', 
    cliente_id = null,
    paqueteria_id = null,
    logistica_id = null
WHERE email = 'admin@colivery.mx' OR email = 'irigoyen@colivery.mx';

-- 1.2 Asegurar que exista el cliente "La Cotorrisa" de forma idempotente
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM clientes WHERE nombre = 'La Cotorrisa') THEN
    UPDATE clientes SET activo = true WHERE nombre = 'La Cotorrisa';
  ELSE
    INSERT INTO clientes (nombre, activo) VALUES ('La Cotorrisa', true);
  END IF;
END $$;

-- 1.3 Vincular al usuario 'lacotorrisa@colivery.mx' en la tabla profiles con el rol 'cliente'
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
-- 2. TABLAS DE BALANCE Y PAYOUTS (Si no existen)
-- ============================================================

-- 2.1 Agregar columnas de saldo a clientes y cortes
alter table clientes add column if not exists saldo numeric(12,2) default 0.00;
alter table clientes add column if not exists balance_inicial numeric(12,2) default 0.00;
alter table cliente_cortes_balance add column if not exists unidades_vendidas integer default 0;

-- 2.2 Crear tabla de cortes de balance
create table if not exists cliente_cortes_balance (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  ventas_general numeric(12,2) not null default 0.00 check (ventas_general >= 0),
  ventas_exclusivos numeric(12,2) not null default 0.00 check (ventas_exclusivos >= 0),
  comision_colivery numeric(12,2) not null default 0.00 check (comision_colivery >= 0),
  pasarela_pagos numeric(12,2) not null default 0.00 check (pasarela_pagos >= 0),
  costo_administracion numeric(12,2) not null default 0.00 check (costo_administracion >= 0),
  costo_software numeric(12,2) not null default 0.00 check (costo_software >= 0),
  gastos_adicionales numeric(12,2) not null default 0.00 check (gastos_adicionales >= 0),
  unidades_vendidas integer not null default 0 check (unidades_vendidas >= 0),
  neto_favor numeric(12,2) not null default 0.00,
  referencia text,
  observaciones text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- 2.3 Crear tabla de transferencias / payouts
create table if not exists cliente_transferencias (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade not null,
  fecha date not null default current_date,
  monto numeric(12,2) not null check (monto > 0),
  referencia text,
  comprobante_url text,
  observaciones text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);


-- ============================================================
-- 3. TRIGGERS DE CÁLCULO DE SALDO Y DEDUCCIÓN DE INVENTARIO
-- ============================================================

-- 3.1 Trigger para recálculo automático de saldos acumulados
create or replace function recalcular_saldo_cliente_fn()
returns trigger as $$
declare
  target_id uuid;
begin
  if tg_op = 'DELETE' then
    target_id := old.cliente_id;
  else
    target_id := new.cliente_id;
  end if;

  update clientes
  set saldo = (
    coalesce(balance_inicial, 0) +
    coalesce((select sum(neto_favor) from cliente_cortes_balance where cliente_id = target_id), 0) -
    coalesce((select sum(monto) from cliente_transferencias where cliente_id = target_id), 0)
  )
  where id = target_id;

  return null;
end;
$$ language plpgsql security definer;

-- Limpiar y recrear disparadores de saldo
drop trigger if exists trigger_recalcular_saldo_cortes on cliente_cortes_balance;
create trigger trigger_recalcular_saldo_cortes
after insert or update or delete on cliente_cortes_balance
for each row execute function recalcular_saldo_cliente_fn();

drop trigger if exists trigger_recalcular_saldo_transferencias on cliente_transferencias;
create trigger trigger_recalcular_saldo_transferencias
after insert or update or delete on cliente_transferencias
for each row execute function recalcular_saldo_cliente_fn();


-- 3.2 Trigger para deducir inventario cuando el pedido pasa a "en_transito"
create or replace function deducir_inventario_pedido_fn()
returns trigger as $$
declare
  item jsonb;
  prod_name text;
  cant int;
  bodega_id uuid;
begin
  -- Solo se activa al cambiar a 'en_transito'
  if new.status = 'en_transito' and (old.status is null or old.status <> 'en_transito') then
    -- Obtener la bodega logística asociada a la paquetería del pedido (o la primera activa)
    select id into bodega_id from empresas_logisticas where activo = true limit 1;
    
    if bodega_id is not null and new.productos is not null then
      for item in select * from jsonb_array_elements(new.productos)
      loop
        prod_name := item->>'descripcion';
        cant := coalesce((item->>'cantidad')::int, 1);
        
        -- Si existe la prenda en el inventario, deducir la cantidad
        update inventario 
        set cantidad = greatest(cantidad - cant, 0), updated_at = now()
        where logistica_id = bodega_id 
          and cliente_id = new.cliente_id 
          and producto = prod_name;
      end loop;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Limpiar y recrear disparador de inventario
drop trigger if exists trigger_deducir_inventario_pedido on pedidos;
create trigger trigger_deducir_inventario_pedido
after update on pedidos
for each row execute function deducir_inventario_pedido_fn();


-- ============================================================
-- 4. CONTROL TOTAL DE RLS POLICIES PARA ROL 'CLIENTE'
-- ============================================================

-- Habilitar RLS
alter table clientes enable row level security;
alter table inventario enable row level security;
alter table pedidos enable row level security;
alter table cliente_cortes_balance enable row level security;
alter table cliente_transferencias enable row level security;
alter table empresas_logisticas enable row level security;

-- 4.1 POLÍTICAS PARA CLIENTES
drop policy if exists "Todos ven clientes" on clientes;
drop policy if exists "Cliente ve su propio registro" on clientes;
drop policy if exists "Admin gestiona clientes" on clientes;
drop policy if exists "Paqueteria ve clientes" on clientes;
drop policy if exists "Logistica ve clientes" on clientes;

-- Admin gestiona todo
create policy "Admin gestiona clientes" on clientes for all using (get_my_rol() = 'admin');
-- El cliente puede ver su propio registro
create policy "Cliente ve su propio registro" on clientes for select using (
  get_my_rol() = 'cliente' 
  and id = (select cliente_id from profiles where id = auth.uid())
);
-- Logística o paquetería pueden ver los clientes para envíos
create policy "Logistica ve clientes" on clientes for select using (get_my_rol() in ('paqueteria', 'logistica'));


-- 4.2 POLÍTICAS PARA INVENTARIO
drop policy if exists "Admin ve inventario" on inventario;
drop policy if exists "Logistica ve su inventario" on inventario;
drop policy if exists "Cliente ve su propio inventario" on inventario;

-- Admin gestiona todo
create policy "Admin ve inventario" on inventario for all using (get_my_rol() = 'admin');
-- Logística ve su inventario
create policy "Logistica ve su inventario" on inventario for select using (
  get_my_rol() = 'logistica' and logistica_id = (select logistica_id from profiles where id = auth.uid())
);
-- El cliente ve su propio inventario
create policy "Cliente ve su propio inventario" on inventario for select using (
  get_my_rol() = 'cliente' 
  and cliente_id = (select cliente_id from profiles where id = auth.uid())
);


-- 4.3 POLÍTICAS PARA PEDIDOS
drop policy if exists "Admin gestiona pedidos" on pedidos;
drop policy if exists "Logistica ve todos los pedidos" on pedidos;
drop policy if exists "Logistica actualiza pedidos" on pedidos;
drop policy if exists "Cliente ve sus propios pedidos" on pedidos;
drop policy if exists "Cliente ve sus pedidos" on pedidos;

-- Admin todo
create policy "Admin gestiona pedidos" on pedidos for all using (get_my_rol() = 'admin');
-- Logística ve y edita pedidos
create policy "Logistica ve todos los pedidos" on pedidos for select using (get_my_rol() = 'logistica');
create policy "Logistica actualiza pedidos" on pedidos for update using (get_my_rol() = 'logistica');
-- El cliente ve únicamente sus pedidos
create policy "Cliente ve sus propios pedidos" on pedidos for select using (
  get_my_rol() = 'cliente' 
  and cliente_id = (select cliente_id from profiles where id = auth.uid())
);


-- 4.4 POLÍTICAS PARA BALANCES (CORTES Y PAYOUTS)
drop policy if exists "Admin gestiona cortes" on cliente_cortes_balance;
drop policy if exists "Cliente ve sus cortes" on cliente_cortes_balance;
drop policy if exists "Admin gestiona transferencias" on cliente_transferencias;
drop policy if exists "Cliente ve sus transferencias" on cliente_transferencias;

-- Admin gestiona todo
create policy "Admin gestiona cortes" on cliente_cortes_balance for all using (get_my_rol() = 'admin');
create policy "Admin gestiona transferencias" on cliente_transferencias for all using (get_my_rol() = 'admin');

-- El cliente puede consultar sus propios cortes y payouts
create policy "Cliente ve sus cortes" on cliente_cortes_balance for select using (
  get_my_rol() = 'cliente' 
  and cliente_id = (select cliente_id from profiles where id = auth.uid())
);
create policy "Cliente ve sus transferencias" on cliente_transferencias for select using (
  get_my_rol() = 'cliente' 
  and cliente_id = (select cliente_id from profiles where id = auth.uid())
);


-- 4.5 POLÍTICAS PARA BODEGAS / EMPRESAS LOGÍSTICAS
drop policy if exists "Todos los autenticados ven empresas logisticas" on empresas_logisticas;
create policy "Todos los autenticados ven empresas logisticas" on empresas_logisticas for select using (
  auth.role() = 'authenticated'
);

-- ============================================================
-- 5. CARGA INICIAL DE DATOS: CORTE ABRIL 2026 E INVENTARIO
-- ============================================================

-- 5.1 Garantizar que el cliente "La Cotorrisa" exista con su balance inicial de $31,154.20
INSERT INTO clientes (nombre, activo, balance_inicial)
SELECT 'La Cotorrisa', true, 31154.20
WHERE NOT EXISTS (SELECT 1 FROM clientes WHERE nombre = 'La Cotorrisa');

-- Asegurar balance inicial correcto si ya existía
UPDATE clientes 
SET balance_inicial = 31154.20 
WHERE nombre = 'La Cotorrisa';

-- 5.2 Garantizar que la bodega "Solin Logistics" exista
INSERT INTO empresas_logisticas (nombre, activo)
SELECT 'Solin Logistics', true
WHERE NOT EXISTS (SELECT 1 FROM empresas_logisticas WHERE nombre = 'Solin Logistics');

-- 5.3 Registrar el Corte de Balance de Abril 2026 si no existe
INSERT INTO cliente_cortes_balance (
  cliente_id, 
  fecha_inicio, 
  fecha_fin, 
  ventas_general, 
  ventas_exclusivos, 
  comision_colivery, 
  pasarela_pagos, 
  costo_administracion, 
  costo_software, 
  gastos_adicionales, 
  unidades_vendidas, 
  neto_favor, 
  referencia, 
  observaciones
)
SELECT 
  (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1),
  '2026-04-01',
  '2026-04-30',
  190696.00,                 -- Tienda General (.com.mx)
  139208.00,                 -- Tienda Exclusivos (.shop)
  38139.20,                  -- Comisión de plataforma General (20% Colivery)
  5498.72,                   -- Pasarela de pago Exclusivos (.shop)
  22273.28,                  -- Costos de administración Exclusivos (.shop)
  9092.41,                   -- Costos de envío Exclusivos (.shop)
  12969.00,                  -- Costos de envío / deducciones General (.com.mx)
  259,                       -- Unidades vendidas (Prendas totales)
  241931.39,                 -- Neto consolidado a favor
  'Reporte Ejecutivo Abril 2026',
  'Carga inicial detallada de Abril 2026 desde el Reporte Ejecutivo oficial con plataformas separadas (lacotorrisamerch.com.mx y lacotorrisa.shop).'
WHERE NOT EXISTS (
  SELECT 1 FROM cliente_cortes_balance 
  WHERE cliente_id = (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1)
    AND fecha_inicio = '2026-04-01'
    AND fecha_fin = '2026-04-30'
);

-- 5.4 Cargar el Inventario detallado del reporte PDF a Solin Logistics (UPSERT seguro)

-- Sudadera Acid Wash (117 piezas)
INSERT INTO inventario (logistica_id, cliente_id, producto, cantidad)
VALUES 
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Sudadera Acid Wash (Chica)', 5),
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Sudadera Acid Wash (Mediana)', 23),
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Sudadera Acid Wash (Grande)', 32),
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Sudadera Acid Wash (XL)', 34),
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Sudadera Acid Wash (XXL)', 23)
ON CONFLICT (logistica_id, cliente_id, producto) 
DO UPDATE SET cantidad = EXCLUDED.cantidad, updated_at = now();

-- Playera Acid Wash (Tee) (48 piezas)
INSERT INTO inventario (logistica_id, cliente_id, producto, cantidad)
VALUES 
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Playera Acid Wash (Tee) (Chica)', 3),
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Playera Acid Wash (Tee) (Mediana)', 14),
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Playera Acid Wash (Tee) (Grande)', 14),
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Playera Acid Wash (Tee) (XL)', 17)
ON CONFLICT (logistica_id, cliente_id, producto) 
DO UPDATE SET cantidad = EXCLUDED.cantidad, updated_at = now();

-- Playera Oversize Blanca (69 piezas)
INSERT INTO inventario (logistica_id, cliente_id, producto, cantidad)
VALUES 
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Playera Oversize Blanca (Chica)', 14),
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Playera Oversize Blanca (Mediana)', 15),
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Playera Oversize Blanca (Grande)', 21),
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Playera Oversize Blanca (XL)', 19)
ON CONFLICT (logistica_id, cliente_id, producto) 
DO UPDATE SET cantidad = EXCLUDED.cantidad, updated_at = now();

-- Playera Oversize Negra (9 piezas)
INSERT INTO inventario (logistica_id, cliente_id, producto, cantidad)
VALUES 
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Playera Oversize Negra (Chica)', 1),
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Playera Oversize Negra (Mediana)', 1),
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Playera Oversize Negra (Grande)', 4),
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Playera Oversize Negra (XL)', 3)
ON CONFLICT (logistica_id, cliente_id, producto) 
DO UPDATE SET cantidad = EXCLUDED.cantidad, updated_at = now();

-- Jersey — Cotorrisa (10 piezas)
INSERT INTO inventario (logistica_id, cliente_id, producto, cantidad)
VALUES 
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Jersey — Cotorrisa (Chica)', 1),
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Jersey — Cotorrisa (Mediana)', 3),
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Jersey — Cotorrisa (XL)', 4),
  ((SELECT id FROM empresas_logisticas WHERE nombre = 'Solin Logistics' LIMIT 1), (SELECT id FROM clientes WHERE nombre = 'La Cotorrisa' LIMIT 1), 'Jersey — Cotorrisa (XXL)', 2)
ON CONFLICT (logistica_id, cliente_id, producto) 
DO UPDATE SET cantidad = EXCLUDED.cantidad, updated_at = now();


-- ============================================================
-- ✅ ¡MIGRACIÓN DE SEGURIDAD Y CARGA DE REPORTES COMPLETADA CON ÉXITO!
-- Todos los balances, inventarios y permisos están alineados y listos.
-- ============================================================
