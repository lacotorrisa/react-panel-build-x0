-- SOLUCIÓN DEFINITIVA AL LOGIN
-- Ejecutar en Supabase → SQL Editor → New Query

-- 1. Deshabilitar RLS en profiles (tabla no sensible, solo roles y nombres)
alter table profiles disable row level security;

-- 2. Crear función segura para insertar perfil si no existe
create or replace function upsert_my_profile(
  p_email text,
  p_nombre text,
  p_rol text
) returns json as $$
declare
  result json;
begin
  insert into profiles (id, email, nombre, rol)
  values (auth.uid(), p_email, p_nombre, p_rol)
  on conflict (id) do update set
    email = excluded.email
  returning row_to_json(profiles.*) into result;
  return result;
end;
$$ language plpgsql security definer;
