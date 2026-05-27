-- 1. Crear tabla empresas_logisticas
create table if not exists empresas_logisticas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean default true,
  created_at timestamptz default now()
);

-- 2. Insertar Solin Logistics
insert into empresas_logisticas (nombre) 
select 'Solin Logistics' where not exists (select 1 from empresas_logisticas where nombre = 'Solin Logistics');

-- 3. Actualizar Roles Permitidos
alter table profiles drop constraint if exists profiles_rol_check;
alter table profiles add constraint profiles_rol_check check (rol in ('admin', 'cliente', 'paqueteria', 'logistica'));
alter table profiles add column if not exists logistica_id uuid references empresas_logisticas(id);

-- 4. Asignar perfil de Solin Logistics al rol 'logistica'
update profiles 
set rol = 'logistica', 
    logistica_id = (select id from empresas_logisticas where nombre = 'Solin Logistics' limit 1)
where email = 'solin@colivery.mx' or rol = 'paqueteria';

-- 5. Adaptar Recepciones e Inventario
alter table recepciones add column if not exists logistica_id uuid references empresas_logisticas(id);
alter table inventario add column if not exists logistica_id uuid references empresas_logisticas(id);

-- Para evitar duplicados en inventario
alter table inventario drop constraint if exists inventario_paqueteria_id_cliente_id_producto_key;
alter table inventario add constraint inventario_logistica_id_cliente_id_producto_key unique(logistica_id, cliente_id, producto);

-- 6. Actualizar Políticas RLS de Recepciones e Inventario
drop policy if exists "Paqueteria ve sus recepciones" on recepciones;
drop policy if exists "Paqueteria actualiza sus recepciones" on recepciones;
drop policy if exists "Paqueteria ve su inventario" on inventario;

create policy "Logistica ve sus recepciones" on recepciones for select using (
  get_my_rol() = 'logistica' AND logistica_id = (select logistica_id from profiles where id = auth.uid())
);
create policy "Logistica actualiza sus recepciones" on recepciones for update using (
  get_my_rol() = 'logistica' AND logistica_id = (select logistica_id from profiles where id = auth.uid())
);
create policy "Logistica ve su inventario" on inventario for select using (
  get_my_rol() = 'logistica' AND logistica_id = (select logistica_id from profiles where id = auth.uid())
);

-- 7. Actualizar el Trigger de Inventario
create or replace function procesar_recepcion()
returns trigger as $$
declare
  item jsonb;
  prod_name text;
  cant int;
begin
  if new.status = 'recibido' and old.status = 'pendiente' then
    for item in select * from jsonb_array_elements(new.productos)
    loop
      prod_name := item->>'descripcion';
      cant := (item->>'cantidad')::int;
      
      insert into inventario (logistica_id, cliente_id, producto, cantidad)
      values (new.logistica_id, new.cliente_id, prod_name, cant)
      on conflict (logistica_id, cliente_id, producto)
      do update set cantidad = inventario.cantidad + cant, updated_at = now();
    end loop;
  end if;
  return new;
end;
$$ language plpgsql;

-- 8. Actualizar Permisos en Pedidos para que Logística los vea y gestione
drop policy if exists "Paqueteria ve sus pedidos" on pedidos;
drop policy if exists "Paqueteria actualiza pedidos" on pedidos;

create policy "Logistica ve todos los pedidos" on pedidos for select using (
  get_my_rol() = 'logistica'
);
create policy "Logistica actualiza pedidos" on pedidos for update using (
  get_my_rol() = 'logistica'
);

drop policy if exists "Eventos para admin y paqueteria" on pedido_eventos;
create policy "Eventos para admin y logistica" on pedido_eventos for all using (
  get_my_rol() in ('admin', 'logistica')
);
