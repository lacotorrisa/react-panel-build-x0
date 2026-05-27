-- ============================================================
-- COLIVERY ADMIN - SISTEMA DE BALANCES Y PAYOUTS
-- ============================================================

-- 1. Agregar columna saldo y balance_inicial a clientes
alter table clientes add column if not exists saldo numeric(12,2) default 0.00;
alter table clientes add column if not exists balance_inicial numeric(12,2) default 0.00;

-- 2. Crear tabla de cortes de balance
create table if not exists cliente_cortes_balance (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  ventas_general numeric(12,2) not null default 0.00 check (ventas_general >= 0),
  ventas_exclusivos numeric(12,2) not null default 0.00 check (ventas_exclusivos >= 0),
  comision_colivery numeric(12,2) not null default 0.00 check (comision_colivery >= 0), -- ej. 20%
  pasarela_pagos numeric(12,2) not null default 0.00 check (pasarela_pagos >= 0),
  costo_administracion numeric(12,2) not null default 0.00 check (costo_administracion >= 0),
  costo_software numeric(12,2) not null default 0.00 check (costo_software >= 0),
  gastos_adicionales numeric(12,2) not null default 0.00 check (gastos_adicionales >= 0),
  neto_favor numeric(12,2) not null default 0.00, -- Calculado como (ventas_general + ventas_exclusivos) - deducciones
  referencia text,
  observaciones text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- 3. Crear tabla de transferencias / payouts
create table if not exists cliente_transferencias (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade not null,
  fecha date not null default current_date,
  monto numeric(12,2) not null check (monto > 0),
  referencia text,
  comprobante_url text, -- PDF o Imagen
  observaciones text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- 4. Habilitar Seguridad (RLS)
alter table cliente_cortes_balance enable row level security;
alter table cliente_transferencias enable row level security;

-- 5. Limpiar y recrear políticas RLS para cortes de balance
drop policy if exists "Admin gestiona cortes" on cliente_cortes_balance;
drop policy if exists "Cliente ve sus cortes" on cliente_cortes_balance;

create policy "Admin gestiona cortes" on cliente_cortes_balance for all using (
  get_my_rol() = 'admin'
);

create policy "Cliente ve sus cortes" on cliente_cortes_balance for select using (
  get_my_rol() = 'cliente'
  and cliente_id = (select cliente_id from profiles where id = auth.uid())
);

-- 6. Limpiar y recrear políticas RLS para transferencias / payouts
drop policy if exists "Admin gestiona transferencias" on cliente_transferencias;
drop policy if exists "Cliente ve sus transferencias" on cliente_transferencias;

create policy "Admin gestiona transferencias" on cliente_transferencias for all using (
  get_my_rol() = 'admin'
);

create policy "Cliente ve sus transferencias" on cliente_transferencias for select using (
  get_my_rol() = 'cliente'
  and cliente_id = (select cliente_id from profiles where id = auth.uid())
);

-- 7. Trigger para recálculo automático y robusto de saldos acumulados
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

-- Limpiar y recrear disparadores
drop trigger if exists trigger_recalcular_saldo_cortes on cliente_cortes_balance;
create trigger trigger_recalcular_saldo_cortes
after insert or update or delete on cliente_cortes_balance
for each row execute function recalcular_saldo_cliente_fn();

drop trigger if exists trigger_recalcular_saldo_transferencias on cliente_transferencias;
create trigger trigger_recalcular_saldo_transferencias
after insert or update or delete on cliente_transferencias
for each row execute function recalcular_saldo_cliente_fn();
