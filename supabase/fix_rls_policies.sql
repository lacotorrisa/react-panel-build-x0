-- ============================================================
-- PATCH DE PERMISOS - Ejecutar en Supabase SQL Editor
-- Corrige: acceso de admin a perfiles, observaciones y paqueterías
-- ============================================================

-- Función auxiliar para obtener el rol sin recursión infinita de RLS
create or replace function get_my_rol()
returns text as $$
  select rol from profiles where id = auth.uid()
$$ language sql security definer stable;

-- ============================================================
-- PROFILES: Borrar políticas anteriores y crear correctas
-- ============================================================
drop policy if exists "Usuarios ven su perfil" on profiles;
drop policy if exists "Usuarios insertan su perfil" on profiles;
drop policy if exists "Admin ve todos los perfiles" on profiles;
drop policy if exists "Acceso perfil propio" on profiles;
drop policy if exists "Insertar perfil propio" on profiles;
drop policy if exists "Update propio" on profiles;

-- Ver perfiles: cualquiera ve el suyo, admin ve todos
create policy "Ver perfiles" on profiles for select using (
  auth.uid() = id OR get_my_rol() = 'admin'
);

-- Insertar perfil propio (auto-creación al primer login)
create policy "Insertar perfil propio" on profiles for insert with check (
  auth.uid() = id
);

-- Actualizar: uno mismo o el admin
create policy "Actualizar perfil" on profiles for update using (
  auth.uid() = id OR get_my_rol() = 'admin'
);

-- ============================================================
-- CLIENTES: Admin acceso total, paqueteria puede leer
-- ============================================================
drop policy if exists "Admin acceso total clientes" on clientes;

create policy "Admin gestiona clientes" on clientes for all using (
  get_my_rol() = 'admin'
);

create policy "Paqueteria ve clientes" on clientes for select using (
  get_my_rol() = 'paqueteria'
);

-- ============================================================
-- PAQUETERIAS: Admin gestiona, todos pueden leer
-- ============================================================
drop policy if exists "Admin acceso total paqueterias" on paqueterias;

create policy "Admin gestiona paqueterias" on paqueterias for all using (
  get_my_rol() = 'admin'
);

create policy "Todos ven paqueterias" on paqueterias for select using (
  auth.uid() is not null
);

-- ============================================================
-- PEDIDOS: Permisos por rol
-- ============================================================
drop policy if exists "Paqueteria ve sus pedidos" on pedidos;
drop policy if exists "Paqueteria actualiza solo sus campos" on pedidos;
drop policy if exists "Admin inserta pedidos" on pedidos;

-- Admin ve y gestiona todos
create policy "Admin gestiona pedidos" on pedidos for all using (
  get_my_rol() = 'admin'
);

-- Paqueteria ve todos (Solin maneja todo)
create policy "Paqueteria ve pedidos" on pedidos for select using (
  get_my_rol() = 'paqueteria'
);

-- Paqueteria puede actualizar (guia, link, status, paqueteria_id)
create policy "Paqueteria actualiza pedidos" on pedidos for update using (
  get_my_rol() = 'paqueteria'
);

-- ============================================================
-- PEDIDO_EVENTOS: Admin y paqueteria pueden gestionar
-- ============================================================
drop policy if exists "Eventos visibles" on pedido_eventos;

create policy "Gestionar eventos" on pedido_eventos for all using (
  get_my_rol() in ('admin', 'paqueteria')
);
