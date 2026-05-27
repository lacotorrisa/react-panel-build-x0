-- ============================================================
-- COLIVERY ADMIN - DEDUCCIÓN AUTOMÁTICA DE INVENTARIO
-- ============================================================

create or replace function deducir_inventario_pedido_fn()
returns trigger as $$
declare
  item jsonb;
  prod_name text;
  prod_talla text;
  cant int;
  inv_rec record;
begin
  -- Solo ejecutar si el status cambia a 'en_transito'
  if new.status = 'en_transito' and (old.status is null or old.status <> 'en_transito') then
    for item in select * from jsonb_array_elements(new.productos)
    loop
      prod_name := trim(item->>'nombre');
      prod_talla := trim(coalesce(item->>'talla', ''));
      cant := coalesce((item->>'cantidad')::int, 1);

      -- Buscar coincidencia en inventario para este cliente
      -- Intentar con nombre + talla (ej. "Playera Negra M"), luego nombre exacto
      select * into inv_rec from inventario
      where cliente_id = new.cliente_id
        and (
          lower(trim(producto)) = lower(prod_name || ' ' || prod_talla)
          or lower(trim(producto)) = lower(prod_name || ' - ' || prod_talla)
          or lower(trim(producto)) = lower(prod_name)
        )
      limit 1;

      -- Si se encuentra coincidencia, deducir stock (limitado a mínimo 0)
      if found then
        update inventario
        set cantidad = greatest(0, cantidad - cant),
            updated_at = now()
        where id = inv_rec.id;
      end if;
    end loop;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Limpiar y crear disparador en pedidos
drop trigger if exists trigger_deducir_inventario_pedido on pedidos;
create trigger trigger_deducir_inventario_pedido
after update on pedidos
for each row execute function deducir_inventario_pedido_fn();
