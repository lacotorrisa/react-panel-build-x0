-- ============================================================
-- COLIVERY ADMIN - SETUP COMPLETO
-- Ejecutar TODO este bloque en Supabase → SQL Editor → Run
-- Funciona aunque ya hayas ejecutado scripts anteriores
-- ============================================================


-- ============================================================
-- 1. CREAR TABLAS (si no existen)
-- ============================================================

create table if not exists profiles (
  id uuid references auth.users primary key,
  email text,
  nombre text,
  rol text check (rol in ('admin', 'cliente', 'paqueteria')),
  cliente_id uuid,
  paqueteria_id uuid,
  created_at timestamptz default now()
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  logo_url text,
  email_remitente text,
  nombre_remitente text,
  activo boolean default true,
  created_at timestamptz default now()
);

create table if not exists paqueterias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  logo_url text,
  activo boolean default true,
  created_at timestamptz default now()
);

create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id),
  fecha_pedido date not null,
  tipo_compra text not null default 'General',
  nombre_comprador text not null,
  direccion text not null,
  referencias text,
  telefono text,
  correo_comprador text not null,
  productos jsonb not null,
  paqueteria_id uuid references paqueterias(id),
  guia text,
  link_seguimiento text,
  tiempo_estimado_entrega text,
  status text default 'pendiente'
    check (status in ('pendiente','en_transito','entregado','con_retraso','problema')),
  observaciones text,
  notificado_en_camino boolean default false,
  notificado_entregado boolean default false,
  correo_enviado_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists pedido_eventos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references pedidos(id),
  tipo text check (tipo in ('guia_asignada','entregado','problema','nota','retraso')),
  descripcion text,
  usuario_id uuid references auth.users(id),
  created_at timestamptz default now()
);


-- ============================================================
-- 2. INSERTAR PAQUETERÍAS POR DEFECTO (si no existen)
-- ============================================================

insert into paqueterias (nombre) 
select 'IMILE' where not exists (select 1 from paqueterias where nombre = 'IMILE');

insert into paqueterias (nombre) 
select 'FedEx' where not exists (select 1 from paqueterias where nombre = 'FedEx');

insert into paqueterias (nombre) 
select 'DHL' where not exists (select 1 from paqueterias where nombre = 'DHL');

insert into paqueterias (nombre) 
select 'Estafeta' where not exists (select 1 from paqueterias where nombre = 'Estafeta');


-- ============================================================
-- 3. HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================

alter table profiles enable row level security;
alter table clientes enable row level security;
alter table paqueterias enable row level security;
alter table pedidos enable row level security;
alter table pedido_eventos enable row level security;


-- ============================================================
-- 4. FUNCIÓN AUXILIAR (evita recursión infinita en RLS)
-- ============================================================

create or replace function get_my_rol()
returns text as $$
  select rol from profiles where id = auth.uid()
$$ language sql security definer stable;


-- ============================================================
-- 5. POLÍTICAS DE SEGURIDAD (limpiar y recrear)
-- ============================================================

-- Limpiar políticas viejas que puedan causar conflictos
drop policy if exists "Usuarios ven su perfil" on profiles;
drop policy if exists "Usuarios insertan su perfil" on profiles;
drop policy if exists "Admin ve todos los perfiles" on profiles;
drop policy if exists "Acceso perfil propio" on profiles;
drop policy if exists "Insertar perfil propio" on profiles;
drop policy if exists "Update propio" on profiles;
drop policy if exists "Ver perfiles" on profiles;

drop policy if exists "Admin acceso total clientes" on clientes;
drop policy if exists "Todos ven clientes" on clientes;

drop policy if exists "Admin acceso total paqueterias" on paqueterias;
drop policy if exists "Todos ven paqueterias" on paqueterias;

drop policy if exists "Paqueteria ve sus pedidos" on pedidos;
drop policy if exists "Paqueteria actualiza solo sus campos" on pedidos;
drop policy if exists "Admin inserta pedidos" on pedidos;

drop policy if exists "Eventos visibles" on pedido_eventos;

-- PROFILES: cualquier usuario autenticado ve y edita su propio perfil; admin ve todos
create policy "Ver perfiles" on profiles for select using (
  auth.uid() = id OR get_my_rol() = 'admin'
);
create policy "Insertar perfil propio" on profiles for insert with check (
  auth.uid() = id
);
create policy "Actualizar perfil propio" on profiles for update using (
  auth.uid() = id OR get_my_rol() = 'admin'
);

-- CLIENTES: solo admin gestiona, todos los autenticados pueden leer
create policy "Todos ven clientes" on clientes for select using (
  auth.role() = 'authenticated'
);
create policy "Admin gestiona clientes" on clientes for all using (
  get_my_rol() = 'admin'
);

-- PAQUETERÍAS: todos los autenticados pueden leer
create policy "Todos ven paqueterias" on paqueterias for select using (
  auth.role() = 'authenticated'
);
create policy "Admin gestiona paqueterias" on paqueterias for all using (
  get_my_rol() = 'admin'
);

-- PEDIDOS: admin todo, paquetería ve los suyos, cliente ve los suyos
create policy "Admin todo en pedidos" on pedidos for all using (
  get_my_rol() = 'admin'
);
create policy "Paqueteria ve sus pedidos" on pedidos for select using (
  get_my_rol() = 'paqueteria'
  AND paqueteria_id = (select paqueteria_id from profiles where id = auth.uid())
);
create policy "Paqueteria actualiza pedidos" on pedidos for update using (
  get_my_rol() = 'paqueteria'
);
create policy "Cliente ve sus pedidos" on pedidos for select using (
  get_my_rol() = 'cliente'
  AND cliente_id = (select cliente_id from profiles where id = auth.uid())
);

-- EVENTOS: admin y paquetería
create policy "Eventos para admin y paqueteria" on pedido_eventos for all using (
  get_my_rol() in ('admin', 'paqueteria')
);


-- ============================================================
-- 6. CREAR PERFILES PARA LOS USUARIOS YA EXISTENTES
--    (Reemplaza los emails con los que creaste en Authentication)
-- ============================================================

-- Perfil Admin
insert into profiles (id, email, nombre, rol)
select 
  au.id,
  au.email,
  'Administrador Maestro',
  'admin'
from auth.users au
where au.email = 'admin@colivery.mx'
on conflict (id) do update set rol = 'admin', nombre = 'Administrador Maestro';

-- Perfil Solin Logistics (paquetería)
insert into profiles (id, email, nombre, rol)
select 
  au.id,
  au.email,
  'Solin Logistics',
  'paqueteria'
from auth.users au
where au.email = 'solin@colivery.mx'
on conflict (id) do update set rol = 'paqueteria', nombre = 'Solin Logistics';


-- ============================================================
-- LISTO ✅
-- Ahora puedes entrar a la app con:
--   admin@colivery.mx  / tu contraseña
--   solin@colivery.mx  / tu contraseña
-- ============================================================
