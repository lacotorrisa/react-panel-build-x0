-- PERFILES
create table profiles (
  id uuid references auth.users primary key,
  email text,
  nombre text,
  rol text check (rol in ('admin', 'cliente', 'paqueteria')),
  cliente_id uuid,
  paqueteria_id uuid,
  created_at timestamptz default now()
);

-- CLIENTES (empresas que venden)
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  logo_url text,
  plataformas text[],
  email_remitente text,
  nombre_remitente text,
  activo boolean default true,
  created_at timestamptz default now()
);

-- PAQUETERÍAS
create table paqueterias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  logo_url text,
  activo boolean default true,
  created_at timestamptz default now()
);

-- PEDIDOS
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id),
  fecha_pedido date not null,
  id_compra text not null,
  plataforma text not null,
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

-- EVENTOS POR PEDIDO
create table pedido_eventos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references pedidos(id),
  tipo text check (tipo in ('guia_asignada','entregado','problema','nota','retraso')),
  descripcion text,
  usuario_id uuid references auth.users(id),
  created_at timestamptz default now()
);

-- PAQUETERÍAS POR DEFECTO
insert into paqueterias (nombre) values ('IMILE'),('FedEx'),('DHL'),('Estafeta');

-- ROW LEVEL SECURITY
alter table profiles enable row level security;
alter table clientes enable row level security;
alter table paqueterias enable row level security;
alter table pedidos enable row level security;
alter table pedido_eventos enable row level security;

create policy "Usuarios ven su perfil" on profiles for select using (auth.uid() = id);
create policy "Admin acceso total clientes" on clientes for all using (
  exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
);
create policy "Admin acceso total paqueterias" on paqueterias for all using (
  exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
);
create policy "Paqueteria ve sus pedidos" on pedidos for select using (
  exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
  or
  exists (select 1 from profiles where id = auth.uid() and rol = 'paqueteria' and paqueteria_id = pedidos.paqueteria_id)
  or
  exists (select 1 from profiles where id = auth.uid() and rol = 'cliente' and cliente_id = pedidos.cliente_id)
);
create policy "Paqueteria actualiza solo sus campos" on pedidos for update using (
  exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
  or
  exists (select 1 from profiles where id = auth.uid() and rol = 'paqueteria')
);
create policy "Admin inserta pedidos" on pedidos for insert with check (
  exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
);
create policy "Eventos visibles" on pedido_eventos for all using (
  exists (select 1 from profiles where id = auth.uid() and rol in ('admin','paqueteria'))
);
