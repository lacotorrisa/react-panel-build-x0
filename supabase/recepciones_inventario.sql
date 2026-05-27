-- 1. Crear tabla de Recepciones
create table if not exists recepciones (
  id uuid primary key default gen_random_uuid(),
  paqueteria_id uuid references paqueterias(id) not null,
  cliente_id uuid references clientes(id) not null,
  fecha date not null default current_date,
  productos jsonb not null default '[]'::jsonb,
  status text not null default 'pendiente' check (status in ('pendiente', 'recibido')),
  evidencia_url text,
  observaciones text,
  created_at timestamptz default now()
);

-- 2. Crear tabla de Inventario
create table if not exists inventario (
  id uuid primary key default gen_random_uuid(),
  paqueteria_id uuid references paqueterias(id) not null,
  cliente_id uuid references clientes(id) not null,
  producto text not null,
  cantidad integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(paqueteria_id, cliente_id, producto)
);

-- 3. Habilitar Seguridad (RLS)
alter table recepciones enable row level security;
alter table inventario enable row level security;

drop policy if exists "Admin gestiona recepciones" on recepciones;
drop policy if exists "Paqueteria ve sus recepciones" on recepciones;
drop policy if exists "Paqueteria actualiza sus recepciones" on recepciones;

create policy "Admin gestiona recepciones" on recepciones for all using (get_my_rol() = 'admin');
create policy "Paqueteria ve sus recepciones" on recepciones for select using (
  get_my_rol() = 'paqueteria' AND paqueteria_id = (select paqueteria_id from profiles where id = auth.uid())
);
create policy "Paqueteria actualiza sus recepciones" on recepciones for update using (
  get_my_rol() = 'paqueteria' AND paqueteria_id = (select paqueteria_id from profiles where id = auth.uid())
);

drop policy if exists "Admin ve inventario" on inventario;
drop policy if exists "Paqueteria ve su inventario" on inventario;

create policy "Admin ve inventario" on inventario for all using (get_my_rol() = 'admin');
create policy "Paqueteria ve su inventario" on inventario for select using (
  get_my_rol() = 'paqueteria' AND paqueteria_id = (select paqueteria_id from profiles where id = auth.uid())
);

-- 4. Automatización: Sumar al inventario cuando la paquetería confirma recepción
create or replace function procesar_recepcion()
returns trigger as $$
declare
  item jsonb;
  prod_name text;
  cant int;
begin
  -- Solo ejecutar si el status cambia de pendiente a recibido
  if new.status = 'recibido' and old.status = 'pendiente' then
    for item in select * from jsonb_array_elements(new.productos)
    loop
      prod_name := item->>'descripcion';
      cant := (item->>'cantidad')::int;
      
      insert into inventario (paqueteria_id, cliente_id, producto, cantidad)
      values (new.paqueteria_id, new.cliente_id, prod_name, cant)
      on conflict (paqueteria_id, cliente_id, producto)
      do update set cantidad = inventario.cantidad + cant, updated_at = now();
    end loop;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_procesar_recepcion on recepciones;
create trigger trigger_procesar_recepcion
after update on recepciones
for each row execute function procesar_recepcion();
